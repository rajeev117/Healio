import { StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.l, paddingTop: SPACING.m },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center',
  },
  content: { flex: 1, paddingHorizontal: SPACING.l, paddingTop: SPACING.xl },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6, lineHeight: 20 },
  label: {
    fontSize: 12, fontWeight: '600', textTransform: 'uppercase',
    color: COLORS.textSecondary, letterSpacing: 0.5, marginTop: 35,
  },
  phoneRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cc: {
    width: 56, height: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
  },
  ccText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 16, fontWeight: '500', color: COLORS.text },
  primaryBtn: {
    backgroundColor: COLORS.primary, height: 54, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 28,
  },
  disabled: { opacity: 0.5 },
  primaryBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 20,
    padding: 14, backgroundColor: COLORS.surface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  noteText: { flex: 1, fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 40, gap: 14 },
  otpBox: {
    width: 60, height: 64, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, fontSize: 24, fontWeight: '800', color: COLORS.text,
    textAlign: 'center',
  },
  otpBoxFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.secondary },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: '#fff5f5', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: 10, padding: 10, marginTop: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: '#dc2626', fontWeight: '600' },
  errorHint: { fontSize: 12, color: '#b91c1c', marginTop: 3, lineHeight: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 18 },
  switchText: { fontSize: 13.5, color: COLORS.textSecondary },
  switchLink: { fontSize: 13.5, fontWeight: '700', color: COLORS.primary },
});

export default styles;
