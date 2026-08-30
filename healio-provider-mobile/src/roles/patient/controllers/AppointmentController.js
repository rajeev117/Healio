import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ApiService } from '../services/ApiService';
import { Alert } from 'react-native';


export const useAppointments = (status = 'Upcoming') => {
  const [loading, setLoading]         = useState(true);
  const [appointments, setAppointments] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ApiService.getAppointments();
      setAppointments(data.filter(a => a.status === status));
    } catch (error) {
      console.error('Appointments controller error:', error);
    } finally {
      setLoading(false);
    }
  }, [status]);

  // Re-fetch every time this screen gains focus (catches post-booking navigation)
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // Optimistic cancel:
  //  1. Remove the card from local state immediately → instant visual feedback
  //  2. Call the API in the background
  //  3. On failure → roll back by re-fetching the real data
  const cancelAppointment = useCallback(async (id) => {
    // Optimistic: remove card from UI immediately
    setAppointments(prev => prev.filter(a => a.id !== id));
    // Service registers the ID in _localCancelled so re-fetches never bring it back
    await ApiService.cancelAppointment(id);
  }, []);

  const handleReschedule = async (appointment) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay  = now.getDay();

    const doctors = await ApiService.getDoctors();
    const doctor  = doctors.find(d => d.name === appointment.doctorName);

    if (doctor?.workingHours) {
      const { start, end, days } = doctor.workingHours;
      if (!days.includes(currentDay) || currentHour < start || currentHour >= end) {
        const msg = !days.includes(currentDay)
          ? "Today is the doctor's day off."
          : `Doctor's working hours are ${start}:00–${end}:00.`;
        Alert.alert('Outside Working Hours', `Cannot reschedule right now. ${msg}`, [{ text: 'OK' }]);
        return;
      }
    }

    Alert.alert('Reschedule Appointment',
      `Reschedule your appointment with ${appointment.doctorName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Reschedule', onPress: () => Alert.alert('Request Sent', 'Our team will contact you to confirm the new slot.') },
      ]
    );
  };

  const handleBookAppointment = async (doctor, navigation) => {
    const now = new Date();
    if (doctor.workingHours) {
      const { start, end, days } = doctor.workingHours;
      if (!days.includes(now.getDay()) || now.getHours() < start || now.getHours() >= end) {
        const message = !days.includes(now.getDay())
          ? 'The doctor is not available today.'
          : `The doctor is only available between ${start}:00 and ${end}:00.`;
        Alert.alert('Doctor Unavailable', `${message}\nWould you like to book for the next available slot?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Book Next Slot', onPress: () => Alert.alert('Request Sent', 'We will notify you once the slot is confirmed.') },
          ]
        );
        return;
      }
    }
    Alert.alert('Confirm Booking',
      `Book an appointment with ${doctor.name} for ₹${doctor.fee || '500'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => { Alert.alert('Success', 'Appointment booked!'); navigation.navigate('Main', { screen: 'Appointments' }); } },
      ]
    );
  };

  return { loading, appointments, refresh: fetchData, cancelAppointment, handleReschedule, handleBookAppointment };
};
