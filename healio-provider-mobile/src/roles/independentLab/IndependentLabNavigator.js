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
import { withFeature, useFeatureEnabled, hiddenTabOptions } from '../../components/FeatureGate';

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

// Wrapped once at module scope: a component type created during render is a new
// type every pass, which remounts the screen and loses its state.
const GatedEarnings         = withFeature('lab_payouts',       Earnings,         'Earnings & Payouts');
const GatedScanWalkIn       = withFeature('lab_walkin_scan',   ScanWalkIn,       'Walk-in QR Scan');
const GatedTestRequestQuote = withFeature('lab_order_quotes',  TestRequestQuote, 'Order Requests & Quotes');
const GatedSampleReport     = withFeature('lab_sample_reports', SampleReport,    'Sample Reports');
const GatedTestCatalog      = withFeature('lab_test_catalog',  TestCatalog,      'Test Catalogue & Pricing');
const GatedOrderRequests    = withFeature('lab_order_quotes',  OrderRequests,    'Order Requests & Quotes');

function MainTabs() {
  const insets = useSafeAreaInsets();
  // Admin-controlled (migration-063). Hidden rather than removed so anything
  // that navigates to 'Earnings' by name still resolves.
  const payoutsOn = useFeatureEnabled('lab_payouts');
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
      <Tab.Screen
        name="Earnings"
        component={GatedEarnings}
        options={{ tabBarLabel: 'Payouts', ...hiddenTabOptions(payoutsOn) }}
      />
      <Tab.Screen name="Profile"  component={Profile}  options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function IndependentLabNavigator({ initialRouteName = 'Main' }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="LabQR" component={LabQR} />
      <Stack.Screen name="ScanWalkIn"       component={GatedScanWalkIn} />
      <Stack.Screen name="TestRequestQuote" component={GatedTestRequestQuote} />
      <Stack.Screen name="SampleReport"     component={GatedSampleReport} />
      <Stack.Screen name="TestCatalog"      component={GatedTestCatalog} />
      <Stack.Screen name="OrderRequests"    component={GatedOrderRequests} />
    </Stack.Navigator>
  );
}
