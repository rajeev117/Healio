// ─────────────────────────────────────────────────────────────────────────────
// DoctorNavigator — the doctor portal, namespaced as a role module inside the
// unified Healio provider app.
//
// The UI here is ported from the standalone healio-doctor-mobile app, rewired to
// the provider app's real Supabase backend (see ./services/doctorData.js and
// ../../lib/careFlow.js). The unified shell owns NavigationContainer /
// SafeAreaProvider / AuthContext; this module owns the doctor's own tabs/stack.
// Auth + logout flow back through the shell (AuthContext + lib/supabase.signOut).
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from './constants/theme';

import Home              from './screens/Home';
import Appointments      from './screens/Appointments';
import Schedule          from './screens/Schedule';
import RequestServices   from './screens/RequestServices';
import Profile           from './screens/Profile';
import AppointmentDetail from './screens/AppointmentDetail';
import UploadPrescription from './screens/UploadPrescription';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function DoctorTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor:  COLORS.border,
          height:          68 + insets.bottom,
          paddingBottom:   8 + insets.bottom,
          paddingTop:      6,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Home:         focused ? 'home'     : 'home-outline',
            Appointments: focused ? 'calendar' : 'calendar-outline',
            Schedule:     focused ? 'time'     : 'time-outline',
            Services:     focused ? 'flask'    : 'flask-outline',
            Profile:      focused ? 'person'   : 'person-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"         component={Home}            options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Appointments" component={Appointments}    options={{ tabBarLabel: 'Appts' }} />
      <Tab.Screen name="Schedule"     component={Schedule}        options={{ tabBarLabel: 'Schedule' }} />
      <Tab.Screen name="Services"     component={RequestServices} options={{ tabBarLabel: 'Services' }} />
      <Tab.Screen name="Profile"      component={Profile}         options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function DoctorNavigator({ initialRouteName = 'Main' }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Main"               component={DoctorTabs} />
      <Stack.Screen name="AppointmentDetail"  component={AppointmentDetail} />
      <Stack.Screen name="UploadPrescription" component={UploadPrescription} />
      <Stack.Screen name="RequestServices"    component={RequestServices} />
    </Stack.Navigator>
  );
}
