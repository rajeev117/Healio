import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useLanguage } from '../../../context/LanguageContext';
import AppBar from '../components/AppBar';
import { uploadFile, savePrescriptionDocument } from '../../../lib/careFlow';

export default function UploadPrescription({ route, navigation }) {
  const { t } = useLanguage();
  const apt = route?.params?.appointment;

  const [assets, setAssets] = useState([]); // expo-image-picker assets
  const [submitting, setSubmitting] = useState(false);

  const addAssets = (picked) => setAssets(prev => [...prev, ...picked]);

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('idoc_permission_required'), t('idoc_permission_photos'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) addAssets(result.assets);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('idoc_permission_required'), t('idoc_permission_camera'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets?.length) addAssets(result.assets);
  };

  const chooseSource = () => {
    Alert.alert(t('idoc_add_rx_photo'), t('idoc_choose_source'), [
      { text: t('idoc_take_photo'), onPress: takePhoto },
      { text: t('idoc_choose_gallery'), onPress: pickFromGallery },
      { text: t('idoc_cancel'), style: 'cancel' },
    ]);
  };

  const removeAsset = (uri) => setAssets(prev => prev.filter(a => a.uri !== uri));

  const handleSubmit = async () => {
    if (assets.length === 0) {
      Alert.alert(t('idoc_no_image'), t('idoc_no_image_msg'));
      return;
    }
    if (!apt?.patientId) {
      Alert.alert(t('idoc_missing_patient'), t('idoc_missing_patient_msg'));
      return;
    }
    setSubmitting(true);
    try {
      // Upload each image to Storage, then record a prescription for the patient.
      for (const asset of assets) {
        const fileUrl = await uploadFile('records', asset, apt.patientId);
        await savePrescriptionDocument({
          patientId: apt.patientId,
          fileUrl,
          title: 'Prescription',
          appointmentId: apt.id,
        });
      }
      Alert.alert(t('idoc_rx_uploaded'), t('idoc_rx_uploaded_msg'), [
        { text: t('idoc_ok'), onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert(t('idoc_upload_failed'), e?.message || t('idoc_try_again'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBar title={t('idoc_upload_prescription')} onBack={() => navigation.goBack()} />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {apt && (
          <View style={styles.patientBanner}>
            <View style={styles.patientAvatar}>
              <Text style={styles.patientAvatarText}>
                {(apt.patientName || 'P').split(' ').map(n => n[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientBannerName}>{apt.patientName}</Text>
              <Text style={styles.patientBannerMeta}>
                {apt.patientAge}{apt.patientAge !== '—' ? ` ${t('idoc_yrs')}` : ''} · {apt.patientGender}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('idoc_prescription_photo')}</Text>
          {assets.length === 0 ? (
            <TouchableOpacity style={styles.uploadCard} onPress={chooseSource} activeOpacity={0.8}>
              <View style={styles.uploadIcon}>
                <Ionicons name="camera-outline" size={28} color={COLORS.primary} />
              </View>
              <Text style={styles.uploadTitle}>{t('idoc_add_rx_photo')}</Text>
              <Text style={styles.uploadHint}>{t('idoc_add_rx_hint')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.thumbGrid}>
              {assets.map(asset => (
                <View key={asset.uri} style={styles.thumbWrap}>
                  <Image source={{ uri: asset.uri }} style={styles.thumb} />
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeAsset(asset.uri)}>
                    <Ionicons name="close" size={14} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addMoreTile} onPress={chooseSource} activeOpacity={0.8}>
                <Ionicons name="add" size={26} color={COLORS.primary} />
                <Text style={styles.addMoreText}>{t('idoc_add_more')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.btnSection}>
          <TouchableOpacity
            style={[styles.submitBtn, (submitting || assets.length === 0) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting || assets.length === 0}
          >
            <Ionicons name="cloud-upload-outline" size={20} color={COLORS.white} />
            <Text style={styles.submitBtnText}>
              {submitting ? t('idoc_uploading') : t('idoc_upload_prescription')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  container: { flex: 1, backgroundColor: COLORS.surface },

  patientBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.secondary,
    marginHorizontal: 16, marginTop: 16, borderRadius: SIZES.radius, padding: 14,
    borderWidth: 1, borderColor: COLORS.borderStrong,
  },
  patientAvatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  patientAvatarText: { color: COLORS.white, fontWeight: '800', fontSize: 13.5 },
  patientBannerName: { fontSize: 14.5, fontWeight: '800', color: COLORS.primary },
  patientBannerMeta: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },

  section: { marginHorizontal: 16, marginTop: SPACING.m },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 10 },

  uploadCard: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.borderStrong,
    borderStyle: 'dashed', borderRadius: SIZES.radius, paddingVertical: 32, paddingHorizontal: 16,
    alignItems: 'center', gap: 6,
  },
  uploadIcon: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  uploadTitle: { fontSize: 14.5, fontWeight: '700', color: COLORS.text },
  uploadHint: { fontSize: 11.5, color: COLORS.textSecondary, textAlign: 'center' },

  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 100, height: 130, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  removeBtn: {
    position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.error, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  addMoreTile: {
    width: 100, height: 130, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.borderStrong,
    borderStyle: 'dashed', backgroundColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  addMoreText: { fontSize: 11.5, fontWeight: '700', color: COLORS.primary },

  btnSection: { marginHorizontal: 16, marginTop: SPACING.l },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.primary, borderRadius: SIZES.radius, padding: 16,
  },
  submitBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
});
