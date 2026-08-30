import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Dimensions, Alert, Modal, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useWallet } from '../context/WalletContext';
import ProviderAvatar from '../components/ProviderAvatar';

const { width } = Dimensions.get('window');
const TIME_SLOTS = ['09:00 AM', '10:30 AM', '11:00 AM', '01:30 PM', '03:00 PM', '04:30 PM'];

// Generate next 7 days dynamically.
// NOTE: this array used to start at 'Jun' while being indexed by a 0-based
// getMonth(), so every date string named a month five ahead of the real one.
const getNext7Days = () => {
  const days = [];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    days.push({ full: dateStr, dayName: dayName, dateNum: d.getDate() });
  }
  return days;
};

export default function ServiceDetail({ route, navigation }) {
  const item = route.params?.item || route.params?.service || route.params?.selectedService || null;
  const category = route.params?.category || route.params?.type || 'Services';
  const { t } = useLanguage();
  const { balance, hasPremiumAccess } = useWallet();

  // Booking Modal States
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [chosenDate, setChosenDate] = useState('');
  const [chosenTime, setChosenTime] = useState('');
  const [booking, setBooking] = useState(false);

  if (!item) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Service Detail</Text>
          <View style={styles.shareBtn} />
        </View>
        <View style={styles.fallbackState}>
          <Ionicons name="alert-circle-outline" size={56} color={COLORS.textSecondary} />
          <Text style={styles.fallbackTitle}>Service details unavailable</Text>
          <Text style={styles.fallbackText}>The selected service could not be loaded. Go back and open it again.</Text>
          <TouchableOpacity style={styles.bookBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.bookBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleOpenBooking = () => {
    if (!hasPremiumAccess) {
      Alert.alert(
        "Booking Access Locked",
        `Healio requires a minimum credit balance of ₹50 to book consultations. Current balance: ₹${balance}.`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Deposit Now", 
            onPress: () => {
              navigation.navigate('HealioPlusPayment');
            } 
          }
        ]
      );
      return;
    }
    const nextDays = getNext7Days();
    setChosenDate(nextDays[0].full);
    setChosenTime(TIME_SLOTS[0]);
    setShowBookingModal(true);
  };

  // Honest stub — see docs/pending-features.md.
  //
  // Services.js sends Doctors / Hospitals / Labs / Medicine / Home Care to
  // their own screens, so everything that reaches ServiceDetail (Ambulance,
  // Insurance, …) has no doctor behind it. The old handler still called
  // addAppointment with `item.id` as the doctor, which is not a staff row —
  // the insert could only ever fail the doctor_staff_id foreign key, yet the
  // UI announced "Booking Confirmed" regardless. These services need their own
  // booking model; until then, do not pretend.
  const handleConfirmBooking = async () => {
    setShowBookingModal(false);
    Alert.alert(
      'Not bookable in the app yet',
      `${item.name} can't be booked through Healio yet. Please contact them directly, or reach us through Support and we'll help arrange it.`,
      [
        { text: 'OK' },
        { text: 'Support', onPress: () => navigation.navigate('Main', { screen: 'Profile' }) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t(category.toLowerCase().replace(' ', '_'))} Detail</Text>
        <TouchableOpacity style={styles.shareBtn}>
          <Ionicons name="share-outline" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <ProviderAvatar kind={category} name={item.name} uri={item.image} size={100} />
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.specialty}>{item.specialty ? t(item.specialty.toLowerCase()) : (item.type || item.availability)}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.rating}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={[styles.statItem, styles.statBorder]}>
              <Text style={styles.statValue}>{item.distance}</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.experience || '4.5k'}</Text>
              <Text style={styles.statLabel}>{item.experience ? 'Exp' : 'Reviews'}</Text>
            </View>
          </View>
        </View>

        {/* Info Sections */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.sectionText}>
            Experienced {item.specialty || category} providing high-quality healthcare services. 
            Dedicated to patient well-being and professional excellence in the field of {category.toLowerCase()}.
          </Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Working Hours</Text>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>{item.availability || 'Mon - Sat, 09:00 AM - 08:00 PM'}</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>{item.location || 'Dhaka, Bangladesh'}</Text>
          </View>
        </View>

        {item.fee && (
          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>Consultation Fee</Text>
            <Text style={styles.priceValue}>{item.fee}</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer Action */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.bookBtn} 
          onPress={handleOpenBooking}
        >
          <Text style={styles.bookBtnText}>{category === 'Doctors' ? 'Book Appointment' : 'Book Service'}</Text>
        </TouchableOpacity>
      </View>

      {/* Booking Date & Timeslot picker modal */}
      <Modal
        visible={showBookingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBookingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date & Time</Text>
              <TouchableOpacity onPress={() => setShowBookingModal(false)} disabled={booking}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollBody}>
              {/* Doctor Details Badge */}
              <View style={styles.doctorQuickBadge}>
                <ProviderAvatar kind={category} name={item.name} uri={item.image} size={40} style={{ marginRight: 12 }} />
                <View>
                  <Text style={styles.badgeName}>{item.name}</Text>
                  <Text style={styles.badgeSub}>{item.specialty ? t(item.specialty.toLowerCase()) : category}</Text>
                </View>
              </View>

              {/* Date Selection */}
              <Text style={styles.sectionHeading}>Select Appointment Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {getNext7Days().map((d) => {
                  const isSelected = chosenDate === d.full;
                  return (
                    <TouchableOpacity
                      key={d.full}
                      style={[styles.datePill, isSelected && styles.selectedDatePill]}
                      onPress={() => setChosenDate(d.full)}
                    >
                      <Text style={[styles.dayNameText, isSelected && styles.selectedDateText]}>{d.dayName}</Text>
                      <Text style={[styles.dateNumText, isSelected && styles.selectedDateText]}>{d.dateNum}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Time Slot Selection */}
              <Text style={styles.sectionHeading}>Select Available Slot</Text>
              <View style={styles.slotsGrid}>
                {TIME_SLOTS.map((slot) => {
                  const isSelected = chosenTime === slot;
                  return (
                    <TouchableOpacity
                      key={slot}
                      style={[styles.slotPill, isSelected && styles.selectedSlotPill]}
                      onPress={() => setChosenTime(slot)}
                    >
                      <Text style={[styles.slotText, isSelected && styles.selectedSlotText]}>{slot}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={styles.confirmBtn}
              onPress={handleConfirmBooking}
              disabled={booking}
            >
              {booking ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm Appointment Booking</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: SPACING.m,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  backBtn: { padding: 4 },
  shareBtn: { padding: 4 },
  fallbackState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.l,
    gap: 12,
  },
  fallbackTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  fallbackText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  content: { padding: SPACING.m, paddingBottom: 100 },
  profileCard: { 
    alignItems: 'center', 
    backgroundColor: COLORS.surface, 
    borderRadius: 24, 
    padding: SPACING.l,
    marginBottom: SPACING.l,
  },
  imageContainer: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    backgroundColor: COLORS.secondary, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: SPACING.m
  },
  name: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  specialty: { fontSize: 15, color: COLORS.textSecondary, marginTop: 4 },
  statsRow: { flexDirection: 'row', marginTop: SPACING.l, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.m },
  statItem: { flex: 1, alignItems: 'center' },
  statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: COLORS.border },
  statValue: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  infoSection: { marginBottom: SPACING.l },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  sectionText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
  infoRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, padding: 12, borderRadius: 12 },
  infoText: { marginLeft: 12, fontSize: 14, color: COLORS.text, fontWeight: '600' },
  priceCard: { 
    backgroundColor: COLORS.primary, 
    borderRadius: 16, 
    padding: SPACING.m, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  priceLabel: { color: COLORS.white, fontSize: 16, opacity: 0.9 },
  priceValue: { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  footer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: SPACING.m, 
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  bookBtn: { 
    backgroundColor: COLORS.primary, 
    padding: 18, 
    borderRadius: 16, 
    alignItems: 'center' 
  },
  bookBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: SPACING.l,
    minHeight: '55%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
    paddingBottom: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalScrollBody: {
    paddingVertical: SPACING.s,
  },
  doctorQuickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary + '30',
    padding: 12,
    borderRadius: 12,
    marginBottom: SPACING.m,
  },
  badgeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  badgeName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  badgeSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.m,
    marginBottom: SPACING.m,
  },
  horizontalScroll: {
    marginHorizontal: -SPACING.l,
    paddingHorizontal: SPACING.l,
    marginBottom: SPACING.s,
  },
  datePill: {
    width: 60,
    height: 70,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  selectedDatePill: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayNameText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  dateNumText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 4,
  },
  selectedDateText: {
    color: COLORS.white,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.l,
  },
  slotPill: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    marginBottom: 10,
  },
  selectedSlotPill: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
  },
  slotText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  selectedSlotText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  confirmBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: SPACING.m,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  confirmBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});