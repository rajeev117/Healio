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
    justifyContent: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: COLORS.text },

  docCard: {
    backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.m, marginBottom: SPACING.m,
  },
  docName: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  docSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  docNote: { fontSize: 11.5, color: COLORS.primary, fontWeight: '700', marginTop: 8 },

  // A schedule change never destroys a booking — this says so.
  conflictBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: COLORS.warningSoft, borderWidth: 1, borderColor: '#eccf7a',
    borderRadius: SIZES.radius, padding: SPACING.m, marginBottom: SPACING.m,
  },
  conflictTitle: { fontSize: 13, fontWeight: '800', color: '#8a6100' },
  conflictSub: { fontSize: 11.5, color: '#8a6100', marginTop: 3, lineHeight: 16 },

  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  sectionSub: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17, marginBottom: SPACING.m },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primarySoft, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  addBtnText: { fontSize: 12.5, fontWeight: '800', color: COLORS.primary },

  emptyBox: {
    alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 24,
    backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg,
    borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed',
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textSecondary },
  emptySub: { fontSize: 12.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },

  card: {
    backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.m, marginBottom: SPACING.m,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: {
    flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, fontWeight: '700', color: COLORS.text,
  },

  label: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 8, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipDanger: { backgroundColor: COLORS.error, borderColor: COLORS.error },
  chipTaken: { backgroundColor: COLORS.mutedSoft, borderColor: COLORS.border, opacity: 0.5 },
  chipText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  chipTextActive: { color: COLORS.white },
  chipTextTaken: { color: COLORS.textSecondary, textDecorationLine: 'line-through' },

  timeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  timeBtnText: { fontSize: 14.5, fontWeight: '700', color: COLORS.text },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.border,
  },
  stepValue: { fontSize: 16, fontWeight: '900', color: COLORS.text, minWidth: 22, textAlign: 'center' },
  stepHint: { flex: 1, fontSize: 10.5, color: COLORS.textSecondary, lineHeight: 14 },

  preview: { fontSize: 11.5, fontWeight: '700', color: COLORS.primary, marginTop: 14 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, marginTop: 8,
  },
  saveText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },

  ghostBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: 14, paddingVertical: 12,
  },
  ghostBtnText: { fontSize: 12.5, fontWeight: '800', color: COLORS.primary },

  mutedNote: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 14, textAlign: 'center' },

  excRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10,
    backgroundColor: COLORS.surface, borderRadius: SIZES.radius,
    borderWidth: 1, borderColor: COLORS.border, padding: 12,
  },
  excDate: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  excReason: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },
  excRemove: { fontSize: 12, fontWeight: '800', color: COLORS.error },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: SPACING.l, paddingBottom: 36,
  },
  modalHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, marginBottom: 16,
  },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: '900', color: COLORS.text },
});

export default styles;
