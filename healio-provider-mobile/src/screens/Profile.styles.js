import { StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.l,
    paddingBottom: 40,
    gap: 20,
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 24,
    marginTop: SPACING.m,
  },
  hospitalLogoBox: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    overflow: 'hidden',
  },
  hospitalLogoImage: {
    width: '100%',
    height: '100%',
  },
  hospitalName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  hospitalMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCell: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  statVal: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  menuSection: {
    gap: 8,
  },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    paddingLeft: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuValueText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: 'rgba(220, 53, 69, 0.15)',
    height: 52,
    borderRadius: 16,
    gap: 8,
    marginTop: 10,
  },
  logoutText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '700',
  },
  versionText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '500',
  },
});

export default styles;
