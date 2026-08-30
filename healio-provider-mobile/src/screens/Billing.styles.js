import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const styles = StyleSheet.create({
  testBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.warningSoft, borderRadius: 10, padding: 10,
  },
  testBannerText: {
    flex: 1, fontSize: 12, color: '#c05621', fontWeight: '600', lineHeight: 17,
  },
  empty: {
    color: COLORS.textSecondary, fontSize: 13, lineHeight: 20,
    textAlign: 'center', paddingVertical: 10,
  },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 16, padding: 14,
  },
  cardTitle:  { fontWeight: '800', color: COLORS.text },
  cardSub:    { marginTop: 2, color: COLORS.textSecondary, fontSize: 12 },
  cardAmount: { fontWeight: '800', color: COLORS.primary },
  cardStatus: { marginTop: 2, fontWeight: '700', fontSize: 11 },
});

export default styles;
