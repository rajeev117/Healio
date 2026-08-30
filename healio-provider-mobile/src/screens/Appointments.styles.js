import { StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // Banner
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 10,
    backgroundColor: COLORS.primary,
  },
  bannerNew:     { backgroundColor: '#7c3aed' },
  bannerSuccess: { backgroundColor: '#059669' },
  bannerWarn:    { backgroundColor: '#d97706' },
  bannerText: { color: COLORS.white, fontSize: 13, fontWeight: '700', flex: 1, marginRight: 8 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingTop: SPACING.m, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  headerSub:   { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  backBtn: {
    width: 36, height: 36, borderRadius: 16,
    backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  pendingBadge: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#fef3c7', borderRadius: 20,
  },
  pendingBadgeText: { fontSize: 12, fontWeight: '700', color: '#92400e' },

  // Tabs
  tabRow: {
    flexDirection: 'row', paddingHorizontal: SPACING.m,
    paddingVertical: 10, gap: 8,
  },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText:   { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.white },

  // List
  list: { padding: SPACING.m, gap: 12 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 14 },

  // Card
  card: {
    backgroundColor: COLORS.white, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.m,
  },
  cardPending: { borderColor: '#fbbf24', borderWidth: 1.5 },
  cardOverdue: { borderColor: '#f97316', borderWidth: 2 },
  overdueStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fef3c7', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10,
  },
  overdueText: { fontSize: 11, fontWeight: '700', color: '#92400e', flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatarCircle: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  patientName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  cardSub:     { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statusPill:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusText:  { fontSize: 10, fontWeight: '700' },
  timeRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  timeText:    { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },

  // Action buttons
  actions: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  btnAccept: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: 12, backgroundColor: COLORS.primary,
  },
  btnAcceptText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  btnSuggest: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.white,
  },
  btnSuggestText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  btnDecline: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fff5f5',
  },
  detailLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3,
  },
  detailLinkText: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },

  // Suggest Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: SPACING.l, maxHeight: '88%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: COLORS.text },
  modalSub:    { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginBottom: 16 },
  pickLabel:   { fontSize: 12, fontWeight: '800', color: COLORS.text, marginBottom: 8, textTransform: 'uppercase' },
  dayPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  dayPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayPillText:   { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  slotPill: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  slotPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  slotText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  // A time another patient already holds stays on screen and reads as taken,
  // so the desk can see the shape of the day instead of a filtered list.
  slotPillTaken: { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.error },
  slotPillOff: { opacity: 0.4, borderStyle: 'dashed' },
  slotTextTaken: { color: COLORS.error, textDecorationLine: 'line-through' },
  slotEmpty: { fontSize: 12, color: COLORS.textSecondary, paddingVertical: 12 },
  confirmBtn: {
    backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15,
    alignItems: 'center', marginTop: 4,
  },
  confirmBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },

  declineOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.l },
  declineBox: { backgroundColor: COLORS.white, borderRadius: 24, padding: SPACING.l, width: '100%', maxWidth: 360, alignItems: 'center' },
  declineIconWrap: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#fff5f5', justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.m },
  declineTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  declineMsg: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.l },
  declineBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  declineKeep: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  declineKeepText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  declineConfirm: { flex: 1, height: 48, borderRadius: 12, backgroundColor: '#dc2626', justifyContent: 'center', alignItems: 'center' },
  declineConfirmText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  // Walk-in modal
  addBtn: {
    width: 36, height: 36, borderRadius: 16, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  wiLabel: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 6, marginTop: 14 },
  wiInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
    color: COLORS.text, backgroundColor: COLORS.surface, marginBottom: 2,
  },
  wiHint: { fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic' },
  wiChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  wiChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  wiChipText:   { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  wiChipTextActive: { color: COLORS.white },
  wiConfirmBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  wiConfirmText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
});

export default styles;
