import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from './src/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import AnimatedScreen from './src/components/AnimatedScreen';
import EmergencyAdmissionAlert from './src/components/EmergencyAdmissionAlert';
import { addPushListeners } from './src/lib/push';
import { withFeature, useFeatureEnabled } from './src/components/FeatureGate';

// Held outside the tree so the push tap handler can navigate without being
// mounted inside a screen. See usePushTapNavigation below.
const navigationRef = createNavigationContainerRef();

// Auth
import { AuthProvider, useAuth, ROLES } from './src/context/AuthContext';
import { PlatformConfigProvider } from './src/context/PlatformConfigContext';
import { LanguageProvider } from './src/context/LanguageContext';

// Auth screens
import ChooseLanguage from './src/screens/ChooseLanguage';
import RegisterSelect from './src/screens/RegisterSelect';
import Welcome       from './src/screens/Welcome';
import Login         from './src/screens/Login';
import Signup        from './src/screens/Signup';
import SignupPending from './src/screens/SignupPending';

// Hospital Admin screens
import Home          from './src/screens/Home';
import Doctors       from './src/screens/Doctors';
import Patients      from './src/screens/Patients';
import Operations    from './src/screens/Operations';
import Profile       from './src/screens/Profile';

// Role-specific home screens
import HomeCareHome      from './src/screens/HomeCareHome';
import OPDHome           from './src/screens/OPDHome';
import DoctorNavigator   from './src/roles/doctor/DoctorNavigator';
import LabNavigator      from './src/roles/lab/LabNavigator';
import PharmacyNavigator from './src/roles/pharmacy/PharmacyNavigator';
import RmpNavigator      from './src/roles/rmp/RmpNavigator';
import RmpSignup         from './src/roles/rmp/screens/Signup';
import PatientNavigator  from './src/roles/patient/PatientNavigator';
// Standalone providers — their own organisation, no hospital behind them.
import IndependentLabNavigator      from './src/roles/independentLab/IndependentLabNavigator';
import IndependentPharmacyNavigator from './src/roles/independentPharmacy/IndependentPharmacyNavigator';
import IndependentDoctorNavigator   from './src/roles/independentDoctor/IndependentDoctorNavigator';

// Shared stack screens
import Appointments        from './src/screens/Appointments';
import AppointmentDetail   from './src/screens/AppointmentDetail';
import DoctorDetail        from './src/screens/DoctorDetail';
import DoctorSchedule      from './src/screens/DoctorSchedule';
import PatientActions      from './src/screens/PatientActions';
import PatientVisitDetail  from './src/screens/PatientVisitDetail';
import PatientHistory      from './src/screens/PatientHistory';
import Billing             from './src/screens/Billing';
import Reports             from './src/screens/Reports';
import Notifications       from './src/screens/Notifications';
import Support             from './src/screens/Support';
import Settings            from './src/screens/Settings';
import Subscription        from './src/screens/Subscription';
import HomeCareOrderDetail from './src/screens/HomeCareOrderDetail';
import Ledger              from './src/screens/Ledger';
import Prescriptions       from './src/screens/Prescriptions';
import Chat                from './src/screens/Chat';
import VideoConsultation   from './src/screens/VideoConsultation';
import StaffManagement     from './src/screens/StaffManagement';
import PatientRecords      from './src/screens/PatientRecords';
import Earnings            from './src/screens/Earnings';
import ScanPatient         from './src/screens/ScanPatient';
import HospitalQR           from './src/screens/HospitalQR';

// ─── Animation HOC ────────────────────────────────────────────────────────────
// IMPORTANT: define at module level. Calling withAnimation() inside a component
// JSX creates a new function on every render → React Navigation unmounts/remounts
// the screen constantly, breaking navigation and killing the animation.
function withAnimation(ScreenComponent) {
  const Wrapped = (props) => (
    <AnimatedScreen>
      <ScreenComponent {...props} />
    </AnimatedScreen>
  );
  Wrapped.displayName = `Animated(${ScreenComponent.displayName || ScreenComponent.name || 'Screen'})`;
  return Wrapped;
}

// ─── Stable animated screen references (all at module level) ──────────────────
const ChooseLanguageA       = withAnimation(ChooseLanguage);
const RegisterSelectA       = withAnimation(RegisterSelect);
const RmpSignupA            = withAnimation(RmpSignup);
const WelcomeA              = withAnimation(Welcome);
const LoginA                = withAnimation(Login);
const SignupA               = withAnimation(Signup);
const SignupPendingA        = withAnimation(SignupPending);
const AppointmentDetailA    = withAnimation(AppointmentDetail);
const DoctorDetailA         = withAnimation(DoctorDetail);
const DoctorScheduleA       = withAnimation(DoctorSchedule);
const PatientActionsA       = withAnimation(PatientActions);
const PatientVisitDetailA   = withAnimation(PatientVisitDetail);
const PatientHistoryA       = withAnimation(PatientHistory);
const PrescriptionsA        = withAnimation(Prescriptions);
const ChatA                 = withAnimation(Chat);
const VideoConsultA         = withAnimation(VideoConsultation);
const HomeCareHomeA         = withAnimation(HomeCareHome);
const OPDHomeA              = withAnimation(OPDHome);
const HomeCareOrderDetailA  = withAnimation(HomeCareOrderDetail);
const BillingA              = withAnimation(Billing);
const ReportsA              = withAnimation(Reports);
const NotificationsA        = withAnimation(Notifications);
const SupportA              = withAnimation(Support);
const SettingsA             = withAnimation(Settings);
const SubscriptionA         = withAnimation(Subscription);
const LedgerA               = withAnimation(Ledger);
const EarningsA             = withAnimation(Earnings);
const StaffManagementA      = withAnimation(StaffManagement);
const PatientRecordsA       = withAnimation(PatientRecords);
const ScanPatientA          = withAnimation(ScanPatient);
const HospitalQRA           = withAnimation(HospitalQR);

// Hospital capabilities the admin panel can switch off (migration-063).
// Wrapped at module scope so the component type is stable across renders —
// creating it during render would remount the screen and lose its state.
const GatedStaffManagement  = withFeature('hospital_staff_management', StaffManagementA, 'Staff Management');
const GatedLedger           = withFeature('hospital_ledger',           LedgerA,          'Ledger & Payouts');
const GatedReports          = withFeature('hospital_reports',          ReportsA,         'Reports');
const GatedHospitalQR       = withFeature('hospital_qr_checkin',       HospitalQRA,      'QR Check-in');
const GatedScanPatient      = withFeature('hospital_qr_checkin',       ScanPatientA,     'QR Check-in');

// ─── Navigators ───────────────────────────────────────────────────────────────
const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function tabIcon(name, focused) {
  return <Ionicons name={focused ? name : `${name}-outline`} size={22} color={focused ? COLORS.primary : COLORS.textSecondary} />;
}

const TAB_STYLE = {
  headerShown: false,
  tabBarActiveTintColor:   COLORS.primary,
  tabBarInactiveTintColor: COLORS.textSecondary,
  tabBarStyle: {
    backgroundColor: COLORS.background,
    borderTopColor: COLORS.border,
    paddingBottom: 6,
    paddingTop: 6,
    height: 60,
  },
  tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
};

function useTabScreenOptions() {
  const insets = useSafeAreaInsets();
  return {
    ...TAB_STYLE,
    tabBarStyle: {
      ...TAB_STYLE.tabBarStyle,
      height: 60 + insets.bottom,
      paddingBottom: 6 + insets.bottom,
    },
  };
}

function AdminTabs() {
  // The alert subscribes to emergency_admissions and rings; when the feature is
  // off it simply isn't mounted, so nothing subscribes.
  const emergencyOn = useFeatureEnabled('hospital_emergency_admissions');
  return (
    <>
      <Tab.Navigator screenOptions={useTabScreenOptions()}>
        <Tab.Screen name="Home"       component={Home}       options={{ title: 'Home',     tabBarIcon: ({ focused }) => tabIcon('home', focused) }} />
        <Tab.Screen name="Doctors"      component={Doctors}    options={{ title: 'Doctors',  tabBarIcon: ({ focused }) => tabIcon('medkit', focused) }} />
        <Tab.Screen name="Patients"     component={Patients}   options={{ title: 'Patients', tabBarIcon: ({ focused }) => tabIcon('people', focused) }} />
        <Tab.Screen name="Operations"   component={Operations} options={{ title: 'Ops',      tabBarIcon: ({ focused }) => tabIcon('pulse', focused) }} />
        <Tab.Screen name="Profile"      component={Profile}    options={{ title: 'Profile',  tabBarIcon: ({ focused }) => tabIcon('settings', focused) }} />
        <Tab.Screen name="Appointments" component={Appointments} options={{ title: 'Appointments', tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      </Tab.Navigator>
      {/* RMP-raised emergency admissions ring here (blink + vibrate + 5-min accept) */}
      {emergencyOn && <EmergencyAdmissionAlert />}
    </>
  );
}

function PharmacyTabs() {
  return <PharmacyNavigator />;
}

function LabTabs() {
  return <LabNavigator />;
}

function HomeCareTabs() {
  return (
    <Tab.Navigator screenOptions={useTabScreenOptions()}>
      <Tab.Screen name="HCOrders" component={HomeCareHomeA} options={{ title: 'Home Care', tabBarIcon: ({ focused }) => tabIcon('home', focused) }} />
      <Tab.Screen name="Profile"  component={Profile}       options={{ title: 'Profile',   tabBarIcon: ({ focused }) => tabIcon('person-circle', focused) }} />
    </Tab.Navigator>
  );
}

function OPDTabs() {
  return (
    <Tab.Navigator screenOptions={useTabScreenOptions()}>
      <Tab.Screen name="OPDQueue" component={OPDHomeA} options={{ title: 'Queue',   tabBarIcon: ({ focused }) => tabIcon('list', focused) }} />
      <Tab.Screen name="Profile"  component={Profile}  options={{ title: 'Profile', tabBarIcon: ({ focused }) => tabIcon('person-circle', focused) }} />
    </Tab.Navigator>
  );
}

function RoleRouter() {
  const { user } = useAuth();
  switch (user?.role) {
    case ROLES.DOCTOR:             return <DoctorNavigator />;
    case ROLES.PHARMACY_ASSISTANT: return <PharmacyTabs />;
    case ROLES.LAB_TECHNICIAN:     return <LabTabs />;
    case ROLES.OPD_ASSISTANT:      return <OPDTabs />;
    case ROLES.NURSE:
    case ROLES.HOMECARE_ASSISTANT: return <HomeCareTabs />;
    case ROLES.INDEPENDENT_LAB:      return <IndependentLabNavigator />;
    case ROLES.INDEPENDENT_PHARMACY: return <IndependentPharmacyNavigator />;
    case ROLES.INDEPENDENT_DOCTOR:   return <IndependentDoctorNavigator />;
    case ROLES.RMP:                return <RmpNavigator />;
    case ROLES.PATIENT:            return <PatientNavigator />;
    default:                       return <AdminTabs />;
  }
}

function AppStack() {
  const { user } = useAuth();
  return (
    <Stack.Navigator
      initialRouteName={user ? 'Main' : 'ChooseLanguage'}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 280,
      }}
    >
      {/* Language picker (first launch, before auth) */}
      <Stack.Screen name="ChooseLanguage" component={ChooseLanguageA} />

      {/* Auth */}
      <Stack.Screen name="Welcome"        component={WelcomeA} />
      <Stack.Screen name="RegisterSelect" component={RegisterSelectA} />
      <Stack.Screen name="RmpSignup"      component={RmpSignupA} />
      <Stack.Screen name="PatientApp"     component={PatientNavigator} />
      <Stack.Screen name="Login"          component={LoginA} />
      <Stack.Screen name="Signup"        component={SignupA} />
      <Stack.Screen name="SignupPending" component={SignupPendingA} />

      {/* Main (role-based tabs) */}
      <Stack.Screen name="Main" component={RoleRouter} />

      {/* Shared detail screens */}
      <Stack.Screen name="AppointmentDetail"   component={AppointmentDetailA} />
      <Stack.Screen name="DoctorDetail"        component={DoctorDetailA} />
      <Stack.Screen name="DoctorSchedule"      component={DoctorScheduleA} />
      <Stack.Screen name="PatientActions"      component={PatientActionsA} />
      <Stack.Screen name="PatientVisitDetail"  component={PatientVisitDetailA} />
      <Stack.Screen name="PatientHistory"      component={PatientHistoryA} />
      <Stack.Screen name="Prescriptions"       component={PrescriptionsA} />
      <Stack.Screen name="Chat"                component={ChatA} />
      <Stack.Screen name="VideoConsultation"   component={VideoConsultA} options={{ headerShown: false }} />
      <Stack.Screen name="HomeCareOrderDetail" component={HomeCareOrderDetailA} />
      <Stack.Screen name="Billing"             component={BillingA} />
      <Stack.Screen name="Reports"             component={GatedReports} />
      <Stack.Screen name="Notifications"       component={NotificationsA} />
      <Stack.Screen name="Support"             component={SupportA} />
      <Stack.Screen name="Settings"            component={SettingsA} />
      <Stack.Screen name="Subscription"        component={SubscriptionA} />
      <Stack.Screen name="Ledger"              component={GatedLedger} />
      <Stack.Screen name="Earnings"            component={EarningsA} />
      <Stack.Screen name="StaffManagement"     component={GatedStaffManagement} />
      <Stack.Screen name="PatientRecords"      component={PatientRecordsA} />
      <Stack.Screen name="ScanPatient"         component={GatedScanPatient} />
      <Stack.Screen name="HospitalQR"          component={GatedHospitalQR} />
    </Stack.Navigator>
  );
}

// Tapping a push notification should land on the thing it is about. The admin
// broadcast sends `data.screen` (and optional `data.params`); anything else —
// or a tap before the navigator is ready — falls back to the Notifications
// list rather than doing nothing.
function usePushTapNavigation() {
  useEffect(() => {
    const go = (screen, params) => {
      if (!navigationRef.isReady()) return;
      try { navigationRef.navigate(screen, params); }
      catch (_) { navigationRef.navigate('Notifications'); }
    };
    return addPushListeners(
      null,
      (response) => {
        const data = response?.notification?.request?.content?.data || {};
        go(data.screen || 'Notifications', data.params);
      },
    );
  }, []);
}

export default function App() {
  usePushTapNavigation();
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <PlatformConfigProvider>
            <NavigationContainer ref={navigationRef}>
              <AppStack />
            </NavigationContainer>
          </PlatformConfigProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
