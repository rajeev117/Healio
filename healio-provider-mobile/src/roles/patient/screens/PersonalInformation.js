import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase, saveMyProfile } from '../services/supabase';
import CalendarPicker from '../components/CalendarPicker';

const GENDERS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function dateToISO(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isoToDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function formatDate(date) {
  if (!date) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PersonalInformation({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', blood_group: '', gender: '',
    height: '', weight: '', emergency_contact: '',
  });
  const [pickedDate, setPickedDate] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [avatarUri, setAvatarUri] = useState(null);
  const [avatarBase64, setAvatarBase64] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        // Use * so the query works before AND after migration-029 is applied
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id).maybeSingle();
        if (data) {
          setForm({
            name: data.name || '',
            phone: data.phone || '',
            email: data.email || '',
            blood_group: data.blood_group || '',
            gender: data.gender || '',
            height: data.height ? String(data.height) : '',
            weight: data.weight ? String(data.weight) : '',
            emergency_contact: data.emergency_contact || '',
          });
          setPickedDate(isoToDate(data.date_of_birth));
          setAvatarUrl(data.avatar_url || null);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const heightNum = parseFloat(form.height);
  const weightNum = parseFloat(form.weight);
  const heightError = form.height.length > 0 && (isNaN(heightNum) || heightNum < 50 || heightNum > 250);
  const weightError = form.weight.length > 0 && (isNaN(weightNum) || weightNum < 5 || weightNum > 300);

  const handlePickImage = async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to update profile photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        setAvatarUri(result.assets[0].uri);
        setAvatarBase64(result.assets[0].base64 || null);
      }
    } catch {
      Alert.alert('Not available', 'Run "npx expo install expo-image-picker" then restart the app.');
    }
  };

  const uploadAvatar = async (userId) => {
    if (!avatarUri || !avatarBase64) return null;
    try {
      const path = `${userId}/avatar.jpg`;
      const binaryStr = atob(avatarBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (error) { console.warn('Avatar upload error:', error); return null; }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      return `${data.publicUrl}?v=${Date.now()}`;
    } catch (e) {
      console.warn('Avatar upload failed:', e);
      return null;
    }
  };

  const handleSave = async () => {
    if (heightError || weightError) {
      Alert.alert('Invalid values', 'Please fix height/weight before saving.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let newAvatarUrl = avatarUrl;
      if (avatarUri && user) {
        setUploading(true);
        newAvatarUrl = await uploadAvatar(user.id);
        setUploading(false);
        if (newAvatarUrl) setAvatarUrl(newAvatarUrl);
      }
      const baseFields = {
        name: form.name.trim() || undefined,
        email: form.email.trim() || undefined,
        blood_group: form.blood_group || undefined,
        gender: form.gender || undefined,
        date_of_birth: dateToISO(pickedDate),
        avatar_url: newAvatarUrl || undefined,
      };
      const extendedFields = {
        ...baseFields,
        height: form.height && !heightError ? parseFloat(form.height) : undefined,
        weight: form.weight && !weightError ? parseFloat(form.weight) : undefined,
        emergency_contact: form.emergency_contact || undefined,
      };
      // Try saving all fields; fall back to base only if new columns don't exist yet
      // (run supabase/migration-029-profile-extra-fields.sql to unlock height/weight/emergency)
      const result = await saveMyProfile(extendedFields);
      if (result?.error?.code === 'PGRST204' || result?.error?.message?.includes('column')) {
        const fallback = await saveMyProfile(baseFields);
        if (fallback?.error) throw fallback.error;
      } else if (result?.error) {
        throw result.error;
      }
      Alert.alert('Saved', 'Your information has been updated.');
    } catch (e) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const initials = form.name ? form.name.trim()[0]?.toUpperCase() : 'U';
  const displayAvatar = avatarUri || avatarUrl;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personal Information</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarLarge}>
            {displayAvatar ? (
              <Image source={{ uri: displayAvatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.initialsText}>{initials}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.changePhotoBtn} onPress={handlePickImage} disabled={uploading}>
            <Ionicons name="camera-outline" size={16} color={COLORS.primary} />
            <Text style={styles.changePhotoText}>{uploading ? 'Uploading…' : 'Change photo'}</Text>
          </TouchableOpacity>
        </View>

        <Field label="Full Name" value={form.name} onChangeText={(v) => set('name', v)} icon="person-outline" placeholder="Your name" />
        <Field label="Phone Number" value={form.phone} icon="call-outline" editable={false} />
        <Field label="Email Address" value={form.email} onChangeText={(v) => set('email', v)} icon="mail-outline" placeholder="Enter your email" keyboardType="email-address" />

        {/* Date of Birth */}
        <Text style={styles.label}>Date of Birth</Text>
        <TouchableOpacity style={styles.dateRow} onPress={() => setShowCalendar(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={20} color={COLORS.primary} style={{ marginRight: 12 }} />
          <Text style={[styles.dateText, !pickedDate && { color: COLORS.textSecondary }]}>
            {pickedDate ? formatDate(pickedDate) : 'Select date of birth'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Gender */}
        <Text style={styles.label}>Gender</Text>
        <View style={styles.pillRow}>
          {GENDERS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.pill, form.gender === g && styles.pillActive]}
              onPress={() => set('gender', g)}
            >
              <Text style={[styles.pillText, form.gender === g && styles.pillTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Blood Group */}
        <Text style={styles.label}>Blood Group</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, marginBottom: SPACING.m }}>
          {BLOOD_GROUPS.map((bg) => (
            <TouchableOpacity
              key={bg}
              style={[styles.bloodPill, form.blood_group === bg && styles.pillActive]}
              onPress={() => set('blood_group', form.blood_group === bg ? '' : bg)}
            >
              <Text style={[styles.pillText, form.blood_group === bg && styles.pillTextActive]}>{bg}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Height & Weight */}
        <View style={styles.hwRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>Height</Text>
            <View style={[styles.inputWrapper, heightError && styles.inputError]}>
              <Ionicons name="resize-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                value={form.height}
                onChangeText={(v) => set('height', v)}
                placeholder="175"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
                maxLength={5}
              />
              <Text style={styles.unit}>cm</Text>
            </View>
            {heightError && <Text style={styles.fieldError}>50–250 cm</Text>}
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.label}>Weight</Text>
            <View style={[styles.inputWrapper, weightError && styles.inputError]}>
              <Ionicons name="fitness-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                value={form.weight}
                onChangeText={(v) => set('weight', v)}
                placeholder="70"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
                maxLength={5}
              />
              <Text style={styles.unit}>kg</Text>
            </View>
            {weightError && <Text style={styles.fieldError}>5–300 kg</Text>}
          </View>
        </View>

        {/* Emergency Contact */}
        <Text style={styles.label}>Emergency Contact</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="call-outline" size={20} color={COLORS.primary} style={{ marginRight: 12 }} />
          <TextInput
            style={styles.input}
            value={form.emergency_contact}
            onChangeText={(v) => set('emergency_contact', v.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit mobile number"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="phone-pad"
            maxLength={10}
          />
        </View>
        <View style={{ height: SPACING.m }} />

        <TouchableOpacity
          style={[styles.saveBtn, (saving || uploading) && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving || uploading}
        >
          {(saving || uploading) ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <CalendarPicker
        visible={showCalendar}
        value={pickedDate}
        onChange={(date) => setPickedDate(date)}
        onClose={() => setShowCalendar(false)}
        maxDate={new Date()}
      />
    </SafeAreaView>
  );
}

const Field = ({ label, value, icon, placeholder, onChangeText, editable = true, keyboardType }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.inputWrapper, !editable && { backgroundColor: COLORS.surface, opacity: 0.7 }]}>
      <Ionicons name={icon} size={20} color={COLORS.primary} style={{ marginRight: 12 }} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        editable={editable}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.m, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { marginRight: 15 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { padding: SPACING.m, paddingBottom: SPACING.xl },

  avatarSection: { alignItems: 'center', marginVertical: SPACING.l },
  avatarLarge: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: COLORS.primary,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  initialsText: { fontSize: 44, fontWeight: '800', color: COLORS.primary },
  changePhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary,
  },
  changePhotoText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  inputGroup: { marginBottom: SPACING.m },
  label: {
    fontSize: 13, fontWeight: '700', color: COLORS.textSecondary,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, height: 55,
    marginBottom: SPACING.s,
  },
  inputError: { borderColor: '#dc3545' },
  input: { flex: 1, fontSize: 16, color: COLORS.text, fontWeight: '500' },
  unit: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginLeft: 4 },
  fieldError: { fontSize: 12, color: '#dc3545', fontWeight: '600', marginTop: -4 },

  dateRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, height: 55, marginBottom: SPACING.m,
  },
  dateText: { flex: 1, fontSize: 16, color: COLORS.text, fontWeight: '500' },

  pillRow: { flexDirection: 'row', gap: 10, marginBottom: SPACING.m },
  pill: {
    flex: 1, height: 46, borderRadius: 23,
    borderWidth: 1.5, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  bloodPill: {
    width: 52, height: 44, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  pillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.secondary },
  pillText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  pillTextActive: { color: COLORS.primary },

  hwRow: { flexDirection: 'row', marginBottom: SPACING.m },

  saveBtn: {
    backgroundColor: COLORS.primary, height: 55,
    borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    marginTop: SPACING.l,
  },
  saveBtnText: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
});
