// ─────────────────────────────────────────────────────────────────────────────
// PatientNavigator — the patient/consumer portal, namespaced as a role module
// inside the unified Healio provider app.
//
// Lifted from the standalone helio-patient-mobile App.js. The unified shell owns
// the single NavigationContainer / SafeAreaProvider / Supabase client; this
// module owns the patient's own context providers + navigation stack, and does
// its own session check to pick an initial route. It is reached two ways:
//   1. RoleRouter, when resolveRole() returns role 'patient' (returning user).
//   2. The shell 'PatientApp' route, from the "I'm a patient" entry (new user).
// Either way the same self-contained stack renders.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { PlatformConfigProvider } from './context/PlatformConfigContext';
import { WalletProvider } from './context/WalletContext';
import { ActiveProfileProvider } from './context/ActiveProfileContext';
import { NotificationProvider } from './context/NotificationContext';
import { COLORS } from './constants/theme';
import AnimatedScreen from './components/AnimatedScreen';
import { supabase } from './services/supabase';

import Onboarding1 from './screens/Onboarding1';
import Onboarding2 from './screens/Onboarding2';
import Onboarding3 from './screens/Onboarding3';
import LanguageSelect from './screens/LanguageSelect';
import PhoneEntry from './screens/PhoneEntry';
import OTPVerify from './screens/OTPVerify';
import Home from './screens/Home';
import Appointments from './screens/Appointments';
import AppointmentDetail from './screens/AppointmentDetail';
import Services from './screens/Services';
import Records from './screens/Records';
import Profile from './screens/Profile';
import ServiceDetail from './screens/ServiceDetail';
import PersonalInformation from './screens/PersonalInformation';
import FamilyProfiles from './screens/FamilyProfiles';
import ManageAddresses from './screens/ManageAddresses';
import ReportsHub from './screens/ReportsHub';
import HealthInsights from './screens/HealthInsights';
import Welcome from './screens/Welcome';
import Signup from './screens/Signup';
import ProfileSelector from './screens/ProfileSelector';
import ProfileSetup from './screens/ProfileSetup';
import HealioPlusPayment from './screens/HealioPlusPayment';
import Notifications from './screens/Notifications';
import Settings from './screens/Settings';
import DoctorDetail from './screens/DoctorDetail';
import HospitalDetail from './screens/HospitalDetail';
import RaiseDispute from './screens/RaiseDispute';
import RequestRefund from './screens/RequestRefund';
import MyRequests from './screens/MyRequests';
import Wallet from './screens/Wallet';
import BookAppointment from './screens/BookAppointment';
import Prescriptions from './screens/Prescriptions';
import OrderTracking from './screens/OrderTracking';
import OrderApproval from './screens/OrderApproval';
import Chat from './screens/Chat';
import VideoConsultation from './screens/VideoConsultation';
import PaymentCheckout from './screens/PaymentCheckout';
import PayGateway from './screens/PayGateway';
import PaymentAuthorize from './screens/PaymentAuthorize';
import PaymentProcessing from './screens/PaymentProcessing';
import Emergency from './screens/Emergency';
import LabBooking from './screens/LabBooking';
import PharmacyOrder from './screens/PharmacyOrder';
import HomeCareBooking from './screens/HomeCareBooking';
import MedicineStore from './screens/MedicineStore';
import MyQRCode from './screens/MyQRCode';
import ScanProvider from './screens/ScanProvider';
import QRScanHub from './screens/QRScanHub';

// ─── Animation HOC (module-level for stable refs) ─────────────────────────────
function withAnimation(ScreenComponent) {
  const Wrapped = (props) => (
    <AnimatedScreen>
      <ScreenComponent {...props} />
    </AnimatedScreen>
  );
  Wrapped.displayName = `Animated(${ScreenComponent.displayName || ScreenComponent.name || 'Screen'})`;
  return Wrapped;
}

const WelcomeA         = withAnimation(Welcome);
const Onboarding1A     = withAnimation(Onboarding1);
const Onboarding2A     = withAnimation(Onboarding2);
const Onboarding3A     = withAnimation(Onboarding3);
const LanguageSelectA  = withAnimation(LanguageSelect);
const PhoneEntryA      = withAnimation(PhoneEntry);
const SignupA          = withAnimation(Signup);
const ProfileSelectorA = withAnimation(ProfileSelector);
const ProfileSetupA    = withAnimation(ProfileSetup);
const HealioPlusPayA   = withAnimation(HealioPlusPayment);
const OTPVerifyA       = withAnimation(OTPVerify);
const NotificationsA   = withAnimation(Notifications);
const MyQRCodeA        = withAnimation(MyQRCode);
const ScanProviderA    = withAnimation(ScanProvider);
const QRScanHubA       = withAnimation(QRScanHub);
const AppointmentDetailA = withAnimation(AppointmentDetail);
const SettingsA        = withAnimation(Settings);
const DoctorDetailA    = withAnimation(DoctorDetail);
const HospitalDetailA  = withAnimation(HospitalDetail);
const ServiceDetailA   = withAnimation(ServiceDetail);
const PersonalInfoA    = withAnimation(PersonalInformation);
const FamilyProfilesA  = withAnimation(FamilyProfiles);
const ManageAddrA      = withAnimation(ManageAddresses);
const ReportsHubA      = withAnimation(ReportsHub);
const HealthInsightsA  = withAnimation(HealthInsights);
const WalletA          = withAnimation(Wallet);
const BookAppointmentA = withAnimation(BookAppointment);
const PrescriptionsA   = withAnimation(Prescriptions);
const RecordsA         = withAnimation(Records);
const OrderTrackingA   = withAnimation(OrderTracking);
const OrderApprovalA   = withAnimation(OrderApproval);
const ChatA            = withAnimation(Chat);
const VideoConsultA    = withAnimation(VideoConsultation);
const PaymentCheckoutA = withAnimation(PaymentCheckout);
const PayGatewayA    = withAnimation(PayGateway);
const PaymentAuthorizeA = withAnimation(PaymentAuthorize);
const PaymentProcessingA = withAnimation(PaymentProcessing);
const EmergencyA       = withAnimation(Emergency);
const LabBookingA      = withAnimation(LabBooking);
const PharmacyOrderA   = withAnimation(PharmacyOrder);
const HomeCareBookingA = withAnimation(HomeCareBooking);
const MedicineStoreA   = withAnimation(MedicineStore);
const RaiseDisputeA    = withAnimation(RaiseDispute);
const RequestRefundA   = withAnimation(RequestRefund);
const MyRequestsA      = withAnimation(MyRequests);

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelPosition: 'below-icon',
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingBottom: 6 + insets.bottom,
          paddingTop: 4,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home')              iconName = focused ? 'home'     : 'home-outline';
          else if (route.name === 'Appointments') iconName = focused ? 'calendar' : 'calendar-outline';
          else if (route.name === 'Services')     iconName = focused ? 'medical'  : 'medical-outline';
          else if (route.name === 'Orders')       iconName = focused ? 'cube'     : 'cube-outline';
          else if (route.name === 'Profile')      iconName = focused ? 'person'   : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"         component={Home}         options={{ title: t('nav_home') }} />
      <Tab.Screen name="Appointments" component={Appointments} options={{ title: t('nav_appointments') }} />
      <Tab.Screen name="Services"     component={Services}     options={{ title: t('nav_services') }} />
      {/* Orders replaced Records in the bottom bar; records live in Profile → Account */}
      <Tab.Screen name="Orders"       component={OrderTracking} options={{ title: t('nav_orders') }} />
      <Tab.Screen name="Profile"      component={Profile}      options={{ title: t('nav_profile') }} />
    </Tab.Navigator>
  );
}

function PatientStack({ forcedInitial }) {
  const { isLoading } = useLanguage();
  const [authChecked, setAuthChecked] = useState(false);
  const [initialRoute, setInitialRoute] = useState('Welcome');

  // Same one-shot session check the standalone app used: a persisted session
  // skips the auth screens and lands the patient on ProfileSelector. When the
  // shell enters us for a specific reason (e.g. "Patient" in RegisterSelect →
  // go straight to Signup), `forcedInitial` overrides the check.
  useEffect(() => {
    let resolved = false;
    const done = (route) => {
      if (resolved) return;
      resolved = true;
      setInitialRoute(route);
      setAuthChecked(true);
    };
    if (forcedInitial) { done(forcedInitial); return; }
    const timer = setTimeout(() => done('Welcome'), 3000);
    supabase.auth.getSession()
      .then(({ data: { session } }) => { clearTimeout(timer); done(session?.user ? 'ProfileSelector' : 'Welcome'); })
      .catch(() => { clearTimeout(timer); done('Welcome'); });
    return () => clearTimeout(timer);
  }, [forcedInitial]);

  // Register this device for push as soon as a patient session exists, and
  // again whenever auth changes (login / token refresh on a cold start).
  // Patients never pass through AuthContext — they sign in inside this stack —
  // so this is their equivalent of the provider-side hook in AuthContext.
  useEffect(() => {
    let cancelled = false;
    const register = async (session) => {
      if (cancelled || !session?.user?.id) return;
      try {
        const { registerPushToken } = await import('../../lib/push');
        await registerPushToken({ userId: session.user.id, role: 'patient', app: 'patient' });
      } catch (_) { /* push is best-effort */ }
    };
    supabase.auth.getSession().then(({ data }) => register(data?.session)).catch(() => {});
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => register(session));
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (isLoading || !authChecked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 280,
      }}
    >
      <Stack.Screen name="Welcome"           component={WelcomeA} />
      <Stack.Screen name="Onboarding1"       component={Onboarding1A} />
      <Stack.Screen name="Onboarding2"       component={Onboarding2A} />
      <Stack.Screen name="Onboarding3"       component={Onboarding3A} />
      <Stack.Screen name="LanguageSelect"    component={LanguageSelectA} />
      <Stack.Screen name="PhoneEntry"        component={PhoneEntryA} />
      <Stack.Screen name="Signup"            component={SignupA} />
      <Stack.Screen name="ProfileSelector"   component={ProfileSelectorA} />
      <Stack.Screen name="ProfileSetup"      component={ProfileSetupA} />
      <Stack.Screen name="HealioPlusPayment" component={HealioPlusPayA} />
      <Stack.Screen name="OTPVerify"         component={OTPVerifyA} />
      <Stack.Screen name="Main"              component={MainTabs} />
      <Stack.Screen name="AppointmentDetail" component={AppointmentDetailA} />
      <Stack.Screen name="Notifications"     component={NotificationsA} />
      <Stack.Screen name="MyQRCode"          component={MyQRCodeA} />
      <Stack.Screen name="ScanProvider"      component={ScanProviderA} />
      <Stack.Screen name="QRScanHub"         component={QRScanHubA} />
      <Stack.Screen name="Settings"          component={SettingsA} />
      <Stack.Screen name="DoctorDetail"      component={DoctorDetailA} />
      <Stack.Screen name="HospitalDetail"    component={HospitalDetailA} />
      <Stack.Screen name="ServiceDetail"     component={ServiceDetailA} />
      <Stack.Screen name="PersonalInformation" component={PersonalInfoA} />
      <Stack.Screen name="FamilyProfiles"    component={FamilyProfilesA} />
      <Stack.Screen name="ManageAddresses"   component={ManageAddrA} />
      <Stack.Screen name="ReportsHub"        component={ReportsHubA} />
      <Stack.Screen name="HealthInsights"    component={HealthInsightsA} />
      <Stack.Screen name="Wallet"            component={WalletA} />
      <Stack.Screen name="BookAppointment"   component={BookAppointmentA} />
      <Stack.Screen name="Prescriptions"     component={PrescriptionsA} />
      <Stack.Screen name="Records"           component={RecordsA} />
      <Stack.Screen name="OrderTracking"     component={OrderTrackingA} />
      <Stack.Screen name="OrderApproval"     component={OrderApprovalA} />
      <Stack.Screen name="Chat"              component={ChatA} />
      <Stack.Screen name="VideoConsultation" component={VideoConsultA} />
      <Stack.Screen name="PaymentCheckout"   component={PaymentCheckoutA} />
      {/* Wallet top-up checkout: instrument → authorisation → settlement */}
      <Stack.Screen name="PayGateway"      component={PayGatewayA} />
      <Stack.Screen name="PaymentAuthorize"  component={PaymentAuthorizeA} />
      <Stack.Screen
        name="PaymentProcessing"
        component={PaymentProcessingA}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="Emergency"         component={EmergencyA} />
      <Stack.Screen name="LabBooking"        component={LabBookingA} />
      <Stack.Screen name="PharmacyOrder"     component={PharmacyOrderA} />
      <Stack.Screen name="HomeCareBooking"   component={HomeCareBookingA} />
      <Stack.Screen name="MedicineStore"     component={MedicineStoreA} />
      <Stack.Screen name="RaiseDispute"      component={RaiseDisputeA} />
      <Stack.Screen name="RequestRefund"     component={RequestRefundA} />
      <Stack.Screen name="MyRequests"        component={MyRequestsA} />
    </Stack.Navigator>
  );
}

export default function PatientNavigator({ route }) {
  // Optional entry hint from the shell (e.g. RegisterSelect → 'Signup'); absent
  // when rendered by RoleRouter for a returning patient.
  const forcedInitial = route?.params?.initialRoute;
  // Patient-only context providers, scoped so they mount only for the patient
  // module. LanguageProvider/PlatformConfigProvider are vendored copies the
  // patient screens import — kept local so their contexts are populated here.
  return (
    <LanguageProvider>
      <PlatformConfigProvider>
        <ActiveProfileProvider>
          <NotificationProvider>
            <WalletProvider>
              <PatientStack forcedInitial={forcedInitial} />
            </WalletProvider>
          </NotificationProvider>
        </ActiveProfileProvider>
      </PlatformConfigProvider>
    </LanguageProvider>
  );
}
