// ─────────────────────────────────────────────────────────────────────────────
// IndependentDoctorNavigator — a solo practitioner who is NOT attached to a
// hospital. Their own organisations row (type 'clinic'), their own single staff
// row inside it, their own patients, their own hours.
//
// The hospital-affiliated sibling is src/roles/doctor/. That module assumes a
// doctor staff row created by a hospital admin, with a front desk confirming
// bookings before the doctor ever sees them. This one assumes nobody else is in
// the building: the doctor accepts their own bookings, sets their own schedule,
// maintains their own public profile, and refers OUT to external labs and
// pharmacies rather than down the corridor. They intentionally share the
// appointments / doctor_schedules / qr_checkins tables and nothing else.
//
// As with every role module, the unified shell owns the NavigationContainer /
// SafeAreaProvider and authentication, so no Login screen is registered here.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from './constants/theme';
import { withFeature, useFeatureEnabled, hiddenTabOptions } from '../../components/FeatureGate';

import Home from './screens/Home';
import Appointments from './screens/Appointments';
import Schedule from './screens/Schedule';
import Profile from './screens/Profile';
import AppointmentDetail from './screens/AppointmentDetail';
import UploadPrescription from './screens/UploadPrescription';
import Referrals from './screens/Referrals';
import DoctorQR from './screens/DoctorQR';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Wrapped once at module scope: a component type created during render is a new
// type every pass, which remounts the screen and loses its state.
const GatedSchedule    = withFeature('doctor_schedule',            Schedule,           'Schedule Management');
const GatedUploadRx    = withFeature('doctor_prescription_upload', UploadPrescription, 'Prescription Upload');
const GatedReferrals   = withFeature('doctor_referrals',           Referrals,          'Referrals');
const GatedDoctorQR    = withFeature('doctor_qr',                  DoctorQR,           'Doctor QR Code');

function MainTabs() {
  const insets = useSafeAreaInsets();
  // Admin-controlled (migration-063). Hidden rather than removed so anything
  // navigating to 'Schedule' by name still resolves.
  const scheduleOn = useFeatureEnabled('doctor_schedule');
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarShowLabel: false,
        tabBarItemStyle: { paddingVertical: 8 },
        // + insets.bottom so the bar clears the Android navigation bar; the
        // app draws edge-to-edge, so nothing reserves that space for us.
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
          borderTopColor: COLORS.border,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            Appointments: focused ? 'calendar' : 'calendar-outline',
            Schedule: focused ? 'time' : 'time-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Appointments" component={Appointments} />
      <Tab.Screen name="Schedule" component={GatedSchedule}
        options={hiddenTabOptions(scheduleOn)} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}

export default function IndependentDoctorNavigator({ initialRouteName = 'Main' }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="AppointmentDetail" component={AppointmentDetail} />
      <Stack.Screen name="UploadPrescription" component={GatedUploadRx} />
      <Stack.Screen name="Referrals"          component={GatedReferrals} />
      <Stack.Screen name="DoctorQR"           component={GatedDoctorQR} />
    </Stack.Navigator>
  );
}
