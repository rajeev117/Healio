import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useStore } from '../lib/store';
import { COLORS } from '../constants/theme';
import FeatureScreen from '../components/FeatureScreen';
import styles from './Subscription.styles';

export default function Subscription({ navigation }) {
  const businessProfile = useStore((state) => state.businessProfile);

  return (
    <FeatureScreen
      navigation={navigation}
      title="Subscription plan"
      subtitle="Your hospital's plan and billing status."
      badge="Test Mode"
      stats={[
        { label: 'Status', value: 'Test Mode', icon: 'shield-checkmark', tint: COLORS.warningSoft,  color: '#c05621' },
        { label: 'Plan',   value: 'Free',       icon: 'sparkles',         tint: COLORS.primarySoft },
      ]}
      primaryAction={{ label: 'Open earnings', onPress: () => navigation.navigate('Earnings') }}
      secondaryAction={{ label: 'Ledger',       onPress: () => navigation.navigate('Ledger') }}
      sections={[
        {
          title: 'Current plan',
          children: (
            <View style={styles.card}>
              <View style={styles.badgeRow}>
                <View style={styles.testBadge}>
                  <Text style={styles.testBadgeText}>TEST MODE</Text>
                </View>
              </View>

              <Text style={styles.planTitle}>Healio Provider — Test Phase</Text>
              <Text style={styles.planSub}>
                This project is currently in test mode. Subscription billing and
                payment processing are not yet active. All features are available
                for testing at no cost.
              </Text>

              <View style={styles.divider} />

              {[
                { label: 'Hospital',             value: businessProfile?.name || '—' },
                { label: 'City',                 value: businessProfile?.city || '—' },
                { label: 'Subscription billing', value: 'Not active (test mode)' },
                { label: 'Payment processing',   value: 'Not active (test mode)' },
              ].map(({ label, value }) => (
                <View key={label} style={styles.row}>
                  <Text style={styles.rowLabel}>{label}</Text>
                  <Text style={styles.rowValue}>{value}</Text>
                </View>
              ))}
            </View>
          ),
        },
      ]}
    />
  );
}
