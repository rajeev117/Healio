import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useStore } from '../lib/store';
import { COLORS } from '../constants/theme';
import FeatureScreen from '../components/FeatureScreen';
import styles from './DoctorDetail.styles';

export default function DoctorDetail({ navigation, route }) {
  const doctor = useStore((state) => state.doctors.find((item) => item.id === route?.params?.doctorId) || state.doctors[0]);
  const appointmentsToday = doctor?.today || 0;

  return (
    <FeatureScreen
      navigation={navigation}
      title={doctor ? doctor.name : 'Doctor detail'}
      subtitle={doctor ? `${doctor.speciality} · ${doctor.department}` : 'Profile, schedule, and visit management.'}
      badge="Doctor profile"
      stats={[
        { label: 'Today', value: appointmentsToday, icon: 'calendar', tint: COLORS.primarySoft },
        { label: 'Rating', value: doctor?.rating ? doctor.rating.toFixed(1) : 'New', icon: 'star', tint: '#fff5f5', color: '#c05621' },
      ]}
      primaryAction={{ label: 'Open schedule', onPress: () => navigation.navigate('DoctorSchedule', { doctorId: doctor?.id }) }}
      secondaryAction={{ label: 'Edit profile', onPress: () => navigation.navigate('Main', { screen: 'Doctors' }) }}
      sections={[
        {
          title: 'Contact and fee',
          children: (
            <View style={styles.stack}>
              <Text style={styles.text}>Fee: {doctor?.fee || '-'}</Text>
              <Text style={styles.text}>Phone: {doctor?.phone || '-'}</Text>
              <Text style={styles.text}>Email: {doctor?.email || '-'}</Text>
              <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('DoctorSchedule', { doctorId: doctor?.id })}>
                <Text style={styles.linkText}>View availability and shifts</Text>
              </TouchableOpacity>
            </View>
          ),
        },
      ]}
    />
  );
}
