import { StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  body: { padding: SPACING.l, gap: 8 },

  patientBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 8,
  },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
  patientName: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  patientSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  sectionLabel: { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 4 },

  bigAction: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.surface, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  bigIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bigActionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  bigActionSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: SPACING.l, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  modalSub: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginBottom: 16 },
  modalConfirm: { backgroundColor: COLORS.primary, borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
  pickLabel: { fontSize: 12, fontWeight: '800', color: COLORS.text, marginTop: 14, marginBottom: 8, textTransform: 'uppercase' },
  dayPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  dayPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayPillText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  slotPill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  slotPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  slotText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  // A time another patient already holds stays visible and reads as taken.
  slotPillTaken: { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.error },
  slotPillOff: { opacity: 0.4, borderStyle: 'dashed' },
  slotTextTaken: { color: COLORS.error, textDecorationLine: 'line-through' },
  slotEmpty: { fontSize: 12.5, color: COLORS.textSecondary, paddingVertical: 12 },

  // Vitals
  vLabel: { fontSize: 12, fontWeight: '800', color: COLORS.text, marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  vRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vSep: { fontSize: 22, fontWeight: '300', color: COLORS.textSecondary, paddingBottom: 4 },
  vFieldWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.surface, paddingHorizontal: 12, overflow: 'hidden' },
  vInput: { flex: 1, height: 46, fontSize: 16, color: COLORS.text, fontWeight: '700' },
  vUnit: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', paddingLeft: 4 },
});

export default styles;
