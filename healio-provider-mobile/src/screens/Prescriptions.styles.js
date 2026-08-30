import { StyleSheet } from 'react-native';
import { COLORS, SPACING, SIZES } from '../constants/theme';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  newBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary,
  },
  filterRow: { flexDirection: 'row', padding: SPACING.m, paddingBottom: 4, gap: 10 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  filterTextActive: { color: COLORS.white },
  listContent: { padding: SPACING.m, paddingTop: 10, gap: 12 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 30, lineHeight: 22 },
  rxCard: {
    backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.m,
  },
  rxHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  patientAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  patientInitials: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
  rxInfo: { flex: 1 },
  rxPatientName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  rxDiagnosis: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  rxMeta: { flexDirection: 'row', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%', padding: SPACING.m,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface,
  },
  diagnosisBox: {
    backgroundColor: COLORS.primarySoft, borderRadius: 12, padding: SPACING.m, marginBottom: 14,
  },
  modalPatientName: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  modalDiagnosis:  { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  modalDate:       { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  viewDocBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primarySoft, borderRadius: 12, padding: 14, marginBottom: 14,
  },
  viewDocText: { flex: 1, color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  noDocNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
  },
  noDocText: { color: COLORS.textSecondary, fontSize: 13 },

  // Upload form
  fieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6, marginTop: 10 },
  fieldInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
    color: COLORS.text, backgroundColor: COLORS.surface, marginBottom: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
  miniChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
  },
  miniChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  miniChipText:   { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  miniChipTextActive: { color: COLORS.white },
  emptyHint: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic', marginBottom: 4 },
  uploadCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, marginTop: 16,
  },
  saveBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
  uploadHint: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginTop: 12, lineHeight: 17 },
});

export default styles;
