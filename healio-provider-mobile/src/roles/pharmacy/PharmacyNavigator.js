// ─────────────────────────────────────────────────────────────────────────────
// PharmacyNavigator — the pharmacy-partner portal, namespaced as a role module
// inside the unified Healio app.
//
// Lifted from the standalone pharmacy app's App.js. The unified shell owns the
// NavigationContainer/SafeAreaProvider and authentication; pharmacies are
// hospital-affiliated staff (role 'pharmacy_assistant'), so there is no
// self-serve signup and the module's own Login screen is not registered here.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from './constants/theme';

import Home from './screens/Home';
import Prescriptions from './screens/Prescriptions';
import Earnings from './screens/Earnings';
import Profile from './screens/Profile';
import PharmacyQR from './screens/PharmacyQR';
import PatientPrescriptions from './screens/PatientPrescriptions';
import Checkout from './screens/Checkout';
import OrderRequests from './screens/OrderRequests';

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
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 4 },
        // + insets.bottom so the bar clears the Android navigation bar; the
        // app draws edge-to-edge, so nothing reserves that space for us.
        tabBarStyle: {
          height: 68 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 6,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            Prescriptions: focused ? 'document-text' : 'document-text-outline',
            Earnings: focused ? 'wallet' : 'wallet-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"          component={Home}          options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Prescriptions" component={Prescriptions} options={{ tabBarLabel: 'Orders' }} />
      <Tab.Screen name="Earnings"      component={Earnings}      options={{ tabBarLabel: 'Earnings' }} />
      <Tab.Screen name="Profile"       component={Profile}       options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function PharmacyNavigator({ initialRouteName = 'Main' }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="PharmacyQR" component={PharmacyQR} />
      <Stack.Screen name="PatientPrescriptions" component={PatientPrescriptions} />
      <Stack.Screen name="Checkout" component={Checkout} />
      <Stack.Screen name="OrderRequests" component={OrderRequests} />
    </Stack.Navigator>
  );
}
