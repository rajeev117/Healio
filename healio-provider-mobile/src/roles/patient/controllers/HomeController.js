import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ApiService } from '../services/ApiService';

export const useHomeData = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [upcomingAppointment, setUpcomingAppointment] = useState(null);
  const [services, setServices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [topDoctors, setTopDoctors] = useState([]);
  const [topHospitals, setTopHospitals] = useState([]);
  const [bookedDoctorNames, setBookedDoctorNames] = useState(new Set());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [userData, appointmentsData, servicesData, locationData, doctorsData, hospitalsData] = await Promise.all([
        ApiService.getUser(),
        ApiService.getAppointments(),
        ApiService.getServices(),
        ApiService.getLocations(),
        ApiService.getDoctors(),
        ApiService.getHospitals(),
      ]);

      setUser(userData);
      setLocations(locationData);
      // Preserve user-selected location; only set default on first load
      setCurrentLocation(prev => prev || locationData[0]);
      setUpcomingAppointment(appointmentsData.find(a => a.status === 'Upcoming'));
      setServices(servicesData.slice(0, 4));
      setTopDoctors(doctorsData.slice(0, 3));
      setTopHospitals(hospitalsData.slice(0, 2));

      // Track doctors with active bookings so the home card shows "Booked"
      const booked = new Set(
        appointmentsData
          .filter(a => ['scheduled', 'in_progress', 'suggested', 'Upcoming'].includes(a.rawStatus || a.status))
          .map(a => a.doctorName)
      );
      setBookedDoctorNames(booked);
    } catch (error) {
      console.error('Home controller error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch every time Home screen gains focus — catches post-booking navigation
  useFocusEffect(
    useCallback(() => { fetchData(); }, [fetchData])
  );

  return {
    loading,
    user,
    upcomingAppointment,
    services,
    locations,
    currentLocation,
    topDoctors,
    topHospitals,
    bookedDoctorNames,
    selectLocation: (loc) => setCurrentLocation(loc),
    refresh: fetchData,
  };
};
