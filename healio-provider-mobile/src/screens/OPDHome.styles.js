import { StyleSheet } from 'react-native';
import { COLORS, SPACING, SIZES } from '../constants/theme';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  role:         { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  hospitalName: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  callNextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
  },
  callNextText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  statsRow: { flexDirection: 'row', padding: SPACING.m, gap: 10 },
  statCard: {
    flex: 1, padding: 12, borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600' },
  addWalkInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 14, borderRadius: SIZES.radiusLg, borderWidth: 2,
    borderColor: COLORS.primary, borderStyle: 'dashed',
  },
  addWalkInText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  checkInCard: {
    backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg,
    padding: SPACING.m, borderWidth: 1, borderColor: COLORS.border,
  },
  checkInHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  checkInTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 6, marginTop: 8 },
  fieldInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
    color: COLORS.text, backgroundColor: COLORS.background,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:       { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white },
  checkInConfirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 13,
  },
  checkInConfirmText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
  queueTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  queueCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg,
    padding: SPACING.m, borderWidth: 1, borderColor: COLORS.border,
  },
  tokenBox: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  tokenNo: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  queueInfo: { flex: 1 },
  queueName: { fontSize: 14, fontWeight: '800', color: COLORS.text, marginBottom: 3 },
  queueMeta: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 2 },
  queueTime: { fontSize: 11, color: COLORS.textSecondary },
  queueRight: { alignItems: 'flex-end', gap: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '700' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  callBtn:   { backgroundColor: COLORS.primary },
  seenBtn:   { backgroundColor: COLORS.success },
  actionBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 11 },
});

export default styles;
