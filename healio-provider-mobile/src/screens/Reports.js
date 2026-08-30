import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FeatureScreen from '../components/FeatureScreen';
import { COLORS } from '../constants/theme';
import { useStore } from '../lib/store';
import { useFocusEffect } from '@react-navigation/native';
import styles from './Reports.styles';

const inr = (n) => {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v}`;
};

export default function Reports({ navigation }) {
  const available = useStore((s) => s.availableEarnings || 0);
  const trend = useStore((s) => s.homeTrend || [0, 0, 0, 0, 0, 0, 0]);
  const appointments = useStore((s) => s.appointmentsList);
  const pendingAdmits = useStore((s) => s.pendingAdmits);
  const loadHomeDashboard = useStore((s) => s.loadHomeDashboard);
  const loadAppointmentsList = useStore((s) => s.loadAppointmentsList);
  const loadEarnings = useStore((s) => s.loadEarnings);

  useFocusEffect(
    React.useCallback(() => {
      loadHomeDashboard();
      loadAppointmentsList();
      loadEarnings();
    }, [loadHomeDashboard, loadAppointmentsList, loadEarnings])
  );

  const completed = appointments.filter((a) => a.status === 'completed').length;
  const max = Math.max(...trend, 1);
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <FeatureScreen
      navigation={navigation}
      title="Reports & analytics"
      subtitle="Revenue, activity, and operational summaries for your hospital."
      badge="Live"
      stats={[
        { label: 'Earnings', value: inr(available), icon: 'trending-up', tint: '#ebfaf0', color: '#2f855a' },
        { label: 'Appointments', value: String(appointments.length), icon: 'people', tint: COLORS.primarySoft },
        { label: 'Completed', value: String(completed), icon: 'checkmark-done', tint: '#eef6ff', color: '#2b6cb0' },
        { label: 'Home care', value: String(pendingAdmits), icon: 'home', tint: '#fdf6e2', color: '#c05621' },
      ]}
      primaryAction={{ label: 'Open billing', onPress: () => navigation.navigate('Billing') }}
      secondaryAction={{ label: 'Open settings', onPress: () => navigation.navigate('Settings') }}
      sections={[
        {
          title: 'Revenue — last 7 days',
          children: (
            <View style={styles.chartRow}>
              {trend.map((value, index) => (
                <View key={index} style={styles.barColumn}>
                  <View style={[styles.bar, { height: Math.max(6, (value / max) * 170) }]} />
                  <Text style={styles.barLabel}>{dayLabels[index]}</Text>
                </View>
              ))}
            </View>
          ),
        },
      ]}
    />
  );
}
