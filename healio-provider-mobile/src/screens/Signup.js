import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import { departments } from '../constants/mock-data';
import { useStore } from '../lib/store';
import { useLanguage } from '../context/LanguageContext';
import { supabase, lookupPhoneAccount, accountKindLabelKey } from '../lib/supabase';
import { uploadLocalFile } from '../lib/storage';
import OtpVerifyModal from '../components/OtpVerifyModal';
import styles from './Signup.styles';

// ─────────────────────────────────────────────────────────────────────────────
// One wizard, four provider kinds. A hospital gets the full flow; an
// independent lab, pharmacy or solo doctor has no beds, no OPD departments and
// no consultation defaults, so that entire step drops out.
//
// `orgType` is what lands in onboarding_queue.type, and approveOnboarding()
// copies it verbatim into organisations.type — which is exactly what
// resolveRole() reads to decide whether someone gets the hospital dashboard or
// one of the independent modules. Note the enum calls a lab 'diagnostic', and
// an individual doctor's own one-person practice a 'clinic'.
// ─────────────────────────────────────────────────────────────────────────────
const KINDS = {
  hospital: {
    orgType: 'hospital',
    labelKey: null, // hospital keeps its own bespoke copy
    docKeys: { registration: 'hsignup_doc_registration', license: 'hsignup_doc_license', id: 'hsignup_doc_id' },
  },
  lab: {
    orgType: 'diagnostic',
    labelKey: 'reg_lab',
    docKeys: { registration: 'isignup_doc_reg_lab', license: 'isignup_doc_lic_lab', id: 'isignup_doc_id_lab' },
  },
  pharmacy: {
    orgType: 'pharmacy',
    labelKey: 'reg_pharmacy',
    docKeys: { registration: 'isignup_doc_reg_pharmacy', license: 'isignup_doc_lic_pharmacy', id: 'isignup_doc_id_pharmacy' },
  },
  // A solo practitioner. The "organisation" is their own practice, so the name
  // field asks for the clinic/chamber name and the documents are the doctor's
  // own registration rather than a business licence.
  doctor: {
    orgType: 'clinic',
    labelKey: 'reg_doctor',
    docKeys: { registration: 'isignup_doc_reg_doctor', license: 'isignup_doc_lic_doctor', id: 'isignup_doc_id_doctor' },
  },
};

export default function Signup({ navigation, route }) {
  const { t } = useLanguage();
  const kind = KINDS[route?.params?.kind] ? route.params.kind : 'hospital';
  const cfg = KINDS[kind];
  const isHospital = kind === 'hospital';
  const kindLabel = cfg.labelKey ? t(cfg.labelKey) : '';

  const [step, setStep] = useState(1);
  const setBusinessProfile = useStore((state) => state.setBusinessProfile);
  // Feature flag: when OFF we skip the payment step entirely (use during testing)
  const [paymentEnabled, setPaymentEnabled] = useState(false); // default OFF until loaded
  useEffect(() => {
    supabase.from('features').select('enabled').eq('key', 'signup_payment').maybeSingle()
      .then(({ data: row }) => { if (row != null) setPaymentEnabled(row.enabled); })
      .catch(() => {});
  }, []);

  // Step ids in order. 'opd' (departments + consult defaults) is hospital-only.
  const flow = [
    'verify',
    'details',
    ...(isHospital ? ['opd'] : []),
    'docs',
    ...(paymentEnabled ? ['payment'] : []),
  ];
  const totalSteps = flow.length;
  const current = flow[step - 1];

  const stepLabel = (id) => {
    if (id === 'details') return isHospital ? t('hsignup_step_hospital') : kindLabel;
    return t({
      verify: 'hsignup_step_verify',
      opd: 'hsignup_step_opd',
      docs: 'hsignup_step_docs',
      payment: 'hsignup_step_payment',
    }[id]);
  };

  const [data, setData] = useState({
    hospitalName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    pincode: '',
    beds: '',
    companyLogoUri: '',
    selectedDepts: [],
    defaultFee: '',
    defaultSlots: '',
    docs: { registration: false, license: false, id: false },
    docFiles: { registration: '', license: '', id: '' },
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Contact number confirmed by OTP. Stored as the digits that were verified,
  // so editing the number on a later back-navigation forces a fresh code.
  const [otpVisible, setOtpVisible] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const phoneVerified = !!verifiedPhone && verifiedPhone === data.phone.trim();

  const upd = (key, value) => {
    setData((current) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  };

  const toggleDept = (dept) => {
    const next = data.selectedDepts.includes(dept)
      ? data.selectedDepts.filter((item) => item !== dept)
      : [...data.selectedDepts, dept];
    upd('selectedDepts', next);
  };

  // Uploaded BEFORE any account exists (this whole screen is pre-auth — see
  // migration-033). Stores the storage path (not a public URL — the
  // verification-docs bucket is private; admin/service-role generates
  // signed URLs to actually view these).
  const [uploadingDoc, setUploadingDoc] = useState(null);

  const promptUploadDoc = (key) => {
    Alert.alert(t('hsignup_upload_document'), t('doc_choose_source'), [
      { text: t('doc_take_photo'), onPress: () => uploadDoc(key, 'camera') },
      { text: t('hsignup_choose_image'), onPress: () => uploadDoc(key, 'image') },
      { text: t('hsignup_choose_file'), onPress: () => uploadDoc(key, 'file') },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const uploadDoc = async (key, mode) => {
    try {
      let asset;
      if (mode === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert(t('hsignup_perm_needed'), t('hsignup_perm_camera')); return; }
        const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (res.canceled) return;
        asset = res.assets[0];
      } else if (mode === 'image') {
        const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
        if (res.canceled) return;
        asset = res.assets[0];
      } else {
        const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
        if (res.canceled) return;
        asset = res.assets[0];
      }

      setUploadingDoc(key);
      const ext = (asset.name?.split('.').pop() || asset.mimeType?.split('/').pop() || 'jpg').toLowerCase();
      const path = `signup-${Date.now()}-${key}.${ext}`;
      // Read the local file as base64 and upload the raw bytes. fetch(uri).blob()
      // throws on RN/Hermes ("Creating blobs from 'ArrayBuffer'…"). See lib/storage.js.
      // upsert:false — this is a pre-auth (anon) upload and the path is already
      // timestamp-unique. upsert:true would require UPDATE on storage.objects,
      // which anon isn't granted (migration-033 gives anon INSERT only) → RLS deny.
      await uploadLocalFile('verification-docs', path, asset.uri, asset.mimeType || `image/${ext}`, { upsert: false });

      setData((current) => ({
        ...current,
        docs: { ...current.docs, [key]: true },
        docFiles: { ...current.docFiles, [key]: path },
      }));
      setErrors((current) => {
        const next = { ...current };
        delete next[`docs.${key}`];
        return next;
      });
    } catch (e) {
      Alert.alert(t('doc_upload_failed_title'), e?.message || t('login_err_generic'));
    } finally {
      setUploadingDoc(null);
    }
  };

  const pickCompanyLogo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('doc_perm_required'), t('hsignup_perm_logo'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (!result.canceled && result.assets?.length) {
      upd('companyLogoUri', result.assets[0].uri);
    }
  };

  const validateStep = () => {
    const next = {};
    if (current === 'verify') {
      if (!data.hospitalName.trim()) {
        next.hospitalName = isHospital ? t('hsignup_err_name') : t('isignup_err_name', { kind: kindLabel });
      }
      if (!data.phone.trim() || !/^[6-9][0-9]{9}$/.test(data.phone)) next.phone = t('hsignup_err_phone');
      if (data.email && !/\S+@\S+\.\S+/.test(data.email)) next.email = t('hsignup_err_email');
    } else if (current === 'details') {
      if (!data.address.trim()) next.address = t('hsignup_err_address');
      if (!data.city.trim()) next.city = t('hsignup_err_city');
      if (!data.pincode.trim() || !/^[0-9]{6}$/.test(data.pincode)) next.pincode = t('hsignup_err_pincode');
      // Beds are a hospital concept — an independent lab or pharmacy has none.
      if (isHospital && (!data.beds.trim() || Number.isNaN(Number(data.beds)))) next.beds = t('hsignup_err_beds');
    } else if (current === 'opd') {
      if (data.selectedDepts.length === 0) next.selectedDepts = t('hsignup_err_depts');
      if (!data.defaultFee.trim() || !(Number(data.defaultFee) > 0)) next.defaultFee = t('hsignup_err_fee');
      if (!data.defaultSlots.trim() || !(Number(data.defaultSlots) > 0)) next.defaultSlots = t('hsignup_err_slots');
    } else if (current === 'docs') {
      if (!data.docs.registration) next['docs.registration'] = t('hsignup_err_doc_reg');
      if (!data.docs.license) next['docs.license'] = t('hsignup_err_doc_license');
      if (!data.docs.id) next['docs.id'] = t('hsignup_err_doc_id');
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const next = async () => {
    if (!validateStep()) return;

    // Step 1 collects the number that becomes the hospital admin's login. Refuse
    // one that already belongs to another Healio account here — letting the
    // application through means the collision only surfaces after an admin has
    // approved it, when login resolves the number to its original role instead.
    if (current === 'verify') {
      setSubmitting(true);
      const { kind: takenBy } = await lookupPhoneAccount(data.phone);
      setSubmitting(false);
      if (takenBy) {
        setErrors({ phone: t('signup_err_phone_taken', { kind: t(accountKindLabelKey(takenBy)) }) });
        return;
      }

      // …and prove the applicant actually holds it. The step promises an OTP
      // ("A 4-digit OTP will be sent to confirm this contact number") and it is
      // the only number an admin can reach them on after approval, so the
      // application cannot move past this step unverified.
      if (!phoneVerified) {
        setOtpVisible(true);
        return;
      }
    }

    if (step < totalSteps) {
      setStep((current) => current + 1);
      return;
    }

    // ── Final step: Submit application to admin onboarding queue ──────────────
    setSubmitting(true);
    try {
      setBusinessProfile({
        name: data.hospitalName.trim(),
        city: data.city.trim(),
        logoUri: data.companyLogoUri || null,
        address: data.address.trim(),
        phone: data.phone.trim(),
        email: data.email.trim(),
        beds: isHospital ? data.beds.trim() : '',
        departments: isHospital ? data.selectedDepts : [],
        defaultFee: isHospital ? data.defaultFee.trim() : '',
        defaultPatientsPerSlot: isHospital ? data.defaultSlots.trim() : '',
      });

      const emailTrimmed = data.email.trim();
      const onboardingRow = {
        name:          data.hospitalName.trim(),
        // 'hospital' | 'diagnostic' | 'pharmacy' — carried through approval into
        // organisations.type, which is what picks the provider's module.
        type:          cfg.orgType,
        city:          data.city.trim(),
        country:       'IN',
        admin_phone:   `+91${data.phone.trim()}`,
        admin_email:   emailTrimmed || null,
        address:       data.address.trim(),
        beds:          isHospital ? parseInt(data.beds, 10) : null,
        departments:   isHospital ? data.selectedDepts : [],
        documents:     Object.keys(data.docs).filter((k) => data.docs[k]),
        // Storage paths in the private verification-docs bucket (migration-019).
        document_urls: Object.values(data.docFiles).filter(Boolean),
        notes: [
          ...(isHospital ? [
            `default_fee:${data.defaultFee.trim()}`,
            `patients_per_slot:${data.defaultSlots.trim()}`,
          ] : []),
          `pincode:${data.pincode.trim()}`,
        ].join(';'),
        status:        'pending',
        applied_at:    new Date().toISOString(),
      };
      let { error } = await supabase.from('onboarding_queue').insert(onboardingRow);
      if (error && (error.code === '42703' || /document_urls/i.test(error.message || ''))) {
        // migration-019 not applied yet — submit without it rather than
        // blocking the whole application. The uploaded files still exist in
        // storage; document_urls can be backfilled once the column exists.
        const { document_urls, ...withoutDocUrls } = onboardingRow;
        ({ error } = await supabase.from('onboarding_queue').insert(withoutDocUrls));
      }
      if (error) throw error;
    } catch (e) {
      Alert.alert(t('hsignup_submission_failed'), e?.message || t('hsignup_submission_failed_msg'));
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    navigation.replace('SignupPending', {
      hospitalName: data.hospitalName.trim(),
      phone: data.phone.trim(),
    });
  };

  // 'verify' is never the last step — details and docs always follow — so a
  // correct code just advances the wizard.
  const onOtpVerified = () => {
    setOtpVisible(false);
    setVerifiedPhone(data.phone.trim());
    setStep((current) => current + 1);
  };

  const back = () => {
    setErrors({});
    if (step > 1) {
      setStep((current) => current - 1);
      return;
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.bgBlobOne} />
      <View style={styles.bgBlobTwo} />

      <View style={styles.header}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={back} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('hsignup_title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.stepperContainer}>
          {flow.map((id, index) => {
            const n = index + 1;
            return (
              <View key={id} style={styles.stepWrapper}>
                <View
                  style={[
                    styles.stepDot,
                    step > n && styles.completedDot,
                    step === n && styles.activeDot,
                  ]}
                >
                  {step > n ? (
                    <Ionicons name="checkmark" size={14} color={COLORS.white} />
                  ) : (
                    <Text style={[styles.stepDotText, step === n && styles.activeDotText]}>{n}</Text>
                  )}
                </View>
                {index < flow.length - 1 && <View style={[styles.stepLine, step > n && styles.completedLine]} />}
              </View>
            );
          })}
        </View>

        <Text style={styles.stepLabel}>
          {t('hsignup_step_of', { step, total: totalSteps, label: stepLabel(current) })}
        </Text>
      </View>

      {/* The app draws edge-to-edge, so Android no longer resizes the window for
          the keyboard (adjustResize is a no-op there) — the view must move
          itself. `flex: 1` on the ScrollView keeps the footer pinned below it
          rather than being pushed off when the keyboard shrinks the box. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {current === 'verify' && (
            <View>
              <Text style={styles.sectionTitle}>{t('hsignup_verify_contact')}</Text>
              <Text style={styles.sectionSub}>
                {isHospital ? t('hsignup_verify_sub') : t('isignup_verify_sub')}
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  {isHospital ? t('hsignup_hospital_name') : t('isignup_name', { kind: kindLabel })}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={
                    isHospital ? 'e.g. Healio Hospital'
                      : kind === 'lab' ? 'e.g. Andheri Path Lab'
                      : kind === 'doctor' ? 'e.g. Dr. Meera Iyer Clinic'
                      : 'e.g. Sai Medical Store'
                  }
                  placeholderTextColor="#a0a0a0"
                  value={data.hospitalName}
                  onChangeText={(value) => upd('hospitalName', value)}
                />
                {errors.hospitalName && <Text style={styles.errorText}>{errors.hospitalName}</Text>}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('hsignup_company_logo')}</Text>
                <TouchableOpacity style={styles.logoUploadCard} onPress={pickCompanyLogo} activeOpacity={0.85}>
                  <View style={styles.logoPreviewWrap}>
                    {data.companyLogoUri ? (
                      <Image source={{ uri: data.companyLogoUri }} style={styles.logoPreviewImage} />
                    ) : (
                      <View style={styles.logoPreviewFallback}>
                        <Ionicons name="image-outline" size={22} color={COLORS.primary} />
                      </View>
                    )}
                  </View>
                  <View style={styles.logoUploadText}>
                    <Text style={styles.logoUploadTitle}>{data.companyLogoUri ? t('hsignup_change_logo') : t('hsignup_add_logo')}</Text>
                    <Text style={styles.logoUploadSub}>{t('hsignup_logo_sub')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('hsignup_email_opt')}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="email-address"
                  placeholder="admin@healio.com"
                  placeholderTextColor="#a0a0a0"
                  value={data.email}
                  onChangeText={(value) => upd('email', value)}
                />
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('hsignup_phone')}</Text>
                <View style={styles.phoneInputRow}>
                  <Text style={styles.phonePrefix}>+91</Text>
                  <TextInput
                    style={styles.phoneInput}
                    keyboardType="number-pad"
                    maxLength={10}
                    placeholder="98300 12345"
                    placeholderTextColor="#a0a0a0"
                    value={data.phone}
                    onChangeText={(value) => upd('phone', value.replace(/\D/g, ''))}
                  />
                  {phoneVerified && (
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                  )}
                </View>
                {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
              </View>
            </View>
          )}

          {current === 'details' && (
            <View>
              <Text style={styles.sectionTitle}>
                {isHospital ? t('hsignup_hospital_details') : t('isignup_details', { kind: kindLabel })}
              </Text>
              <Text style={styles.sectionSub}>
                {isHospital ? t('hsignup_hospital_details_sub') : t('isignup_details_sub', { kind: kindLabel })}
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('hsignup_street')}</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="location" size={16} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.innerInput}
                    placeholder="123, Park Street"
                    placeholderTextColor="#a0a0a0"
                    value={data.address}
                    onChangeText={(value) => upd('address', value)}
                  />
                </View>
                {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
              </View>

              <View style={styles.gridRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>{t('hsignup_city')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Kolkata"
                    placeholderTextColor="#a0a0a0"
                    value={data.city}
                    onChangeText={(value) => upd('city', value)}
                  />
                  {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>{t('hsignup_pincode')}</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="700016"
                    placeholderTextColor="#a0a0a0"
                    value={data.pincode}
                    onChangeText={(value) => upd('pincode', value.replace(/\D/g, ''))}
                  />
                  {errors.pincode && <Text style={styles.errorText}>{errors.pincode}</Text>}
                </View>
              </View>

              {/* Beds are a hospital concept — skipped for independent providers. */}
              {isHospital && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>{t('hsignup_total_beds')}</Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="business" size={16} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.innerInput}
                      keyboardType="number-pad"
                      placeholder="120"
                      placeholderTextColor="#a0a0a0"
                      value={data.beds}
                      onChangeText={(value) => upd('beds', value.replace(/\D/g, ''))}
                    />
                  </View>
                  {errors.beds && <Text style={styles.errorText}>{errors.beds}</Text>}
                </View>
              )}
            </View>
          )}

          {current === 'opd' && (
            <View>
              <Text style={styles.sectionTitle}>{t('hsignup_opd_depts')}</Text>
              <Text style={styles.sectionSub}>{t('hsignup_opd_depts_sub')}</Text>

              <View style={styles.chipsContainer}>
                {departments.map((dept) => {
                  const selected = data.selectedDepts.includes(dept);
                  return (
                    <TouchableOpacity
                      key={dept}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() => toggleDept(dept)}
                    >
                      <Ionicons name={selected ? 'close' : 'add'} size={14} color={selected ? COLORS.white : COLORS.text} />
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{dept}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.selectedDepts && <Text style={styles.errorText}>{errors.selectedDepts}</Text>}

              <View style={styles.infoCard}>
                <View style={styles.infoTitleRow}>
                  <Ionicons name="time" size={16} color={COLORS.primary} />
                  <Text style={styles.infoCardTitle}>{t('hsignup_opd_timing')}</Text>
                </View>
                <Text style={styles.infoCardBody}>
                  {t('hsignup_opd_timing_body')}
                </Text>
              </View>

              {/* Consultation defaults — prefill every new doctor */}
              <Text style={[styles.sectionTitle, { fontSize: 18, marginTop: 28 }]}>{t('hsignup_consult_defaults')}</Text>
              <Text style={styles.sectionSub}>
                {t('hsignup_consult_defaults_sub')}
              </Text>

              <View style={styles.gridRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>{t('hsignup_default_fee')}</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="500"
                    placeholderTextColor="#a0a0a0"
                    value={data.defaultFee}
                    onChangeText={(value) => upd('defaultFee', value.replace(/[^\d.]/g, ''))}
                  />
                  {errors.defaultFee && <Text style={styles.errorText}>{errors.defaultFee}</Text>}
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>{t('hsignup_patients_slot')}</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="1"
                    placeholderTextColor="#a0a0a0"
                    value={data.defaultSlots}
                    onChangeText={(value) => upd('defaultSlots', value.replace(/\D/g, ''))}
                  />
                  {errors.defaultSlots && <Text style={styles.errorText}>{errors.defaultSlots}</Text>}
                </View>
              </View>
            </View>
          )}

          {current === 'docs' && (
            <View>
              <Text style={styles.sectionTitle}>{t('hsignup_upload_docs')}</Text>
              <Text style={styles.sectionSub}>{t('hsignup_upload_docs_sub')}</Text>

              {[
                { key: 'registration', labelKey: cfg.docKeys.registration },
                { key: 'license', labelKey: cfg.docKeys.license },
                { key: 'id', labelKey: cfg.docKeys.id },
              ].map((doc) => {
                const uploaded = data.docs[doc.key];
                const fileName = data.docFiles[doc.key];
                const docError = errors[`docs.${doc.key}`];
                const isUploading = uploadingDoc === doc.key;

                return (
                  <View key={doc.key} style={styles.uploadGroup}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => promptUploadDoc(doc.key)}
                      disabled={isUploading}
                      style={[
                        styles.uploadButton,
                        uploaded && styles.uploadSuccess,
                        docError && styles.uploadError,
                      ]}
                    >
                      <View style={[styles.uploadIconContainer, uploaded && styles.uploadSuccessIcon]}>
                        {isUploading ? (
                          <ActivityIndicator size="small" color={COLORS.primary} />
                        ) : uploaded ? (
                          <Ionicons name="checkmark" size={20} color={COLORS.white} />
                        ) : (
                          <Ionicons name="cloud-upload" size={20} color={COLORS.primary} />
                        )}
                      </View>
                      <View style={styles.uploadTextContainer}>
                        <Text style={styles.uploadLabel}>{t(doc.labelKey)}</Text>
                        <Text style={styles.uploadSub}>{isUploading ? t('hsignup_uploading') : uploaded ? t('hsignup_uploaded', { file: fileName }) : t('hsignup_tap_upload')}</Text>
                      </View>
                      <Ionicons name="document-text" size={16} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                    {docError && <Text style={[styles.errorText, { marginTop: 6 }]}>{docError}</Text>}
                  </View>
                );
              })}
            </View>
          )}

          {current === 'payment' && (
            <View>
              <Text style={styles.sectionTitle}>{t('hsignup_activation_fee')}</Text>
              <Text style={styles.sectionSub}>{t('hsignup_activation_sub')}</Text>

              <View style={styles.pricingCard}>
                <Text style={styles.pricingLabel}>{t('hsignup_onetime_fee')}</Text>
                <Text style={styles.price}>₹4,999</Text>
                <Text style={styles.priceSub}>{t('hsignup_fee_sub')}</Text>
              </View>

              <View style={styles.benefits}>
                {[
                  'hsignup_benefit_listed',
                  'hsignup_benefit_doctor',
                  'hsignup_benefit_pharmacy',
                  'hsignup_benefit_support',
                ].map((benefitKey) => (
                  <View key={benefitKey} style={styles.benefitRow}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                    <Text style={styles.benefitText}>{t(benefitKey)}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.securePaymentBox}>
                <Ionicons name="shield-checkmark" size={18} color={COLORS.success} style={{ marginRight: 2 }} />
                <Text style={styles.securePaymentText}>{t('hsignup_secure_payment')}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Inside the KeyboardAvoidingView so Continue rides above the keyboard
            instead of being buried by it. */}
        <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueBtn, submitting && { opacity: 0.7 }]}
          onPress={next}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.white} />
          ) : step === totalSteps && paymentEnabled ? (
            <View style={styles.btnRow}>
              <Ionicons name="card" size={18} color={COLORS.white} />
              <Text style={styles.continueBtnText}>{t('hsignup_pay_activate')}</Text>
            </View>
          ) : step === totalSteps ? (
            <View style={styles.btnRow}>
              <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
              <Text style={styles.continueBtnText}>{t('hsignup_submit')}</Text>
            </View>
          ) : (
            <Text style={styles.continueBtnText}>{t('continue')}</Text>
          )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <OtpVerifyModal
        visible={otpVisible}
        phone={data.phone}
        onVerified={onOtpVerified}
        onClose={() => setOtpVisible(false)}
      />
    </SafeAreaView>
  );
}
