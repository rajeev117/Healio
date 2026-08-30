import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const styles = StyleSheet.create({
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  timelineText: { color: COLORS.text, fontWeight: '600', flex: 1 },
  actionCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
  },
  actionText: { color: COLORS.text, fontWeight: '700' },
});

export default styles;
