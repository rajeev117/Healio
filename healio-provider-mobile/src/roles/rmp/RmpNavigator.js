// ─────────────────────────────────────────────────────────────────────────────
// RmpNavigator — the RMP / health-worker portal, namespaced as a role module
// inside the unified Healio app.
//
// Lifted from the standalone RMP app's App.js. The unified shell owns the
// NavigationContainer/SafeAreaProvider and authentication, so the module's own
// Login/Signup screens are not registered here — the shell handles auth and
// resolves the 'rmp' role from the `rmps` table. RMP signup runs via the shell
// auth-stack route 'RmpSignup' (the module's Signup screen, wired to Supabase).
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from './constants/theme';
import { withFeature, useFeatureEnabled, hiddenTabOptions } from '../../components/FeatureGate';

import Dashboard from './screens/Dashboard';
import Bookings from './screens/Bookings';
import Patients from './screens/Patients';
import Earnings from './screens/Earnings';
import Profile from './screens/Profile';
import Services from './screens/Services';
import LinkPatient from './screens/LinkPatient';
import NewPatient from './screens/NewPatient';
import ConsentOTP from './screens/ConsentOTP';
import SelectPatientProfile from './screens/SelectPatientProfile';
import FindProvider from './screens/FindProvider';
import FindFacility from './screens/FindFacility';
import LabBooking from './screens/LabBooking';
import PharmacyOrder from './screens/PharmacyOrder';
import OrderRequestStatus from './screens/OrderRequestStatus';
import SlotSelection from './screens/SlotSelection';
import ReviewBooking from './screens/ReviewBooking';
import ServiceCharge from './screens/ServiceCharge';
import BookingConfirmed from './screens/BookingConfirmed';
import PaymentFailed from './screens/PaymentFailed';
import PatientJourney from './screens/PatientJourney';
import RmpQR from './screens/RmpQR';
import ManagePatient from './screens/ManagePatient';
import EmergencyAdmission from './screens/EmergencyAdmission';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Wrapped once at module scope: a component type created during render is a new
// type every pass, which remounts the screen and loses its state.
const GatedEarnings   = withFeature('rmp_payouts',             Earnings,           'Earnings & Payouts');
const GatedLinkPatient = withFeature('rmp_patient_linking',    LinkPatient,        'Patient Linking');
const GatedNewPatient  = withFeature('rmp_patient_linking',    NewPatient,         'Patient Linking');
const GatedManage      = withFeature('rmp_patient_linking',    ManagePatient,      'Patient Linking');
const GatedLabBooking  = withFeature('rmp_lab_booking',        LabBooking,         'Lab Booking');
const GatedPharmOrder  = withFeature('rmp_pharmacy_orders',    PharmacyOrder,      'Pharmacy Orders');
const GatedEmergency   = withFeature('rmp_emergency_admission', EmergencyAdmission, 'Emergency Admission');

function MainTabs() {
  const insets = useSafeAreaInsets();
  // Admin-controlled (migration-063). Hidden rather than removed so Dashboard's
  // jumps to sibling tabs still resolve.
  const payoutsOn  = useFeatureEnabled('rmp_payouts');
  const patientsOn = useFeatureEnabled('rmp_patient_linking');
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingBottom: 6 + insets.bottom,
          paddingTop: 4,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            Bookings: focused ? 'calendar' : 'calendar-outline',
            Patients: focused ? 'people' : 'people-outline',
            Earnings: focused ? 'wallet' : 'wallet-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={Dashboard} />
      <Tab.Screen name="Bookings" component={Bookings} />
      <Tab.Screen name="Patients" component={Patients}
        options={hiddenTabOptions(patientsOn)} />
      <Tab.Screen name="Earnings" component={GatedEarnings}
        options={hiddenTabOptions(payoutsOn)} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}

export default function RmpNavigator({ initialRouteName = 'Main' }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="Services" component={Services} />
      <Stack.Screen name="LinkPatient"        component={GatedLinkPatient} />
      <Stack.Screen name="NewPatient"         component={GatedNewPatient} />
      <Stack.Screen name="ConsentOTP" component={ConsentOTP} />
      <Stack.Screen name="SelectPatientProfile" component={SelectPatientProfile} />
      <Stack.Screen name="FindProvider" component={FindProvider} />
      {/* Lab / pharmacy / hospital: pick the facility, then its own flow. */}
      <Stack.Screen name="FindFacility" component={FindFacility} />
      <Stack.Screen name="RmpLabBooking"      component={GatedLabBooking} />
      <Stack.Screen name="RmpPharmacyOrder"   component={GatedPharmOrder} />
      <Stack.Screen name="OrderRequestStatus" component={OrderRequestStatus} />
      <Stack.Screen name="SlotSelection" component={SlotSelection} />
      <Stack.Screen name="ReviewBooking" component={ReviewBooking} />
      <Stack.Screen name="ServiceCharge" component={ServiceCharge} />
      <Stack.Screen name="BookingConfirmed" component={BookingConfirmed} />
      <Stack.Screen name="PaymentFailed" component={PaymentFailed} />
      <Stack.Screen name="PatientJourney" component={PatientJourney} />
      <Stack.Screen name="RmpQR" component={RmpQR} />
      <Stack.Screen name="ManagePatient"      component={GatedManage} />
      <Stack.Screen name="EmergencyAdmission" component={GatedEmergency} />
    </Stack.Navigator>
  );
}
