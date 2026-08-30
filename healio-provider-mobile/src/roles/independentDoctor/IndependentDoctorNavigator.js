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

function MainTabs() {
  const insets = useSafeAreaInsets();
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
      <Tab.Screen name="Schedule" component={Schedule} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}

export default function IndependentDoctorNavigator({ initialRouteName = 'Main' }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="AppointmentDetail" component={AppointmentDetail} />
      <Stack.Screen name="UploadPrescription" component={UploadPrescription} />
      <Stack.Screen name="Referrals" component={Referrals} />
      <Stack.Screen name="DoctorQR" component={DoctorQR} />
    </Stack.Navigator>
  );
}
