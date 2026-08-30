import { StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },

  // Camera phase
  cameraWrap: { flex: 1, margin: SPACING.l, borderRadius: 28, overflow: 'hidden', backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 230, height: 230, borderRadius: 28, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  hint: { color: COLORS.white, fontSize: 14, fontWeight: '700', marginTop: 24, textAlign: 'center', paddingHorizontal: 30 },

  // Permission screen
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.l, gap: 12 },
  permTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 8 },
  permText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  permBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13, marginTop: 8 },
  permBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },

  // Post-scan phases (date_query + visit_list)
  body: { padding: SPACING.l, gap: 12 },

  patientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  patientAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  patientName: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  patientSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  sectionLabel: { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 4 },

  rangeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  rangeChip: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  rangeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  rangeChipText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  rangeChipTextActive: { color: COLORS.white },

  rangeHint: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },

  confirmBtn: { backgroundColor: COLORS.primary, borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  confirmBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },

  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },

  visitCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.surface, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  visitIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  visitDate: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  visitMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  visitStatus: { fontSize: 11, color: COLORS.primary, fontWeight: '700', marginTop: 3, textTransform: 'capitalize' },
});

export default styles;
