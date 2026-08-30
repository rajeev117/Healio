import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const styles = StyleSheet.create({
  stack: { gap: 10 },
  text: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  linkBtn: {
    marginTop: 6,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 14,
    padding: 12,
  },
  linkText: { color: COLORS.primary, fontWeight: '700' },
});

export default styles;
