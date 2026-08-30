import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Switch, Modal, ScrollView, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { useStore } from '../lib/store';
import { departments } from '../constants/mock-data';
import { Ionicons } from '@expo/vector-icons';
import ProtectedScreen from '../components/ProtectedScreen';
import styles from './Doctors.styles';

export default function Doctors({ navigation }) {
  const doctors = useStore(state => state.doctors);
  const addDoctor = useStore(state => state.addDoctor);
  const updateDoctor = useStore(state => state.updateDoctor);
  const toggleDoctorActive = useStore(state => state.toggleDoctorActive);
  const businessProfile = useStore(state => state.businessProfile);

  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null); // null means adding new
  const [formError, setFormError] = useState('');           // inline validation message

  // Form State — empty fee/slot so the user must fill them
  const [form, setForm] = useState({
    name: '', speciality: '', department: 'Cardiology', fee: '', phone: '', email: '', slotsPerDay: ''
  });

  const filteredDoctors = doctors.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.speciality.toLowerCase().includes(search.toLowerCase()) ||
    d.department.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenAdd = () => {
    setEditingDoctor(null);
    setFormError('');
    // Prefill fee + patients-per-slot from the hospital's centralized defaults
    const defFee  = businessProfile?.defaultFee ? `₹${businessProfile.defaultFee}` : '';
    const defSlot = businessProfile?.defaultPatientsPerSlot || '';
    setForm({ name: '', speciality: '', department: 'Cardiology', fee: defFee, phone: '', email: '', slotsPerDay: defSlot });
    setModalVisible(true);
  };

  const handleOpenEdit = (doc) => {
    setEditingDoctor(doc);
    setFormError('');
    setForm({
      name: doc.name,
      speciality: doc.speciality,
      department: doc.department,
      fee: doc.fee,
      phone: String(doc.phone || '').replace(/\D/g, '').slice(-10),
      email: doc.email,
      slotsPerDay: String(doc.slotsPerDay || ''),
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    // ── Validate all mandatory fields, collecting every missing one ──────────
    const missing = [];
    const phone10 = String(form.phone).replace(/\D/g, '').slice(-10);
    const feeNum  = Number(String(form.fee).replace(/[^\d.]/g, ''));
    const slotNum = Number(String(form.slotsPerDay).replace(/\D/g, ''));

    if (!form.name.trim())     missing.push('Name');
    if (phone10.length !== 10) missing.push('Valid 10-digit Phone');
    if (!form.department)      missing.push('Department');
    if (!(feeNum > 0))         missing.push('Consultation Fee');
    if (!(slotNum > 0))        missing.push('Patients per Slot');

    if (missing.length > 0) {
      setFormError(`Please fill in: ${missing.join(', ')}.`);
      return;
    }
    setFormError('');

    // Email is the only optional field
    const saveForm = {
      ...form,
      speciality: form.speciality.trim() || form.department, // specialty defaults to department
      email: form.email.trim() || '',
    };

    setSaving(true);
    try {
      const res = editingDoctor
        ? await updateDoctor(editingDoctor.id, saveForm)
        : await addDoctor(saveForm);
      if (res?.error) {
        setFormError(res.error);
        return;
      }
      setModalVisible(false);
      Alert.alert("Success", editingDoctor
        ? "Doctor profile updated!"
        : "Doctor added successfully!");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedScreen navigation={navigation}>
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <Text style={styles.headerTitle}>Doctor Registry</Text>
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
            <Ionicons name="add" size={16} color={COLORS.white} />
            <Text style={styles.addBtnText}>Add Doctor</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, specialty, department..."
            placeholderTextColor="#a0a0a0"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        data={filteredDoctors}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="medkit-outline" size={44} color={COLORS.border} />
            <Text style={styles.emptyText}>No doctors found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, !item.active && styles.inactiveCard]}>
            <View style={styles.cardHeader}>
              <View style={styles.doctorBadge}>
                <Ionicons name="pulse" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.doctorInfo}>
                <Text style={styles.doctorName}>{item.name}</Text>
                <Text style={styles.doctorSpeciality}>{item.speciality} · {item.department}</Text>
              </View>
              <TouchableOpacity style={styles.editIconBtn} onPress={() => handleOpenEdit(item)}>
                <Ionicons name="create-outline" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Doctor stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Today's Appts</Text>
                <Text style={styles.statValue}>{item.today || 0}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Rating</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={13} color="#ffc107" />
                  <Text style={[styles.statValue, { fontSize: 13, marginLeft: 3, marginTop: 0 }]}>
                    {item.rating ? item.rating.toFixed(1) : 'New'}
                  </Text>
                </View>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>OPD Fee</Text>
                <Text style={styles.statValue}>{item.fee}</Text>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.activeRow}>
                <Text style={styles.statusLabel}>
                  {item.active ? 'Active on Patient App' : 'Inactive / On Leave'}
                </Text>
                <Switch
                  value={item.active}
                  onValueChange={() => toggleDoctorActive(item.id)}
                  trackColor={{ false: COLORS.border, true: COLORS.primarySoft }}
                  thumbColor={item.active ? COLORS.primary : COLORS.textSecondary}
                />
              </View>
            </View>
          </View>
        )}
      />

      {/* Add / Edit Doctor Sliding Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingDoctor ? 'Edit Doctor Profile' : 'Onboard New Doctor'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalFormContent} showsVerticalScrollIndicator={false}>
              {/* Inline validation error */}
              {!!formError && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#dc2626" style={{ marginRight: 6 }} />
                  <Text style={styles.errorBoxText}>{formError}</Text>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Full Name *</Text>
                <View style={styles.formInputRow}>
                  <Ionicons name="ribbon-outline" size={16} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Dr. Arjun Mehra"
                    value={form.name}
                    onChangeText={val => { setForm({ ...form, name: val }); if (formError) setFormError(''); }}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Type / Department *</Text>
                <View style={styles.pickerContainer}>
                  {departments.map((dept) => (
                    <TouchableOpacity
                      key={dept}
                      style={[styles.pickerItem, form.department === dept && styles.pickerItemActive]}
                      onPress={() => setForm({ ...form, department: dept, speciality: dept })}
                    >
                      <Text style={[styles.pickerItemText, form.department === dept && styles.pickerItemTextActive]}>
                        {dept}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {/* Allow custom specialty override */}
                <View style={[styles.formInputRow, { marginTop: 8 }]}>
                  <Ionicons name="create-outline" size={16} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.formInput}
                    placeholder="Custom specialty (optional override)"
                    value={form.speciality}
                    onChangeText={val => setForm({ ...form, speciality: val })}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Consultation Fee *</Text>
                <View style={styles.formInputRow}>
                  <Ionicons name="cash-outline" size={16} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. ₹800"
                    value={form.fee}
                    onChangeText={val => setForm({ ...form, fee: val })}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Patients per Slot *</Text>
                <View style={styles.formInputRow}>
                  <Ionicons name="people-outline" size={16} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.formInput}
                    keyboardType="number-pad"
                    placeholder="e.g. 1"
                    value={form.slotsPerDay}
                    onChangeText={val => setForm({ ...form, slotsPerDay: val.replace(/\D/g, '') })}
                  />
                </View>
                <Text style={styles.formHint}>How many patients can book the same time slot.</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Phone Number *</Text>
                <View style={styles.formInputRow}>
                  <Ionicons name="call-outline" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.ccPrefix}>+91</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="number-pad"
                    maxLength={10}
                    placeholder="98300 12345"
                    value={form.phone}
                    onChangeText={val => setForm({ ...form, phone: val.replace(/\D/g, '').slice(0, 10) })}
                  />
                </View>
                <Text style={styles.formHint}>Used for the doctor's app login (10-digit Indian mobile).</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Email Address <Text style={{ color: COLORS.textSecondary, fontWeight: '400' }}>(optional)</Text></Text>
                <View style={styles.formInputRow}>
                  <Ionicons name="mail-outline" size={16} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.formInput}
                    keyboardType="email-address"
                    placeholder="e.g. arjun@apollo.in"
                    value={form.email}
                    onChangeText={val => setForm({ ...form, email: val })}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </ProtectedScreen>
  );
}
