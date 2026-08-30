import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { uploadFile, savePrescriptionDocument } from '../../../lib/careFlow';
import { useLanguage } from '../../../context/LanguageContext';

export default function UploadPrescription({ route, navigation }) {
  const apt = route?.params?.appointment;
  const { t } = useLanguage();

  const [assets, setAssets] = useState([]); // expo-image-picker assets
  const [submitting, setSubmitting] = useState(false);

  const addAssets = (picked) => setAssets(prev => [...prev, ...picked]);

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('doc_perm_required'), t('doc_perm_photo'));
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
      Alert.alert(t('doc_perm_required'), t('doc_perm_camera'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets?.length) addAssets(result.assets);
  };

  const chooseSource = () => {
    Alert.alert(t('doc_add_rx_photo_title'), t('doc_choose_source'), [
      { text: t('doc_take_photo'), onPress: takePhoto },
      { text: t('doc_choose_gallery'), onPress: pickFromGallery },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const removeAsset = (uri) => setAssets(prev => prev.filter(a => a.uri !== uri));

  const handleSubmit = async () => {
    if (assets.length === 0) {
      Alert.alert(t('doc_no_image_title'), t('doc_no_image_msg'));
      return;
    }
    if (!apt?.patientId) {
      Alert.alert(t('doc_missing_patient_title'), t('doc_missing_patient_msg'));
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
      Alert.alert(t('doc_rx_uploaded_title'), t('doc_rx_uploaded_msg'), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert(t('doc_upload_failed_title'), e?.message || t('login_err_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('doc_upload_rx')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {apt && (
          <View style={styles.patientBanner}>
            <View style={styles.patientAvatar}>
              <Text style={styles.patientAvatarText}>
                {(apt.patientName || 'P').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.patientBannerName}>{apt.patientName}</Text>
              <Text style={styles.patientBannerMeta}>
                {apt.patientAge}{apt.patientAge !== '—' ? ` ${t('yrs')}` : ''} · {apt.patientGender}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('doc_rx_photo')}</Text>
          {assets.length === 0 ? (
            <TouchableOpacity style={styles.uploadCard} onPress={chooseSource} activeOpacity={0.8}>
              <View style={styles.uploadIcon}>
                <Ionicons name="camera-outline" size={30} color={COLORS.primary} />
              </View>
              <Text style={styles.uploadTitle}>{t('doc_add_rx_photo')}</Text>
              <Text style={styles.uploadHint}>{t('doc_take_or_choose')}</Text>
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
                <Ionicons name="add" size={28} color={COLORS.primary} />
                <Text style={styles.addMoreText}>{t('doc_add_more')}</Text>
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
            <Text style={styles.submitBtnText}>{submitting ? t('doc_uploading') : t('doc_upload_rx')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: {
    backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  container: { flex: 1, backgroundColor: COLORS.surface },
  patientBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.secondary,
    marginHorizontal: 20, marginTop: 16, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: COLORS.primaryHairline,
  },
  patientAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  patientAvatarText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  patientBannerName: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  patientBannerMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  section: { marginHorizontal: 20, marginTop: SPACING.m },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  uploadCard: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.primaryHairline,
    borderStyle: 'dashed', borderRadius: SIZES.radius, paddingVertical: 32, paddingHorizontal: 16,
    alignItems: 'center', gap: 6,
  },
  uploadIcon: {
    width: 60, height: 60, borderRadius: 24, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  uploadTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  uploadHint: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 100, height: 130, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  removeBtn: {
    position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.error, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  addMoreTile: {
    width: 100, height: 130, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.primaryHairline,
    borderStyle: 'dashed', backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  addMoreText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  btnSection: { marginHorizontal: 20, marginTop: SPACING.l },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: SIZES.radius, padding: 16, gap: 10,
  },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
