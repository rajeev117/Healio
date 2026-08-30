import { StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  notifBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#059669', paddingHorizontal: SPACING.m, paddingVertical: 11,
  },
  notifBannerText: { color: COLORS.white, fontSize: 13, fontWeight: '700', flex: 1, marginRight: 8 },
  header: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: SPACING.m,
    backgroundColor: COLORS.surface,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  tabLabelActive: {
    color: COLORS.white,
  },
  listContent: {
    padding: SPACING.l,
    gap: 12,
  },

  // Admissions sub-tabs (Emergency / Planned)
  subTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  subTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  subTabActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  subTabTextActive: {
    color: COLORS.primary,
  },

  // Service setup (empty) state
  setupContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.l * 1.5,
    paddingBottom: 80,
    gap: 12,
  },
  setupIcon: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  setupTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  setupBlurb: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  setupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    height: 50,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  setupBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },

  // Connected banner above the orders list
  connectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: SPACING.l,
    marginTop: SPACING.m,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ebfaf0',
    borderWidth: 1,
    borderColor: '#cdeed8',
  },
  connectedText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#2f855a',
  },
  addMoreBtn: {
    width: 28,
    height: 28,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Per-member team list (so "edit" and "add another" are obvious, not buried
  // in a tiny icon button).
  teamList: {
    marginHorizontal: SPACING.l,
    marginTop: 10,
    gap: 8,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  teamAvatar: {
    width: 30, height: 30, borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  teamName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  teamSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  teamEditBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.primary,
  },
  teamEditText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  addAnotherBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed',
    backgroundColor: COLORS.primarySoft,
  },
  addAnotherText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  // Add-controller modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  closeModalBtn: {
    width: 36,
    height: 36,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
  },
  modalBlurb: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: 18,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 14,
  },
  formInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  formInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  ccPrefix: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  formHint: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  // Emergency admission — QR scan-to-fill
  scanQrBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed',
    backgroundColor: COLORS.primarySoft,
  },
  scanQrText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  scannedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12,
    backgroundColor: '#ebfaf0', borderWidth: 1, borderColor: '#cdeed8',
  },
  scannedName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  scannedMeta: { fontSize: 11, color: '#2f855a', fontWeight: '600', marginTop: 1 },

  // Full-screen patient QR scanner
  scanSafe: { flex: 1, backgroundColor: COLORS.background },
  scanHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.l, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  scanTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  scanCameraWrap: { flex: 1, overflow: 'hidden' },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  scanFrame: {
    width: 230, height: 230, borderRadius: 24,
    borderWidth: 3, borderColor: COLORS.white,
    backgroundColor: 'transparent',
  },
  scanHint: {
    marginTop: 18, paddingHorizontal: 40,
    fontSize: 13, fontWeight: '600', color: COLORS.white, textAlign: 'center',
  },

  deptWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deptChip: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: COLORS.surface,
  },
  deptChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  deptChipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  deptChipTextActive: { color: COLORS.white },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDetails: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    marginTop: 4,
  },
  footerLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  footerVal: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Billing styles
  billingContent: {
    padding: SPACING.l,
    gap: 20,
  },
  billingSummaryCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    padding: 24,
    shadowColor: COLORS.primary,
  },
  ledgerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ledgerTitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 38,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 12,
  },
  summarySub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    fontWeight: '500',
  },
  ledgerSection: {
    gap: 12,
  },
  ledgerSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  txnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 14,
    gap: 12,
  },
  txnIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txnDetails: {
    flex: 1,
  },
  txnDesc: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  txnMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  txnAmtContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  txnAmt: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  txnStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ebfaf0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  txnStatusText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#2f855a',
  },
});

export default styles;
