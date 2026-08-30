import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { useWallet } from '../context/WalletContext';

export default function HealioPlusPayment({ navigation, route }) {
  const { t } = useLanguage();
  const { balance, addBalance } = useWallet();
  const userName = route?.params?.userName || '';
  
  const [selectedAmount, setSelectedAmount] = useState(50); // Default to 50
  const [loading, setLoading] = useState(false);

  const handlePayment = () => {
    setLoading(true);
    // Simulate payment delay
    setTimeout(() => {
      setLoading(false);
      addBalance(selectedAmount);
      Alert.alert(
        "Payment Successful",
        `₹${selectedAmount} has been added to your Healio wallet. Your booking access is now unlocked!`,
        [
          {
            text: "Go to Home",
            onPress: () => {
              navigation.replace('ProfileSelector', { userName: userName || 'User' });
            }
          }
        ]
      );
    }, 1200);
  };

  const handleSkip = () => {
    navigation.replace('ProfileSelector', { userName: userName || 'User' });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipBtnText}>{t('skip_for_now') || 'Skip for now'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Plus Badge & Title */}
        <View style={styles.headlineSection}>
          <View style={styles.plusBadge}>
            <Ionicons name="star" size={20} color={COLORS.white} />
            <Text style={styles.plusBadgeText}>HEALIO PLUS</Text>
          </View>
          <Text style={styles.title}>Activate Booking Access</Text>
          <Text style={styles.subtitle}>
            Keep a minimum credit of ₹50 in your wallet to book appointments with doctors and hospitals.
          </Text>
        </View>

        {/* Current Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceInfo}>
            <Text style={styles.balanceLabel}>Current Wallet Balance</Text>
            <Text style={styles.balanceValue}>₹{balance}</Text>
          </View>
          <View style={styles.statusIndicator}>
            <Ionicons 
              name={balance >= 50 ? "checkmark-circle" : "warning"} 
              size={20} 
              color={balance >= 50 ? COLORS.success : COLORS.error} 
            />
            <Text style={[styles.statusText, { color: balance >= 50 ? COLORS.success : COLORS.error }]}>
              {balance >= 50 ? "Booking Unlocked" : "Booking Locked (Requires min ₹50)"}
            </Text>
          </View>
        </View>

        {/* Credit Perks */}
        <View style={styles.perksContainer}>
          <Text style={styles.sectionTitle}>Why activate Healio Plus?</Text>
          {[
            { icon: 'videocam-outline', title: 'Unlimited Video Consultations', desc: 'Consult top doctors from the comfort of your home' },
            { icon: 'business-outline', title: 'Priority Hospital Bookings', desc: 'Get faster admissions and appointments nearby' },
            { icon: 'shield-checkmark-outline', title: '100% Secure Payments', desc: 'Dummy credit system for test mode access' }
          ].map((perk, idx) => (
            <View key={idx} style={styles.perkRow}>
              <View style={styles.perkIconBg}>
                <Ionicons name={perk.icon} size={20} color={COLORS.primary} />
              </View>
              <View style={styles.perkTextContent}>
                <Text style={styles.perkTitle}>{perk.title}</Text>
                <Text style={styles.perkDesc}>{perk.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Amount Selector */}
        <View style={styles.amountSection}>
          <Text style={styles.sectionTitle}>Select Deposit Amount</Text>
          <View style={styles.amountPills}>
            {[50, 100, 200].map((amt) => {
              const isSelected = selectedAmount === amt;
              return (
                <TouchableOpacity
                  key={amt}
                  style={[styles.amountPill, isSelected && styles.amountPillSelected]}
                  onPress={() => setSelectedAmount(amt)}
                >
                  <Text style={[styles.amountPillText, isSelected && styles.amountPillTextSelected]}>
                    ₹{amt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payBtn, loading && styles.payBtnDisabled]}
          onPress={handlePayment}
          disabled={loading}
        >
          <Ionicons name="wallet-outline" size={20} color={COLORS.white} />
          <Text style={styles.payBtnText}>
            {loading ? "Processing Deposit..." : `Deposit ₹${selectedAmount} (Dummy)`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.xl,
  },
  headlineSection: {
    alignItems: 'center',
    marginVertical: SPACING.m,
  },
  plusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: SPACING.m,
  },
  plusBadgeText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  balanceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: SPACING.m,
    marginVertical: SPACING.m,
  },
  balanceInfo: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.m,
    marginBottom: SPACING.s,
  },
  balanceLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.primary,
    marginTop: 4,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  perksContainer: {
    marginVertical: SPACING.s,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.m,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  perkIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.m,
  },
  perkTextContent: {
    flex: 1,
  },
  perkTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  perkDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  amountSection: {
    marginVertical: SPACING.m,
  },
  amountPills: {
    flexDirection: 'row',
    gap: 12,
  },
  amountPill: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountPillSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondary,
  },
  amountPillText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  amountPillTextSelected: {
    color: COLORS.primary,
  },
  footer: {
    padding: SPACING.l,
    paddingTop: SPACING.s,
  },
  payBtn: {
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  payBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
  payBtnDisabled: {
    opacity: 0.6,
  },
});
