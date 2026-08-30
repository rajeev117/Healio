import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
  },
  infoLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  infoValue: { marginTop: 6, fontSize: 14, fontWeight: '700', color: COLORS.text },
  rmpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#e9d8fd',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rmpBannerText: { fontSize: 13, fontWeight: '700', color: '#6b46c1' },
  actions: { gap: 10 },
  actionRow: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
  },
  actionText: { color: COLORS.text, fontWeight: '600' },
});

export default styles;
