import { StyleSheet } from 'react-native';
import { COLORS, SPACING, SIZES } from '../constants/theme';

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.background },
  header:       {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  role:         { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  hospitalName: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  notifBtn:     { padding: 8, position: 'relative' },
  notifBadge:   {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: COLORS.error, borderRadius: 8,
    paddingHorizontal: 4, minWidth: 16, alignItems: 'center',
  },
  notifBadgeText: { color: COLORS.white, fontSize: 9, fontWeight: '800' },
  statsRow:     { flexDirection: 'row', padding: SPACING.m, gap: 10 },
  statCard:     {
    flex: 1, padding: 12, borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, gap: 4,
  },
  statValue:    { fontSize: 22, fontWeight: '800' },
  statLabel:    { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600' },
  tabBar:       {
    flexDirection: 'row', marginHorizontal: SPACING.m, marginBottom: 4,
    backgroundColor: COLORS.surface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, padding: 4,
  },
  tab:          { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive:    { backgroundColor: COLORS.primary },
  tabText:      { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  tabTextActive:{ color: COLORS.white },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:  { fontSize: 14, color: COLORS.textSecondary },
  orderCard:    {
    backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg,
    padding: SPACING.m, borderWidth: 1, borderColor: COLORS.border,
  },
  orderTop:     { gap: 4 },
  orderIdRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderId:      { fontSize: 14, fontWeight: '800', color: COLORS.text, fontFamily: 'monospace' },
  statusPill:   {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  statusText:   { fontSize: 10, fontWeight: '700' },
  patientName:  { fontSize: 14, fontWeight: '700', color: COLORS.text },
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText:     { fontSize: 11, color: COLORS.textSecondary },
  expandSection:{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 6 },
  notesText:    { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  phoneRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phoneText:    { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  nextBtn:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: COLORS.primary, borderRadius: 10,
    paddingVertical: 10, marginTop: 12,
  },
  detailBtn:    { backgroundColor: '#c05621' },
  nextBtnText:  { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  empty:        { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle:   { fontSize: 18, fontWeight: '800', color: COLORS.text },
  emptyText:    { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 30 },
});

export default styles;
