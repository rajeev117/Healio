import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FeatureScreen from '../components/FeatureScreen';
import { COLORS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { detectCurrentLocation, reverseGeocode } from '../lib/location';
import { useAuth } from '../context/AuthContext';
import { usePlatformConfig } from '../context/PlatformConfigContext';
import MapPickerModal from '../components/MapPickerModal';
import styles from './Settings.styles';

export default function Settings({ navigation }) {
  const { user } = useAuth();
  const { isEnabled } = usePlatformConfig();
  const orgId = user?.hospitalId;
  const canEdit = user?.role === 'hospital_admin';

  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // Centralized consultation defaults
  const [defaultFee, setDefaultFee] = useState('');
  const [defaultSlots, setDefaultSlots] = useState('');
  const [savingDefaults, setSavingDefaults] = useState(false);

  const onMapConfirm = async ({ latitude, longitude }) => {
    setShowMap(false);
    setCoords({ latitude, longitude });
    try {
      const loc = await reverseGeocode(latitude, longitude);
      if (loc.city) setCity(loc.city);
      if (loc.address) setAddress(loc.address);
    } catch (e) { /* coords still set */ }
  };

  const load = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('organisations')
        .select('city, address, latitude, longitude, consultation_fee, default_patients_per_slot')
        .eq('id', orgId)
        .maybeSingle();
      if (data) {
        setCity(data.city || '');
        setAddress(data.address || '');
        setDefaultFee(data.consultation_fee != null ? String(data.consultation_fee) : '');
        setDefaultSlots(data.default_patients_per_slot != null ? String(data.default_patients_per_slot) : '');
        if (data.latitude != null && data.longitude != null) {
          setCoords({ latitude: Number(data.latitude), longitude: Number(data.longitude) });
        }
      }
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const detect = async () => {
    setDetecting(true);
    try {
      const loc = await detectCurrentLocation();
      if (loc.city) setCity(loc.city);
      if (loc.address) setAddress(loc.address);
      setCoords({ latitude: loc.latitude, longitude: loc.longitude });
    } catch (e) {
      Alert.alert('Location', e?.message || 'Could not get your location.');
    } finally {
      setDetecting(false);
    }
  };

  const save = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const payload = { city: city.trim(), address: address.trim() };
      if (coords) { payload.latitude = coords.latitude; payload.longitude = coords.longitude; }
      const { error } = await supabase.from('organisations').update(payload).eq('id', orgId);
      if (error) throw error;
      Alert.alert('Saved', 'Hospital location updated.');
    } catch (e) {
      Alert.alert('Save failed', e?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const saveDefaults = async () => {
    if (!orgId) return;
    const feeNum  = Number(String(defaultFee).replace(/[^\d.]/g, ''));
    const slotNum = Number(String(defaultSlots).replace(/\D/g, ''));
    if (!(feeNum > 0))  { Alert.alert('Invalid fee', 'Enter a valid default consultation fee.'); return; }
    if (!(slotNum > 0)) { Alert.alert('Invalid slot', 'Enter how many patients can book one slot.'); return; }
    setSavingDefaults(true);
    try {
      const { error } = await supabase.from('organisations')
        .update({ consultation_fee: feeNum, default_patients_per_slot: slotNum })
        .eq('id', orgId);
      if (error) throw error;
      Alert.alert('Saved', 'Consultation defaults updated. New doctors will be prefilled with these.');
    } catch (e) {
      Alert.alert('Save failed', e?.message || 'Could not save.');
    } finally {
      setSavingDefaults(false);
    }
  };

  return (
    <FeatureScreen
      navigation={navigation}
      title="Hospital settings"
      subtitle="Manage your hospital's location, preferences, and partner-facing options."
      badge="Settings"
      primaryAction={{ label: 'Open profile', onPress: () => navigation.navigate('Profile') }}
      secondaryAction={{ label: 'Open earnings', onPress: () => navigation.navigate('Earnings') }}
      sections={[
        {
          title: 'Hospital location',
          children: loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
          ) : (
            <View style={styles.card}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={[styles.input, !canEdit && styles.inputDisabled]}
                value={city} onChangeText={setCity} editable={canEdit}
                placeholder="City" placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }, !canEdit && styles.inputDisabled]}
                value={address} onChangeText={setAddress} editable={canEdit} multiline
                placeholder="Full address" placeholderTextColor={COLORS.textSecondary}
              />
              <View style={styles.coordRow}>
                <Ionicons name="location" size={14} color={coords ? COLORS.success : COLORS.textSecondary} />
                <Text style={styles.coordText}>
                  {coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : 'No GPS coordinates set'}
                </Text>
              </View>

              {canEdit && (
                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.detectBtn} onPress={detect} disabled={detecting}>
                    {detecting
                      ? <ActivityIndicator color={COLORS.primary} size="small" />
                      : <><Ionicons name="navigate" size={16} color={COLORS.primary} /><Text style={styles.detectText}>Detect</Text></>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.detectBtn} onPress={() => setShowMap(true)}>
                    <Ionicons name="map" size={16} color={COLORS.primary} />
                    <Text style={styles.detectText}>Map</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
                    <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save location'}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {!canEdit && <Text style={styles.note}>Only the hospital admin can edit the location.</Text>}

              <MapPickerModal
                visible={showMap}
                initialLat={coords?.latitude}
                initialLng={coords?.longitude}
                onClose={() => setShowMap(false)}
                onConfirm={onMapConfirm}
              />
            </View>
          ),
        },
        {
          title: 'Consultation defaults',
          children: loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
          ) : (
            <View style={styles.card}>
              <Text style={styles.defaultsBlurb}>
                Set once for your hospital. These prefill every new doctor's form — you can still change them per doctor.
              </Text>

              <Text style={styles.label}>Default Consultation Fee (₹)</Text>
              <TextInput
                style={[styles.input, !canEdit && styles.inputDisabled]}
                value={defaultFee} onChangeText={v => setDefaultFee(v.replace(/[^\d.]/g, ''))}
                editable={canEdit} keyboardType="number-pad"
                placeholder="e.g. 500" placeholderTextColor={COLORS.textSecondary}
              />

              <Text style={styles.label}>Default Patients per Slot</Text>
              <TextInput
                style={[styles.input, !canEdit && styles.inputDisabled]}
                value={defaultSlots} onChangeText={v => setDefaultSlots(v.replace(/\D/g, ''))}
                editable={canEdit} keyboardType="number-pad"
                placeholder="e.g. 1" placeholderTextColor={COLORS.textSecondary}
              />

              {canEdit ? (
                <TouchableOpacity style={[styles.saveBtn, { marginTop: 16 }, savingDefaults && { opacity: 0.6 }]} onPress={saveDefaults} disabled={savingDefaults}>
                  <Text style={styles.saveText}>{savingDefaults ? 'Saving…' : 'Save defaults'}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.note}>Only the hospital admin can edit consultation defaults.</Text>
              )}
            </View>
          ),
        },
        {
          title: 'Developer',
          children: (
            <View style={styles.stack}>
              <TouchableOpacity style={styles.devBtn} onPress={() => navigation.navigate('DevPanel')}>
                <Ionicons name="code-slash" size={18} color="#dc2626" />
                <Text style={styles.devBtnText}>Open Dev Panel</Text>
                <Ionicons name="chevron-forward" size={16} color="#dc2626" />
              </TouchableOpacity>
              <Text style={styles.note}>Test credentials and Supabase table reference. Dev only.</Text>
            </View>
          ),
        },
        {
          title: 'Platform features',
          children: (
            <View style={styles.stack}>
              {[
                { label: 'In-app Chat',          key: 'chat' },
                { label: 'Video Consultations',  key: 'video_calls' },
                { label: 'Healio Plus',          key: 'healio_plus' },
                { label: 'Lab Orders',           key: 'lab_orders' },
                { label: 'Pharmacy Orders',      key: 'pharmacy_orders' },
              ].map((f) => {
                const on = isEnabled(f.key);
                return (
                  <View key={f.key} style={styles.row}>
                    <Text style={styles.rowText}>{f.label}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: on ? '#16a34a' : '#dc2626' }} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: on ? '#16a34a' : '#dc2626' }}>
                        {on ? 'On' : 'Off'}
                      </Text>
                    </View>
                  </View>
                );
              })}
              <Text style={styles.featureNote}>
                Feature status is controlled from the Healio Admin portal and applies to all hospitals.
              </Text>
            </View>
          ),
        },
      ]}
    />
  );
}
