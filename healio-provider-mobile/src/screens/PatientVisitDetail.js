import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useStore } from '../lib/store';
import { COLORS } from '../constants/theme';
import FeatureScreen from '../components/FeatureScreen';
import styles from './PatientVisitDetail.styles';

export default function PatientVisitDetail({ navigation, route }) {
  const patient = useStore((state) => state.patients.find((item) => item.id === route?.params?.patientId) || state.patients[0]);

  return (
    <FeatureScreen
      navigation={navigation}
      title={patient ? `${patient.name} visit` : 'Visit detail'}
      subtitle="Clinical notes, follow-up actions, and prescription-ready placeholders live here."
      badge="Visit detail"
      primaryAction={{ label: 'Open patient', onPress: () => navigation.navigate('Main', { screen: 'Patients', params: { patientId: patient?.id } }) }}
      secondaryAction={{ label: 'Add action', onPress: () => navigation.navigate('PatientActions', { patientId: patient?.id }) }}
      sections={[
        {
          title: 'Timeline',
          children: (
            <View style={{ gap: 10 }}>
              {[
                'Vitals captured',
                'Clinical note added',
                'Prescription drafted',
                'Follow-up scheduled',
              ].map((item, index) => (
                <View key={item} style={styles.timelineRow}>
                  <View style={styles.stepDot} />
                  <Text style={styles.timelineText}>{index + 1}. {item}</Text>
                </View>
              ))}
            </View>
          ),
        },
        {
          title: 'Next actions',
          children: (
            <View style={{ gap: 10 }}>
              {['Review lab results', 'Close visit', 'Create discharge summary'].map((item) => (
                <TouchableOpacity key={item} style={styles.actionCard} onPress={() => navigation.navigate('PatientActions', { patientId: patient?.id })}>
                  <Text style={styles.actionText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ),
        },
      ]}
    />
  );
}
