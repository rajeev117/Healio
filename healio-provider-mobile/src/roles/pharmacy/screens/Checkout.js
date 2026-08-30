import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform, KeyboardAvoidingView, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { uploadRecordImage } from '../../../lib/uploads';
import { completePharmacyOrder } from '../services/api';

export default function Checkout({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { hospitalId } = user || {};
  const patient = route?.params?.patient;
  const [amount, setAmount]   = useState('');
  const [bill, setBill]       = useState(null); // { uri, mimeType }
  const [loading, setLoading] = useState(false);

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo access to attach the bill.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets?.length) setBill(result.assets[0]);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow camera access to capture the bill.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets?.length) setBill(result.assets[0]);
  };

  const chooseSource = () => {
    Alert.alert('Upload Bill', 'Choose a source', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Gallery', onPress: pickFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const amt = parseFloat(amount);
  const canCheckout = !!bill && amt > 0;

  const handleCheckout = async () => {
    if (!bill) {
      Alert.alert('Bill required', 'Please upload the bill before checking out.');
      return;
    }
    if (!amt || amt <= 0) {
      Alert.alert('Enter amount', 'Please enter a valid total amount.');
      return;
    }
    setLoading(true);
    try {
      const billUrl = await uploadRecordImage(bill.uri, patient?.id);
      await completePharmacyOrder(patient.id, hospitalId, amt, billUrl);
      Alert.alert('Checkout complete', `₹${amt} billed to ${patient?.name}. Bill uploaded.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not complete checkout.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {patient && (
            <View style={styles.patientCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(patient.name || 'P').charAt(0).toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.patientName}>{patient.name}</Text>
                <Text style={styles.patientMeta}>{patient.age ? `${patient.age} yrs · ` : ''}{patient.gender || ''}</Text>
              </View>
            </View>
          )}

          <Text style={styles.label}>Total Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
            />
          </View>

          <Text style={styles.label}>Bill / Receipt<Text style={styles.required}> *</Text></Text>
          {bill ? (
            <View style={styles.billPreview}>
              <Image source={{ uri: bill.uri }} style={styles.billImage} resizeMode="cover" />
              <View style={styles.billActions}>
                <TouchableOpacity style={styles.billActionBtn} onPress={chooseSource}>
                  <Ionicons name="swap-horizontal" size={16} color={COLORS.primary} />
                  <Text style={styles.billActionText}>Replace</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.billActionBtn} onPress={() => setBill(null)}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                  <Text style={[styles.billActionText, { color: COLORS.error }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadCard} onPress={chooseSource} activeOpacity={0.8}>
              <View style={styles.uploadIcon}>
                <Ionicons name="receipt-outline" size={26} color={COLORS.primary} />
              </View>
              <Text style={styles.uploadTitle}>Upload bill</Text>
              <Text style={styles.uploadHint}>Take a photo or choose from your gallery</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={[styles.actionBar, { paddingBottom: 16 + insets.bottom }]}>
          <TouchableOpacity
            style={[styles.checkoutBtn, !canCheckout && styles.checkoutBtnDisabled]}
            onPress={handleCheckout}
            disabled={loading || !canCheckout}
          >
            {loading
              ? <ActivityIndicator color={COLORS.white} />
              : <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} />
                  <Text style={styles.checkoutBtnText}>Checkout{amt > 0 ? ` · ₹${amount}` : ''}</Text>
                </>
            }
          </TouchableOpacity>
          {!canCheckout && (
            <Text style={styles.hintText}>Upload a bill and enter the total amount to continue.</Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: {
    backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  container: { flex: 1, backgroundColor: COLORS.surface, paddingHorizontal: 16 },
  patientCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, marginTop: 16, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  patientName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  patientMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  label: { fontSize: 14, fontWeight: '800', color: COLORS.text, marginTop: SPACING.l, marginBottom: SPACING.s },
  required: { color: COLORS.error },
  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: SIZES.radius,
    borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.m, height: 56,
  },
  currency: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginRight: 8 },
  amountInput: { flex: 1, fontSize: 20, fontWeight: '700', color: COLORS.text },
  uploadCard: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.primaryHairline,
    borderStyle: 'dashed', borderRadius: SIZES.radius, paddingVertical: 26, paddingHorizontal: 16,
    alignItems: 'center', gap: 4,
  },
  uploadIcon: {
    width: 54, height: 54, borderRadius: 24, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  uploadTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  uploadHint: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },
  billPreview: {
    backgroundColor: COLORS.white, borderRadius: SIZES.radius, borderWidth: 1, borderColor: COLORS.border,
    padding: 10, gap: 10,
  },
  billImage: { width: '100%', height: 200, borderRadius: 12, backgroundColor: COLORS.surface },
  billActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  billActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.surface,
  },
  billActionText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  actionBar: {
    backgroundColor: COLORS.white, paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  checkoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: SIZES.radius, padding: 16, gap: 10,
  },
  checkoutBtnDisabled: { backgroundColor: COLORS.textSecondary, opacity: 0.5 },
  checkoutBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  hintText: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 },
});
