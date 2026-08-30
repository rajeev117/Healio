import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

const LABELS = ['Home', 'Work', 'Other'];
const ICON = { Home: 'home-outline', Work: 'business-outline', Other: 'location-outline' };

export default function ManageAddresses({ navigation }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState('Home');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('saved_addresses').select('*').eq('patient_id', user.id).order('created_at');
      setAddresses(data || []);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!address.trim()) { Alert.alert('Address required', 'Please enter the address.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('saved_addresses').insert({
        patient_id: user.id, label, address: address.trim(), city: city.trim() || null,
        is_default: addresses.length === 0,
      });
      if (error) throw error;
      setShowAdd(false); setAddress(''); setCity(''); setLabel('Home');
      load();
    } catch (e) { Alert.alert('Could not save', e?.message || 'Try again'); }
    finally { setSaving(false); }
  };

  const handleDelete = (addr) => {
    Alert.alert('Delete address', `Remove "${addr.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('saved_addresses').delete().eq('id', addr.id);
        load();
      } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Addresses</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {addresses.length === 0 && (
            <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginTop: 30 }}>No saved addresses yet.</Text>
          )}
          {addresses.map(addr => (
            <View key={addr.id} style={styles.addressCard}>
              <View style={styles.addrIconBox}>
                <Ionicons name={ICON[addr.label] || 'location-outline'} size={24} color={COLORS.primary} />
              </View>
              <View style={styles.addrInfo}>
                <Text style={styles.addrType}>{addr.label}{addr.is_default ? ' · Default' : ''}</Text>
                <Text style={styles.addrText}>{addr.address}{addr.city ? `, ${addr.city}` : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(addr)}>
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Ionicons name="add-outline" size={24} color={COLORS.primary} />
            <Text style={styles.addText}>Add New Address</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Add Address</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
            </View>
            <View style={styles.labelRow}>
              {LABELS.map(l => (
                <TouchableOpacity key={l} style={[styles.labelChip, label === l && styles.labelChipActive]} onPress={() => setLabel(l)}>
                  <Text style={[styles.labelChipText, label === l && { color: COLORS.white }]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Full address" placeholderTextColor={COLORS.textSecondary} multiline />
            <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={COLORS.textSecondary} />
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveBtnText}>Save Address</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.m, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { marginRight: 15 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { padding: SPACING.m },
  addressCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: SPACING.m, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  addrIconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  addrInfo: { flex: 1 },
  addrType: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  addrText: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.m, marginTop: 10 },
  addText: { color: COLORS.primary, fontWeight: '700', fontSize: 16, marginLeft: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.l },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.m },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  labelRow: { flexDirection: 'row', gap: 10, marginBottom: SPACING.m },
  labelChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  labelChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  labelChipText: { fontWeight: '700', color: COLORS.textSecondary },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text, marginBottom: 12 },
  saveBtn: { backgroundColor: COLORS.primary, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
});
