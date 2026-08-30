import { StyleSheet } from 'react-native';
import { COLORS, SPACING, SIZES } from '../constants/theme';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingTop: SPACING.m, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  greeting:     { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  doctorName:   { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 2 },
  hospitalName: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  iconBtn: { padding: 8 },
  notifBtn: { position: 'relative', padding: 8 },
  notifDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.error,
  },
  statsRow: { flexDirection: 'row', padding: SPACING.m, gap: 10 },
  statCard: {
    flex: 1, padding: 12, borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', textAlign: 'center' },
  quickRow: {
    flexDirection: 'row', paddingHorizontal: SPACING.m, gap: 10, marginBottom: SPACING.m,
  },
  quickCard: {
    flex: 1, padding: 12, borderRadius: 16, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  quickLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },

  // Notification banner (typed — same palette as the hospital screen)
  banner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.m, paddingVertical: 11, backgroundColor: COLORS.primary,
  },
  bannerNew:     { backgroundColor: '#7c3aed' },
  bannerSuccess: { backgroundColor: '#059669' },
  bannerWarn:    { backgroundColor: '#d97706' },
  bannerText: { color: COLORS.white, fontSize: 13, fontWeight: '700', flex: 1, marginRight: 8 },

  // Booking requests
  pendingBadge: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#fef3c7', borderRadius: 20 },
  pendingBadgeText: { fontSize: 12, fontWeight: '800', color: '#92400e' },
  requestCard: {
    backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg,
    borderWidth: 1.5, borderColor: '#fbbf24', padding: SPACING.m, gap: 10,
  },
  requestTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reqAvatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  reqAvatarText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  reqName: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  reqMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  reqActions: { flexDirection: 'row', gap: 8 },
  reqAccept: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: 12, backgroundColor: COLORS.primary,
  },
  reqAcceptText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  reqDecline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fff5f5',
  },
  reqDeclineText: { color: '#dc2626', fontWeight: '700', fontSize: 13 },

  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: COLORS.successSoft,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  liveText: { fontSize: 11, fontWeight: '700', color: COLORS.success },
  queueList: { paddingHorizontal: SPACING.m, gap: 10 },
  queueCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: SPACING.m, backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusLg, borderWidth: 1, borderColor: COLORS.border,
  },
  tokenBadge: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center',
  },
  tokenNo: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  queueInfo: { flex: 1 },
  queueNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  queueName: { fontSize: 14, fontWeight: '800', color: COLORS.text, flex: 1, marginRight: 8 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '700' },
  queueMeta: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 3 },
  queueTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  queueTime: { fontSize: 11, color: COLORS.textSecondary },
  consultBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  consultBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },
  doneBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center',
  },
});

export default styles;
