// ─────────────────────────────────────────────────────────────────────────────
// IndependentLabNavigator — a standalone diagnostic lab that is NOT attached to
// a hospital. Its own organisations row (type 'diagnostic'), its own price list,
// its own patients, its own payouts.
//
// The hospital-affiliated sibling is src/roles/lab/. That module assumes a
// lab_technician staff row inside a hospital; this one assumes the organisation
// admin. They intentionally share the lab_orders table and nothing else.
//
// As with every role module, the unified shell owns the NavigationContainer /
// SafeAreaProvider and authentication, so no Login screen is registered here.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from './constants/theme';

import Home from './screens/Home';
import Requests from './screens/Requests';
import Earnings from './screens/Earnings';
import Profile from './screens/Profile';
import LabQR from './screens/LabQR';
import ScanWalkIn from './screens/ScanWalkIn';
import TestRequestQuote from './screens/TestRequestQuote';
import SampleReport from './screens/SampleReport';
import TestCatalog from './screens/TestCatalog';
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
          borderTopColor: COLORS.border,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            Requests: focused ? 'flask' : 'flask-outline',
            Earnings: focused ? 'wallet' : 'wallet-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"     component={Home}     options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Requests" component={Requests} options={{ tabBarLabel: 'Orders' }} />
      <Tab.Screen name="Earnings" component={Earnings} options={{ tabBarLabel: 'Payouts' }} />
      <Tab.Screen name="Profile"  component={Profile}  options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function IndependentLabNavigator({ initialRouteName = 'Main' }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="LabQR" component={LabQR} />
      <Stack.Screen name="ScanWalkIn" component={ScanWalkIn} />
      <Stack.Screen name="TestRequestQuote" component={TestRequestQuote} />
      <Stack.Screen name="SampleReport" component={SampleReport} />
      <Stack.Screen name="TestCatalog" component={TestCatalog} />
      <Stack.Screen name="OrderRequests" component={OrderRequests} />
    </Stack.Navigator>
  );
}
