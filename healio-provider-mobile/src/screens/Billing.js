import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FeatureScreen from '../components/FeatureScreen';
import { COLORS } from '../constants/theme';
import { useStore } from '../lib/store';
import { useFocusEffect } from '@react-navigation/native';
import styles from './Billing.styles';

const inr = (n) => {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v}`;
};

export default function Billing({ navigation }) {
  const available   = useStore((s) => s.availableEarnings || 0);
  const pending     = useStore((s) => s.pendingEarnings || 0);
  const ledger      = useStore((s) => s.ledger || []);
  const loadEarnings = useStore((s) => s.loadEarnings);

  useFocusEffect(
    React.useCallback(() => { loadEarnings(); }, [loadEarnings])
  );

  const recent = ledger.slice(0, 5);

  return (
    <FeatureScreen
      navigation={navigation}
      title="Billing & invoices"
      subtitle="Earnings from completed consultations, pharmacy, and lab orders."
      badge="Test Mode"
      stats={[
        { label: 'Collected', value: inr(available), icon: 'cash',  tint: COLORS.primarySoft },
        { label: 'Pending',   value: inr(pending),   icon: 'time',  tint: '#fdf6e2', color: '#c05621' },
      ]}
      primaryAction={{ label: 'Open ledger', onPress: () => navigation.navigate('Ledger') }}
      secondaryAction={{ label: 'Reports',    onPress: () => navigation.navigate('Reports') }}
      sections={[
        {
          title: 'Recent transactions',
          children: (
            <View style={{ gap: 10 }}>
              {/* Test mode notice */}
              <View style={styles.testBanner}>
                <Ionicons name="flask-outline" size={14} color="#c05621" />
                <Text style={styles.testBannerText}>
                  Running in test mode — payment processing is not yet active.
                  Earnings shown are from test appointments only.
                </Text>
              </View>

              {recent.length === 0 ? (
                <Text style={styles.empty}>
                  No transactions yet.{'\n'}Complete an appointment to see earnings here.
                </Text>
              ) : (
                recent.map((item) => (
                  <View key={item.id} style={styles.card}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{item.type || 'Transaction'}</Text>
                      <Text style={styles.cardSub}>
                        {item.reference || '—'}
                        {item.date ? ` · ${new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.cardAmount}>
                        ₹{Number(item.net || 0).toLocaleString('en-IN')}
                      </Text>
                      <Text style={[
                        styles.cardStatus,
                        { color: item.status === 'available' ? COLORS.success : '#c05621' },
                      ]}>
                        {item.status === 'available' ? 'Collected' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          ),
        },
      ]}
    />
  );
}
