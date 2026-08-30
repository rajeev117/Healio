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

  content: { padding: SPACING.m, gap: 12 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: SIZES.radiusLg,
  },
  statusText: { fontSize: 16, fontWeight: '800', flex: 1 },
  orderIdBadge: {
    fontSize: 11, fontWeight: '700',
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },

  card: {
    backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.m,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textSecondary,
    letterSpacing: 0.5, marginBottom: 12,
  },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailIcon: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  detailKey: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 2 },
  detailVal: { fontSize: 14, color: COLORS.text, fontWeight: '700', flexShrink: 1 },

  patientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontWeight: '800', fontSize: 16, color: COLORS.primary },
  patientName: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  patientMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  patientPhone: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  steps: {
    flexDirection: 'row', alignItems: 'center',
  },
  stepItem: { alignItems: 'center', gap: 6, flex: 1 },
  stepDot: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  stepLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  stepLine: { height: 2, flex: 0.3, backgroundColor: COLORS.border, marginBottom: 14 },
  cancelledNote: { fontSize: 12, color: '#9b2c2c', fontWeight: '600', marginTop: 10, textAlign: 'center' },

  actionsCard: {
    backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.m,
  },
  actionBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  actionBtnDanger: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.error,
  },
  actionBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
  actionBtnTextDanger: { color: COLORS.error },
});

export default styles;
