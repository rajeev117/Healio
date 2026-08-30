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
  addBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.primary,
  },
  statsRow: {
    flexDirection: 'row', padding: SPACING.m, paddingBottom: 10, gap: 10,
  },
  statCard: {
    flex: 1, padding: 12, borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, gap: 4,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', textAlign: 'center' },
  filterScroll: { paddingHorizontal: SPACING.m, paddingBottom: 14, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  filterTextActive: { color: COLORS.white },
  staffCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: SPACING.m, backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusLg, borderWidth: 1, borderColor: COLORS.border,
  },
  staffAvatar: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
  },
  staffInitials: { fontWeight: '800', fontSize: 16 },
  staffInfo: { flex: 1 },
  staffNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  staffName: { fontSize: 14, fontWeight: '800', color: COLORS.text, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '700' },
  staffMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleText: { fontSize: 11, fontWeight: '700' },
  deptText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  shiftRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shiftText: { fontSize: 11, color: COLORS.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%', padding: SPACING.m,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.surface,
  },
  profileSection: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  profileAvatar: {
    width: 70, height: 70, borderRadius: 35,
    alignItems: 'center', justifyContent: 'center',
  },
  profileInitials: { fontWeight: '800', fontSize: 24 },
  profileName: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  profileBadgesRow: { flexDirection: 'row', gap: 8 },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  detailIcon: {
    width: 34, height: 34, borderRadius: 10, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.primarySoft,
  },
  detailLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  detailValue: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 1 },
  actionBtns: { flexDirection: 'row', gap: 12, marginTop: 20, paddingBottom: 20 },
  leaveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  leaveBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  msgBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  msgBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6, marginTop: 10 },
  fieldInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
    color: COLORS.text, backgroundColor: COLORS.surface, marginBottom: 4,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  miniChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  miniChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  miniChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  miniChipTextActive: { color: COLORS.white },
  shiftOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, marginBottom: 8,
  },
  shiftOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  shiftOptionText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  shiftOptionTextActive: { color: COLORS.primary },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 14, marginTop: 14,
  },
  saveBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
});

export default styles;
