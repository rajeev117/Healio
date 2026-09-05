// ─────────────────────────────────────────────────────────────────────────────
// IndependentPharmacyNavigator — a standalone neighbourhood pharmacy, not a
// hospital's in-house counter. Its own organisations row (type 'pharmacy'), its
// own stock, its own delivery, its own payouts.
//
// The hospital-affiliated sibling is src/roles/pharmacy/. That module assumes a
// pharmacy_assistant staff row inside a hospital; this one assumes the
// organisation admin. They intentionally share the pharmacy_orders table and
// nothing else.
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
import Orders from './screens/Orders';
import Inventory from './screens/Inventory';
import Earnings from './screens/Earnings';
import Profile from './screens/Profile';
import PharmacyQR from './screens/PharmacyQR';
import ScanWalkIn from './screens/ScanWalkIn';
import OrderRequestQuote from './screens/OrderRequestQuote';
import Fulfilment from './screens/Fulfilment';
import OrderRequests from './screens/OrderRequests';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Wrapped once at module scope: a component type created during render is a new
// type every pass, which remounts the screen and loses its state.
const GatedInventory        = withFeature('pharmacy_inventory',    Inventory,        'Inventory & Stock');
const GatedEarnings         = withFeature('pharmacy_payouts',      Earnings,         'Earnings & Payouts');
const GatedScanWalkIn       = withFeature('pharmacy_walkin_scan',  ScanWalkIn,       'Walk-in QR Scan');
const GatedOrderReqQuote    = withFeature('pharmacy_order_quotes', OrderRequestQuote,'Order Requests & Quotes');
const GatedFulfilment       = withFeature('pharmacy_fulfilment',   Fulfilment,       'Order Fulfilment');
const GatedOrderRequests    = withFeature('pharmacy_order_quotes', OrderRequests,    'Order Requests & Quotes');

function MainTabs() {
  const insets = useSafeAreaInsets();
  // Admin-controlled (migration-063). Tabs are hidden rather than removed so
  // anything navigating to them by name still resolves.
  const stockOn   = useFeatureEnabled('pharmacy_inventory');
  const payoutsOn = useFeatureEnabled('pharmacy_payouts');
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
            Orders: focused ? 'receipt' : 'receipt-outline',
            Stock: focused ? 'cube' : 'cube-outline',
            Earnings: focused ? 'wallet' : 'wallet-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"     component={Home}      options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Orders"   component={Orders}    options={{ tabBarLabel: 'Orders' }} />
      <Tab.Screen name="Stock"    component={GatedInventory}
        options={{ tabBarLabel: 'Stock', ...hiddenTabOptions(stockOn) }} />
      <Tab.Screen name="Earnings" component={GatedEarnings}
        options={{ tabBarLabel: 'Payouts', ...hiddenTabOptions(payoutsOn) }} />
      <Tab.Screen name="Profile"  component={Profile}   options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function IndependentPharmacyNavigator({ initialRouteName = 'Main' }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="PharmacyQR" component={PharmacyQR} />
      <Stack.Screen name="ScanWalkIn"        component={GatedScanWalkIn} />
      <Stack.Screen name="OrderRequestQuote" component={GatedOrderReqQuote} />
      <Stack.Screen name="Fulfilment"        component={GatedFulfilment} />
      <Stack.Screen name="OrderRequests"     component={GatedOrderRequests} />
    </Stack.Navigator>
  );
}
