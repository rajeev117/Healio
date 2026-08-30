import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    padding: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  label: { fontSize: 11, color: COLORS.textSecondary },
  balance: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  heldWrap: { marginLeft: 12, alignItems: 'flex-end' },
  heldLabel: { fontSize: 10, color: COLORS.textSecondary },
  heldValue: { fontSize: 12, fontWeight: '700', color: COLORS.error },
});

export default styles;
