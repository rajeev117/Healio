import { StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.m,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
  },
  scanBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginTop: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  tabsContainer: {
    gap: 8,
    marginTop: 16,
    paddingRight: 20,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.white,
  },
  listContent: {
    padding: SPACING.l,
    gap: 12,
  },
  emptyContainer: {
    paddingTop: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  patientCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  patientCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  patientAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientBasicInfo: {
    flex: 1,
  },
  patientNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  patientMetaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  patientCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    marginTop: 4,
  },
  visitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visitText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  statusPillSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusTextSmall: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  // Dossier dossier styling
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  detailScrollContent: {
    padding: SPACING.l,
    gap: 16,
  },
  profileHeaderCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  detailId: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  detailActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    alignSelf: 'stretch',   // fills full card width
  },
  detailActionBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  detailActionBtnSoft: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  admitBtn: {
    flex: 1,
    backgroundColor: COLORS.success,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dischargeBtn: {
    backgroundColor: '#c05621',
  },
  assignDoctorBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    alignSelf: 'stretch', marginTop: 10, paddingVertical: 11, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft,
  },
  assignDoctorText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },

  // Assign-doctor modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  closeModalBtn: {
    width: 36, height: 36, borderRadius: 16,
    backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center',
  },
  modalSub: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginBottom: 14 },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  docAvatar: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center',
  },
  docName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  docSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  docEmpty: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 24 },
  detailActionText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
  detailActionTextSoft: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  metaBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contactValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  clinicalGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  clinicalCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 16,
  },
  clinicalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
    marginBottom: 8,
  },
  clinicalTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
  },
  clinicalBullet: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 4,
  },
  clinicalEmpty: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  timeline: {
    marginTop: 4,
    gap: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    gap: 2,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineDate: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  timelineDoc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  timelineStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  // Appointment status pill
  apptStatusPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  apptStatusText: { fontSize: 10, fontWeight: '700' },
  // Appointment action buttons (inside dossier)
  apptActions: {
    flexDirection: 'row', gap: 8, marginLeft: 20,
  },
  apptBtnAccept: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.primary,
  },
  apptBtnAcceptText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },
  apptBtnDecline: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fff5f5',
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  apptBtnDeclineText: { color: '#dc2626', fontWeight: '700', fontSize: 12 },
  apptBtnSuggest: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.white,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  apptBtnSuggestText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  timelineNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
});

export default styles;
