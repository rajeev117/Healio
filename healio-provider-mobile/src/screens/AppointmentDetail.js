import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../lib/store';
import { COLORS } from '../constants/theme';
import FeatureScreen from '../components/FeatureScreen';
import styles from './AppointmentDetail.styles';

export default function AppointmentDetail({ navigation, route }) {
  const apptId = route?.params?.appointmentId;
  const appointment = useStore((state) => state.appointmentsList.find((item) => item.id === apptId));
  const doctor = useStore((state) => state.doctors.find((item) => item.name === appointment?.doctor));
  const updateAppointmentStatus = useStore((state) => state.updateAppointmentStatus);

  const handleComplete = async () => {
    if (!appointment) { navigation.goBack(); return; }
    const ok = await updateAppointmentStatus(appointment.id, 'completed');
    Alert.alert(ok ? 'Marked complete' : 'Saved locally', ok ? 'Appointment marked as completed.' : 'Could not reach the server.');
    navigation.goBack();
  };

  return (
    <FeatureScreen
      navigation={navigation}
      title={appointment ? `${appointment.patient}` : 'Appointment detail'}
      subtitle={appointment ? `${appointment.doctor} · ${appointment.type} · ${appointment.time}` : 'Open consult details and move the case forward.'}
      badge="Appointment detail"
      primaryAction={{ label: 'Mark complete', onPress: handleComplete }}
      secondaryAction={{ label: 'Open patient', onPress: () => navigation.navigate('Main', { screen: 'Patients', params: { patientId: appointment?.patientId } }) }}
      sections={[
        {
          title: 'Visit summary',
          children: (
            <View style={{ gap: 12 }}>
              {appointment?.bookedByRmp ? (
                <View style={styles.rmpBanner}>
                  <Ionicons name="people-outline" size={18} color="#6b46c1" />
                  <Text style={styles.rmpBannerText}>Booked through Healthcare Consultant · 3rd party</Text>
                </View>
              ) : null}
              <View style={styles.grid}>
                <View style={styles.infoCard}><Text style={styles.infoLabel}>Status</Text><Text style={styles.infoValue}>{appointment?.status || 'pending'}</Text></View>
                <View style={styles.infoCard}><Text style={styles.infoLabel}>Visit type</Text><Text style={styles.infoValue}>{appointment?.type || 'OPD'}</Text></View>
                <View style={styles.infoCard}><Text style={styles.infoLabel}>Patient ID</Text><Text style={styles.infoValue}>{appointment?.patientId || '-'}</Text></View>
                <View style={styles.infoCard}><Text style={styles.infoLabel}>Time</Text><Text style={styles.infoValue}>{appointment?.time || '-'}</Text></View>
              </View>
            </View>
          ),
        },
        {
          title: 'Quick actions',
          children: (
            <View style={styles.actions}>
              {['Start consultation', 'Add notes', 'Add prescription', 'Book lab'].map((item) => (
                <TouchableOpacity key={item} style={styles.actionRow} onPress={() => navigation.navigate('PatientActions', { patientId: appointment?.patientId })}>
                  <Text style={styles.actionText}>{item}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('DoctorDetail', { doctorId: doctor?.id })}>
                <Text style={styles.actionText}>Open doctor profile</Text>
              </TouchableOpacity>
            </View>
          ),
        },
      ]}
    />
  );
}
