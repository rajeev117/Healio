import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 10 },
  coords: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600', textAlign: 'center' },
  confirmBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  confirmText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
});

export default styles;
