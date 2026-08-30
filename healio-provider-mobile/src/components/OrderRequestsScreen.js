// ─────────────────────────────────────────────────────────────────────────────
// OrderRequestsScreen — the provider side of the prescription-order flow.
//
// A patient sends a prescription (photo/PDF and/or typed list) with no prices.
// Here the pharmacist / lab technician reads it, prices each line by hand, and
// sends the invoice back. The patient then accepts the final amount, which is
// what confirms the order and charges their wallet.
//
// Shared by the pharmacy and lab modules — `kind` picks which queue to show and
// `colors` comes from the calling role's theme.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Image, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  STATUS, STATUS_LABEL, listRequests, subscribe, issueInvoice, rejectRequest,
  suggestLines, totalsFor, makeInvoiceNumber, formatWhen, GST_RATE,
} from '../lib/orderRequests';

const FILTERS = [
  { id: 'open',   label: 'Needs pricing',   match: (r) => r.status === STATUS.AWAITING_REVIEW },
  { id: 'sent',   label: 'Awaiting patient', match: (r) => r.status === STATUS.QUOTED },
  { id: 'closed', label: 'Completed',        match: (r) => [STATUS.CONFIRMED, STATUS.DECLINED, STATUS.CANCELLED].includes(r.status) },
];

export default function OrderRequestsScreen({ navigation, kind = 'pharmacy', colors }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isLab = kind === 'lab';

  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('open');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let alive = true;
    const sync = async () => {
      const rs = await listRequests(kind);
      if (alive) setRequests(rs);
    };
    sync();
    const unsub = subscribe(sync);
    return () => { alive = false; unsub(); };
  }, [kind]);

  const selected = requests.find((r) => r.id === selectedId) || null;
  const counts = FILTERS.reduce((acc, f) => {
    acc[f.id] = requests.filter(f.match).length;
    return acc;
  }, {});
  const shown = requests.filter(FILTERS.find((f) => f.id === filter).match);

  if (selected) {
    return (
      <RequestDetail
        request={selected}
        isLab={isLab}
        styles={styles}
        colors={colors}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={21} color={colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Order Requests</Text>
          <Text style={styles.headerSub}>
            {isLab ? 'Price the tests a patient has sent' : 'Price the prescription a patient has sent'}
          </Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(f.id)}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label}{counts[f.id] ? ` (${counts[f.id]})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {shown.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="file-tray-outline" size={40} color={colors.border} />
            <Text style={styles.emptyText}>
              {filter === 'open' ? 'No requests waiting to be priced' : 'Nothing here yet'}
            </Text>
          </View>
        ) : shown.map((r) => (
          <TouchableOpacity key={r.id} style={styles.card} onPress={() => setSelectedId(r.id)} activeOpacity={0.85}>
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(r.patientName || 'P').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{r.patientName || 'Patient'}</Text>
                <Text style={styles.cardMeta}>{r.orderNumber} · {formatWhen(r.createdAt)}</Text>
              </View>
              <StatusPill status={r.status} styles={styles} colors={colors} />
            </View>

            <View style={styles.cardChips}>
              {r.attachments?.length > 0 && (
                <View style={styles.chip}>
                  <Ionicons name="document-attach-outline" size={12} color={colors.primary} />
                  <Text style={styles.chipText}>
                    {r.attachments.length} file{r.attachments.length > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
              {!!r.notes && (
                <View style={styles.chip}>
                  <Ionicons name="create-outline" size={12} color={colors.primary} />
                  <Text style={styles.chipText}>Typed list</Text>
                </View>
              )}
              <View style={styles.chip}>
                <Ionicons
                  name={r.fulfilment === 'delivery' ? 'bicycle' : r.fulfilment === 'home' ? 'home' : 'storefront'}
                  size={12}
                  color={colors.primary}
                />
                <Text style={styles.chipText}>{r.fulfilmentLabel}</Text>
              </View>
            </View>

            {!!r.notes && <Text style={styles.cardNotes} numberOfLines={2}>{r.notes}</Text>}

            {r.status === STATUS.QUOTED && !!r.invoice && (
              <Text style={styles.cardQuoted}>Invoice {r.invoice.number} · ₹{r.invoice.total} sent</Text>
            )}
            {r.status === STATUS.CONFIRMED && !!r.invoice && (
              <Text style={styles.cardPaid}>Accepted · ₹{r.invoice.total} paid</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Detail + pricing ─────────────────────────────────────────────────────────

function RequestDetail({ request, isLab, styles, colors, onBack }) {
  const [rows, setRows] = useState(() => suggestLines(request));
  const [editing, setEditing] = useState(request.status === STATUS.AWAITING_REVIEW);
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);

  // Re-seed the editor from the last invoice when revising one already sent.
  const startRevision = () => {
    if (request.invoice) {
      setRows(request.invoice.items.map((i) => ({ label: i.label, amount: String(i.amount) })));
    }
    setEditing(true);
  };

  const { items, subtotal, gst, total } = totalsFor(rows, request.fee, request.kind);
  const canSend = items.length > 0;

  const setRow = (index, key) => (value) =>
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, [key]: value } : r)));

  const addRow = () => setRows((rs) => [...rs, { label: '', amount: '' }]);
  const removeRow = (index) => setRows((rs) => (rs.length === 1 ? rs : rs.filter((_, i) => i !== index)));

  const send = useCallback(async () => {
    if (!canSend) {
      Alert.alert('Add at least one line', 'Enter an item and its price before sending the invoice.');
      return;
    }
    setSending(true);
    await issueInvoice(request.id, {
      number: request.invoice?.number || makeInvoiceNumber(),
      issuedAt: Date.now(),
      items,
      subtotal,
      gst,
      fee: request.fee?.amount > 0 ? request.fee : null,
      total,
      note: isLab
        ? 'Priced against the prescription shared. Report charges included.'
        : 'Priced against the prescription shared. Substitutes, if any, are noted per line.',
    });
    setSending(false);
    setEditing(false);
    Alert.alert(
      'Invoice sent',
      `${request.patientName || 'The patient'} has been asked to accept ₹${total}. The order is confirmed once they do.`
    );
  }, [canSend, request, items, subtotal, gst, total, isLab]);

  const reject = () => {
    Alert.alert(
      'Reject this request?',
      'The patient will be told the order could not be taken. Nothing is charged.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => rejectRequest(request.id, isLab ? 'Lab could not take this request' : 'Pharmacy could not take this request'),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={21} color={colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{request.patientName || 'Patient'}</Text>
          <Text style={styles.headerSub}>{request.orderNumber} · {formatWhen(request.createdAt)}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* What the patient sent */}
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Prescription</Text>
            {request.attachments?.length > 0 ? (
              <View style={styles.attachGrid}>
                {request.attachments.map((a, i) => (
                  <TouchableOpacity
                    key={`${a.name}-${i}`}
                    style={styles.attachTile}
                    onPress={() => (a.kind === 'image' ? setPreview(a) : Alert.alert(a.name, 'PDF attachment'))}
                    activeOpacity={0.85}
                  >
                    {a.kind === 'image' ? (
                      <Image source={{ uri: a.uri }} style={styles.attachThumb} />
                    ) : (
                      <View style={[styles.attachThumb, styles.pdfThumb]}>
                        <Ionicons name="document-text" size={22} color={colors.primary} />
                      </View>
                    )}
                    <Text style={styles.attachName} numberOfLines={1}>{a.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>No file attached</Text>
            )}

            {!!request.notes && (
              <>
                <Text style={[styles.panelTitle, { marginTop: 14 }]}>
                  {isLab ? 'Tests requested' : 'Medicines requested'}
                </Text>
                <Text style={styles.notes}>{request.notes}</Text>
              </>
            )}
          </View>

          {/* Where it goes */}
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{isLab ? 'Collection' : 'Fulfilment'}</Text>
            <DetailRow label="Mode" value={request.fulfilmentLabel} styles={styles} />
            {!!request.address && <DetailRow label="Address" value={request.address} styles={styles} />}
            <DetailRow label={isLab ? 'Appointment' : 'Slot'} value={request.slot} styles={styles} />
            {/* Present only when a Healthcare Consultant raised this on the
                patient's behalf — patient-raised requests carry neither. */}
            {!!request.patientPhone && <DetailRow label="Patient phone" value={request.patientPhone} styles={styles} />}
            {!!request.bookedByLabel && <DetailRow label="Raised by" value={request.bookedByLabel} styles={styles} />}
          </View>

          {/* Pricing */}
          {editing ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Price the {isLab ? 'tests' : 'items'}</Text>
              {rows.map((row, i) => (
                <View key={i} style={styles.editRow}>
                  <TextInput
                    style={[styles.input, styles.inputLabel]}
                    value={row.label}
                    onChangeText={setRow(i, 'label')}
                    placeholder={isLab ? 'Test name' : 'Medicine / pack'}
                    placeholderTextColor={colors.textSecondary}
                  />
                  <View style={styles.amountWrap}>
                    <Text style={styles.rupee}>₹</Text>
                    <TextInput
                      style={[styles.input, styles.inputAmount]}
                      value={row.amount}
                      onChangeText={(v) => setRow(i, 'amount')(v.replace(/[^0-9]/g, ''))}
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="number-pad"
                    />
                  </View>
                  <TouchableOpacity onPress={() => removeRow(i)} style={styles.removeBtn} hitSlop={6}>
                    <Ionicons name="close" size={15} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.addRowBtn} onPress={addRow}>
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={styles.addRowText}>Add item</Text>
              </TouchableOpacity>

              <View style={styles.totalsBox}>
                <TotalRow label="Subtotal" value={subtotal} styles={styles} />
                {!isLab && <TotalRow label={`GST (${Math.round(GST_RATE * 100)}%)`} value={gst} styles={styles} />}
                {request.fee?.amount > 0 && (
                  <TotalRow label={request.fee.label} value={request.fee.amount} styles={styles} />
                )}
                <View style={styles.totalDivider} />
                <View style={styles.totalRow}>
                  <Text style={styles.grandLabel}>Final amount</Text>
                  <Text style={styles.grandValue}>₹{total}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, (!canSend || sending) && { opacity: 0.5 }]}
                onPress={send}
                disabled={!canSend || sending}
              >
                <Ionicons name="send" size={16} color={colors.white} />
                <Text style={styles.primaryBtnText}>
                  {sending ? 'Sending…' : `Send invoice · ₹${total}`}
                </Text>
              </TouchableOpacity>
              <Text style={styles.footNote}>
                The patient reviews this amount and accepts it — the order is confirmed
                and paid only then.
              </Text>
              {request.status === STATUS.AWAITING_REVIEW && (
                <TouchableOpacity style={styles.linkBtn} onPress={reject}>
                  <Text style={styles.linkBtnText}>Reject request</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <SentPanel
              request={request}
              isLab={isLab}
              styles={styles}
              colors={colors}
              onRevise={startRevision}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={styles.modalBg}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setPreview(null)}>
            <Ionicons name="close" size={24} color={colors.white} />
          </TouchableOpacity>
          {!!preview && <Image source={{ uri: preview.uri }} style={styles.modalImage} resizeMode="contain" />}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SentPanel({ request, isLab, styles, colors, onRevise }) {
  const inv = request.invoice;
  const { status } = request;

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Invoice</Text>
      {!inv ? (
        <Text style={styles.muted}>No invoice raised.</Text>
      ) : (
        <>
          <Text style={styles.invMeta}>{inv.number} · sent {formatWhen(inv.issuedAt)}</Text>
          {inv.items.map((it, i) => (
            <View key={`${it.label}-${i}`} style={styles.totalRow}>
              <Text style={styles.invLine} numberOfLines={2}>{it.label}</Text>
              <Text style={styles.invLineVal}>₹{it.amount}</Text>
            </View>
          ))}
          {inv.gst > 0 && <TotalRow label="GST" value={inv.gst} styles={styles} />}
          {!!inv.fee && <TotalRow label={inv.fee.label} value={inv.fee.amount} styles={styles} />}
          <View style={styles.totalDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.grandLabel}>Final amount</Text>
            <Text style={styles.grandValue}>₹{inv.total}</Text>
          </View>
        </>
      )}

      <View style={[
        styles.statusBox,
        status === STATUS.CONFIRMED && styles.statusBoxOk,
        (status === STATUS.DECLINED || status === STATUS.CANCELLED) && styles.statusBoxBad,
      ]}>
        <Ionicons
          name={status === STATUS.CONFIRMED ? 'checkmark-circle'
            : status === STATUS.QUOTED ? 'hourglass-outline' : 'close-circle'}
          size={16}
          color={status === STATUS.CONFIRMED ? colors.success
            : status === STATUS.QUOTED ? colors.textSecondary : colors.error}
        />
        <Text style={styles.statusBoxText}>
          {status === STATUS.QUOTED && 'Waiting for the patient to accept this amount.'}
          {status === STATUS.CONFIRMED && `Patient accepted — ₹${inv?.total} paid. ${isLab ? 'Prepare for collection.' : 'Prepare the order.'}`}
          {status === STATUS.DECLINED && 'Patient declined the amount. Nothing was charged.'}
          {status === STATUS.CANCELLED && (request.closeReason || 'Request cancelled.')}
        </Text>
      </View>

      {status === STATUS.QUOTED && (
        <TouchableOpacity style={styles.secondaryBtn} onPress={onRevise}>
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text style={styles.secondaryBtnText}>Revise invoice</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────────────

function StatusPill({ status, styles, colors }) {
  const tone =
    status === STATUS.AWAITING_REVIEW ? { bg: colors.warningSoft, fg: '#92400e' }
    : status === STATUS.QUOTED ? { bg: colors.infoSoft, fg: '#1e40af' }
    : status === STATUS.CONFIRMED ? { bg: colors.successSoft, fg: colors.success }
    : { bg: colors.dangerSoft, fg: colors.error };
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.pillText, { color: tone.fg }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

const DetailRow = ({ label, value, styles }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} numberOfLines={3}>{value || '—'}</Text>
  </View>
);

const TotalRow = ({ label, value, styles }) => (
  <View style={styles.totalRow}>
    <Text style={styles.totalLabel}>{label}</Text>
    <Text style={styles.totalValue}>₹{value}</Text>
  </View>
);

// ── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.surface },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.primary, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerTitle: { color: c.white, fontSize: 17, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11.5, marginTop: 2 },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  filterChip: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10,
    backgroundColor: c.white, borderWidth: 1.5, borderColor: c.border,
  },
  filterChipActive: { borderColor: c.primary, backgroundColor: c.primarySoft },
  filterText: { fontSize: 11, fontWeight: '700', color: c.textSecondary },
  filterTextActive: { color: c.primary },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 13, color: c.textSecondary },

  card: {
    backgroundColor: c.white, borderRadius: 16, borderWidth: 1, borderColor: c.border,
    padding: 14, marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: c.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: c.primary },
  cardName: { fontSize: 14, fontWeight: '800', color: c.text },
  cardMeta: { fontSize: 11, color: c.textSecondary, marginTop: 2 },
  cardChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: c.surface, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: c.border,
  },
  chipText: { fontSize: 10.5, fontWeight: '700', color: c.textSecondary },
  cardNotes: { fontSize: 12, color: c.textSecondary, marginTop: 10, lineHeight: 17 },
  cardQuoted: { fontSize: 11.5, fontWeight: '700', color: '#1e40af', marginTop: 10 },
  cardPaid: { fontSize: 11.5, fontWeight: '700', color: c.success, marginTop: 10 },

  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 10, fontWeight: '800' },

  panel: {
    backgroundColor: c.white, borderRadius: 16, borderWidth: 1, borderColor: c.border,
    padding: 14, marginBottom: 14,
  },
  panelTitle: { fontSize: 13.5, fontWeight: '800', color: c.text, marginBottom: 10 },
  muted: { fontSize: 12.5, color: c.textSecondary },
  notes: { fontSize: 13, color: c.text, lineHeight: 19 },

  attachGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  attachTile: { width: 92 },
  attachThumb: { width: 92, height: 92, borderRadius: 10, backgroundColor: c.primarySoft },
  pdfThumb: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border },
  attachName: { fontSize: 10, color: c.textSecondary, marginTop: 4 },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 4 },
  detailLabel: { fontSize: 12, color: c.textSecondary },
  detailValue: { flex: 1, fontSize: 12.5, fontWeight: '700', color: c.text, textAlign: 'right' },

  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  input: {
    borderWidth: 1.5, borderColor: c.border, borderRadius: 10, backgroundColor: c.surface,
    paddingHorizontal: 10, height: 44, fontSize: 13.5, color: c.text,
  },
  inputLabel: { flex: 1 },
  amountWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rupee: { fontSize: 14, fontWeight: '700', color: c.textSecondary },
  inputAmount: { width: 74, textAlign: 'right' },
  removeBtn: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.dangerSoft,
  },
  addRowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: c.border,
  },
  addRowText: { fontSize: 12.5, fontWeight: '700', color: c.primary },

  totalsBox: {
    marginTop: 14, padding: 12, borderRadius: 12,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  totalLabel: { fontSize: 12.5, color: c.textSecondary },
  totalValue: { fontSize: 12.5, fontWeight: '700', color: c.text },
  totalDivider: { height: 1, backgroundColor: c.border, marginVertical: 8 },
  grandLabel: { fontSize: 14, fontWeight: '800', color: c.text },
  grandValue: { fontSize: 17, fontWeight: '800', color: c.primary },

  invMeta: { fontSize: 11, color: c.textSecondary, marginBottom: 10 },
  invLine: { flex: 1, fontSize: 12.5, color: c.text },
  invLineVal: { fontSize: 12.5, fontWeight: '700', color: c.text },

  statusBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14,
    padding: 11, borderRadius: 10, backgroundColor: c.surface,
    borderWidth: 1, borderColor: c.border,
  },
  statusBoxOk: { backgroundColor: c.successSoft, borderColor: c.successSoft },
  statusBoxBad: { backgroundColor: c.dangerSoft, borderColor: c.dangerSoft },
  statusBoxText: { flex: 1, fontSize: 11.5, color: c.text, lineHeight: 16 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.primary, borderRadius: 13, paddingVertical: 14, marginTop: 16,
  },
  primaryBtnText: { color: c.white, fontWeight: '800', fontSize: 14.5 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: 12, paddingVertical: 12, marginTop: 14,
    backgroundColor: c.primarySoft, borderWidth: 1.5, borderColor: c.primary,
  },
  secondaryBtnText: { color: c.primary, fontWeight: '800', fontSize: 13 },
  footNote: { fontSize: 10.5, color: c.textSecondary, textAlign: 'center', marginTop: 10, lineHeight: 15 },
  linkBtn: { alignItems: 'center', paddingVertical: 12 },
  linkBtnText: { color: c.error, fontWeight: '700', fontSize: 12.5 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  modalClose: { position: 'absolute', top: 44, right: 20, zIndex: 2, padding: 8 },
  modalImage: { width: '100%', height: '80%' },
});
