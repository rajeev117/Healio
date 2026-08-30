import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { supabase, emailFromPhone } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import styles from './StaffManagement.styles';

// UI role label <-> DB enum
const ROLE_TO_DB = { 'Doctor': 'doctor', 'OPD Assistant': 'opd_assistant', 'Pharmacy Assistant': 'pharmacy_assistant', 'Nurse': 'nurse', 'Receptionist': 'receptionist', 'Lab Technician': 'lab_technician', 'Admin': 'admin' };
const DB_TO_ROLE = { doctor: 'Doctor', opd_assistant: 'OPD Assistant', pharmacy_assistant: 'Pharmacy Assistant', nurse: 'Nurse', receptionist: 'Receptionist', lab_technician: 'Lab Technician', admin: 'Admin' };
const STAFF_ID_PREFIX = { Doctor: 'DR', 'OPD Assistant': 'OPD', 'Pharmacy Assistant': 'PH', Nurse: 'NR', Receptionist: 'RC', 'Lab Technician': 'LT', Admin: 'AD' };

// Roles that get app login access (phone → OTP → role-specific dashboard)
// Doctor            → DoctorTabs (own queue, patients, prescriptions)
// OPD Assistant     → OPDTabs   (appointment queue, walk-in check-in)
// Pharmacy Assistant→ PharmacyTabs (orders queue, dispense)
// Lab Technician    → LabTabs   (lab orders queue, report upload)
// Other roles       → no app login, admin-portal management only
const APP_LOGIN_ROLES = {
  'Doctor':             'doctor',
  'OPD Assistant':      'opd_assistant',
  'Pharmacy Assistant': 'pharmacy_assistant',
  'Lab Technician':     'lab_technician',
};

// Custom department/lab sentinel — lets a hospital name its own distinct
// lab (e.g. "Pathology Lab", "Radiology Lab") instead of being stuck with
// one generic "Lab" bucket for every lab technician.
const CUSTOM_DEPT = '__custom__';

const ROLES = ['Doctor', 'OPD Assistant', 'Pharmacy Assistant', 'Nurse', 'Receptionist', 'Lab Technician', 'Admin'];
const DEPARTMENTS = ['General', 'Cardiology', 'Orthopaedics', 'Dermatology', 'Paediatrics', 'Lab', 'Pharmacy'];
const SHIFTS = ['Morning (7 AM – 3 PM)', 'Afternoon (3 PM – 11 PM)', 'Night (11 PM – 7 AM)', 'Full Day'];

// staff.phone has a GLOBAL unique index (it's the login credential — each
// phone maps 1:1 to a deterministic auth email). Turn that into a clear
// message instead of the raw Postgres "duplicate key" error, since it's
// the most common cause of "I can't add another lab/pharmacy assistant"
// during manual testing with reused test numbers.
function friendlyStaffError(e) {
  const msg = (e?.message || '').toLowerCase();
  if (e?.code === '23505' || msg.includes('duplicate key') || msg.includes('idx_staff_phone_unique')) {
    return 'This phone number is already registered to another staff member (it doubles as their app login). Use a different number.';
  }
  return e?.message || 'Please try again.';
}

const INITIAL_STAFF = [
  { id: 's1', name: 'Dr. Ayaan Khan', role: 'Doctor', department: 'General', shift: 'Morning (7 AM – 3 PM)', status: 'active', phone: '+91 98765 43210', email: 'ayaan@healio.in', joinDate: '01 Jan 2025' },
  { id: 's2', name: 'Nurse Fatima A.', role: 'Nurse', department: 'General', shift: 'Morning (7 AM – 3 PM)', status: 'active', phone: '+91 98765 11111', email: 'fatima@healio.in', joinDate: '15 Mar 2025' },
  { id: 's3', name: 'Ravi Kumar', role: 'Receptionist', department: 'General', shift: 'Full Day', status: 'active', phone: '+91 91234 56789', email: 'ravi@healio.in', joinDate: '10 Feb 2025' },
  { id: 's4', name: 'Dr. Priya Sharma', role: 'Doctor', department: 'Dermatology', shift: 'Afternoon (3 PM – 11 PM)', status: 'active', phone: '+91 98765 22222', email: 'priya@healio.in', joinDate: '20 Apr 2025' },
  { id: 's5', name: 'Anand Lab Tech', role: 'Lab Technician', department: 'Lab', shift: 'Morning (7 AM – 3 PM)', status: 'on_leave', phone: '+91 99999 88888', email: 'anand@healio.in', joinDate: '05 Jun 2025' },
];

const ROLE_COLORS = {
  Doctor: { bg: COLORS.primarySoft, text: COLORS.primary },
  Nurse: { bg: '#eef6ff', text: '#3b82f6' },
  Receptionist: { bg: COLORS.successSoft, text: COLORS.success },
  'Lab Technician': { bg: '#f3e5f5', text: '#8b5cf6' },
  Pharmacist: { bg: COLORS.warningSoft, text: '#d97706' },
  Admin: { bg: COLORS.dangerSoft, text: COLORS.error },
};

const STATUS_COLORS = {
  active: { bg: COLORS.successSoft, text: COLORS.success, label: 'Active' },
  on_leave: { bg: COLORS.warningSoft, text: '#d97706', label: 'On Leave' },
  inactive: { bg: COLORS.dangerSoft, text: COLORS.error, label: 'Inactive' },
};

function StaffCard({ member, onPress }) {
  const roleStyle = ROLE_COLORS[member.role] || { bg: COLORS.surface, text: COLORS.text };
  const statusStyle = STATUS_COLORS[member.status] || STATUS_COLORS.active;
  const initials = member.name.split(' ').map(n => n[0]).slice(0, 2).join('');

  return (
    <TouchableOpacity style={styles.staffCard} onPress={() => onPress(member)}>
      <View style={[styles.staffAvatar, { backgroundColor: roleStyle.bg }]}>
        <Text style={[styles.staffInitials, { color: roleStyle.text }]}>{initials}</Text>
      </View>
      <View style={styles.staffInfo}>
        <View style={styles.staffNameRow}>
          <Text style={styles.staffName}>{member.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
          </View>
        </View>
        <View style={styles.staffMeta}>
          <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
            <Text style={[styles.roleText, { color: roleStyle.text }]}>{member.role}</Text>
          </View>
          <Text style={styles.deptText}>{member.department}</Text>
        </View>
        <View style={styles.shiftRow}>
          <Ionicons name="time-outline" size={11} color={COLORS.textSecondary} />
          <Text style={styles.shiftText}>{member.shift}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function StaffManagement({ navigation, route }) {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [hospitalFee, setHospitalFee] = useState(null);   // org default (shown in edit form label)

  const loadStaff = useCallback(async () => {
    try {
      if (!user?.hospitalId) { setLoadingStaff(false); return; }
      const { data: org } = await supabase
        .from('organisations').select('consultation_fee').eq('id', user.hospitalId).maybeSingle();
      if (org) setHospitalFee(Number(org.consultation_fee ?? 300));
      const { data } = await supabase
        .from('staff').select('*').eq('organisation_id', user.hospitalId).order('created_at', { ascending: false });
      setStaff((data || []).map(s => ({
        id: s.id, staffId: s.staff_id, name: s.name,
        role: DB_TO_ROLE[s.role] || 'Admin', department: s.department || 'General',
        shift: s.shift || '', status: s.status, phone: s.phone || '', email: s.email || '',
        fee: s.consultation_fee != null ? String(s.consultation_fee) : '',
        joinDate: s.join_date ? new Date(s.join_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
      })));
    } catch (e) { /* ignore */ }
    finally { setLoadingStaff(false); }
  }, [user?.hospitalId]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const [selectedStaff, setSelectedStaff] = useState(null);

  // Deep-linked from Operations.js's "Edit" button on a specific team member
  // → jump straight to that staff member's detail (skip the list tap).
  useEffect(() => {
    const openId = route?.params?.openStaffId;
    if (!openId || staff.length === 0) return;
    const member = staff.find(s => s.id === openId);
    if (member) setSelectedStaff(member);
  }, [route?.params?.openStaffId, staff]);
  const [filterRole, setFilterRole] = useState(route?.params?.filterRole || 'All');

  // ── Edit existing staff ──────────────────────────────────────────────────
  const [showEdit, setShowEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState(null); // { id, name, role, department, shift, email, fee }
  const [editCustomDept, setEditCustomDept] = useState('');

  const openEdit = (member) => {
    const isCustomDept = !DEPARTMENTS.includes(member.department);
    setEditForm({ ...member, department: isCustomDept ? CUSTOM_DEPT : member.department });
    setEditCustomDept(isCustomDept ? member.department : '');
    setShowEdit(true);
  };

  const filteredStaff = filterRole === 'All' ? staff : staff.filter(s => s.role === filterRole);

  const handleToggleStatus = async (member) => {
    const newStatus = member.status === 'active' ? 'on_leave' : 'active';
    setStaff(prev => prev.map(s => s.id === member.id ? { ...s, status: newStatus } : s));
    setSelectedStaff(prev => prev ? { ...prev, status: newStatus } : null);
    try { await supabase.from('staff').update({ status: newStatus }).eq('id', member.id); } catch (e) {}
  };

  // Deactivate = revoke: an inactive member disappears from the doctor catalog,
  // the connected pharmacy/lab/home-care teams, and their app dashboard queues.
  // Reversible — reactivating restores everything (nothing is deleted).
  const handleDeactivate = (member) => {
    const isInactive = member.status === 'inactive';
    const apply = async () => {
      const newStatus = isInactive ? 'active' : 'inactive';
      setStaff(prev => prev.map(s => s.id === member.id ? { ...s, status: newStatus } : s));
      setSelectedStaff(prev => prev ? { ...prev, status: newStatus } : null);
      try {
        const { error } = await supabase.from('staff').update({ status: newStatus }).eq('id', member.id);
        if (error) throw error;
      } catch (e) {
        Alert.alert('Could not update', e?.message || 'Please try again.');
        await loadStaff();
      }
    };
    if (isInactive) { apply(); return; }
    Alert.alert(
      'Deactivate staff member',
      `${member.name} will lose app access and stop appearing in bookings, ${member.role === 'Doctor' ? 'the doctor list' : 'their service team'} and queues. You can reactivate them anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: apply },
      ]
    );
  };

  const handleUpdateStaff = async () => {
    if (!editForm?.name?.trim() || editForm.name.trim().length < 2) {
      Alert.alert('Missing Info', 'Name must be at least 2 characters.');
      return;
    }
    if (editForm.fee && (Number(editForm.fee) < 0 || Number(editForm.fee) > 50000)) {
      Alert.alert('Invalid Fee', 'Consultation fee must be between ₹0 and ₹50,000.');
      return;
    }
    const department = editForm.department === CUSTOM_DEPT ? editCustomDept.trim() : editForm.department;
    if (editForm.department === CUSTOM_DEPT && !department) {
      Alert.alert('Name the lab/department', 'Enter a name for this custom lab or department.');
      return;
    }
    setSavingEdit(true);
    try {
      const { error } = await supabase.from('staff').update({
        name: editForm.name.trim(),
        role: ROLE_TO_DB[editForm.role] || 'admin',
        department,
        shift: editForm.shift,
        email: editForm.email || null,
        consultation_fee: editForm.fee ? Number(editForm.fee) : null,
      }).eq('id', editForm.id);
      if (error) throw error;
      setShowEdit(false);
      await loadStaff();
      setSelectedStaff(prev => prev && prev.id === editForm.id ? { ...prev, ...editForm, department } : prev);
      Alert.alert('Saved ✓', `${editForm.name}'s details were updated.`);
    } catch (e) {
      Alert.alert('Could not save changes', friendlyStaffError(e));
    } finally {
      setSavingEdit(false);
    }
  };

  const stats = {
    total: staff.length,
    active: staff.filter(s => s.status === 'active').length,
    onLeave: staff.filter(s => s.status === 'on_leave').length,
    doctors: staff.filter(s => s.role === 'Doctor').length,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Staff Management</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Total Staff', value: stats.total, icon: 'people', color: COLORS.primary, bg: COLORS.primarySoft },
            { label: 'Active', value: stats.active, icon: 'checkmark-circle', color: COLORS.success, bg: COLORS.successSoft },
            { label: 'On Leave', value: stats.onLeave, icon: 'time', color: '#d97706', bg: COLORS.warningSoft },
            { label: 'Doctors', value: stats.doctors, icon: 'medkit', color: '#3b82f6', bg: '#eef6ff' },
          ].map(stat => (
            <View key={stat.label} style={[styles.statCard, { backgroundColor: stat.bg }]}>
              <Ionicons name={stat.icon} size={18} color={stat.color} />
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Role filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['All', ...ROLES].map((role) => (
            <TouchableOpacity
              key={role}
              style={[styles.filterChip, filterRole === role && styles.filterChipActive]}
              onPress={() => setFilterRole(role)}
            >
              <Text style={[styles.filterText, filterRole === role && styles.filterTextActive]}>{role}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Staff list */}
        <View style={{ paddingHorizontal: SPACING.m, gap: 12, paddingBottom: 40 }}>
          {filteredStaff.map(member => (
            <StaffCard key={member.id} member={member} onPress={setSelectedStaff} />
          ))}
        </View>
      </ScrollView>

      {/* Staff Detail Modal */}
      <Modal visible={!!selectedStaff} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Staff Profile</Text>
              <TouchableOpacity onPress={() => setSelectedStaff(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {selectedStaff && (() => {
              const roleStyle = ROLE_COLORS[selectedStaff.role] || { bg: COLORS.surface, text: COLORS.text };
              const statusStyle = STATUS_COLORS[selectedStaff.status] || STATUS_COLORS.active;
              const initials = selectedStaff.name.split(' ').map(n => n[0]).slice(0, 2).join('');
              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.profileSection}>
                    <View style={[styles.profileAvatar, { backgroundColor: roleStyle.bg }]}>
                      <Text style={[styles.profileInitials, { color: roleStyle.text }]}>{initials}</Text>
                    </View>
                    <Text style={styles.profileName}>{selectedStaff.name}</Text>
                    <View style={styles.profileBadgesRow}>
                      <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
                        <Text style={[styles.roleText, { color: roleStyle.text }]}>{selectedStaff.role}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
                      </View>
                    </View>
                  </View>

                  {[
                    { icon: 'id-card', label: 'Staff ID', value: selectedStaff.staffId || '—' },
                    { icon: 'business', label: 'Department', value: selectedStaff.department },
                    { icon: 'time', label: 'Shift', value: selectedStaff.shift },
                    { icon: 'call', label: 'Phone (Login)', value: selectedStaff.phone },
                    { icon: 'mail', label: 'Email', value: selectedStaff.email },
                    { icon: 'calendar', label: 'Joined', value: selectedStaff.joinDate },
                    { icon: 'phone-portrait', label: 'App Access', value: APP_LOGIN_ROLES[selectedStaff.role] ? `Yes — ${selectedStaff.role} dashboard` : 'No app access' },
                  ].map(({ icon, label, value }) => (
                    <View key={label} style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <Ionicons name={icon} size={16} color={COLORS.primary} />
                      </View>
                      <View>
                        <Text style={styles.detailLabel}>{label}</Text>
                        <Text style={styles.detailValue}>{value}</Text>
                      </View>
                    </View>
                  ))}

                  <View style={styles.actionBtns}>
                    <TouchableOpacity
                      style={styles.leaveBtn}
                      onPress={() => handleToggleStatus(selectedStaff)}
                    >
                      <Ionicons name={selectedStaff.status === 'active' ? 'time' : 'checkmark-circle'} size={16} color={COLORS.primary} />
                      <Text style={styles.leaveBtnText}>
                        {selectedStaff.status === 'active' ? 'Mark On Leave' : 'Mark Active'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.msgBtn} onPress={() => openEdit(selectedStaff)}>
                      <Ionicons name="create-outline" size={16} color={COLORS.white} />
                      <Text style={styles.msgBtnText}>Edit Details</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Deactivate / reactivate — revokes or restores access */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                      marginTop: 10, marginBottom: 6, paddingVertical: 12, borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: selectedStaff.status === 'inactive' ? COLORS.success : COLORS.error,
                      backgroundColor: selectedStaff.status === 'inactive' ? COLORS.successSoft : COLORS.dangerSoft,
                    }}
                    onPress={() => handleDeactivate(selectedStaff)}
                  >
                    <Ionicons
                      name={selectedStaff.status === 'inactive' ? 'refresh-circle-outline' : 'remove-circle-outline'}
                      size={16}
                      color={selectedStaff.status === 'inactive' ? COLORS.success : COLORS.error}
                    />
                    <Text style={{
                      fontWeight: '700', fontSize: 13,
                      color: selectedStaff.status === 'inactive' ? COLORS.success : COLORS.error,
                    }}>
                      {selectedStaff.status === 'inactive' ? 'Reactivate — restore access' : 'Deactivate — revoke access'}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Edit Staff Modal */}
      <Modal visible={showEdit} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Staff Details</Text>
              <TouchableOpacity onPress={() => setShowEdit(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {editForm && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.fieldLabel}>Full Name *</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editForm.name}
                  onChangeText={v => setEditForm(p => ({ ...p, name: v }))}
                  placeholder="Enter full name"
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.fieldLabel}>Phone (Login) — contact support to change</Text>
                <TextInput style={[styles.fieldInput, { color: COLORS.textSecondary }]} value={editForm.phone} editable={false} />

                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editForm.email}
                  onChangeText={v => setEditForm(p => ({ ...p, email: v }))}
                  placeholder="email@example.com"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="email-address"
                />

                <Text style={styles.fieldLabel}>{`Consultation Fee (₹) — blank uses hospital default ₹${hospitalFee ?? 300}`}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editForm.fee}
                  onChangeText={v => setEditForm(p => ({ ...p, fee: v }))}
                  placeholder="Optional override"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                />

                <Text style={styles.fieldLabel}>Role</Text>
                <View style={styles.chipGrid}>
                  {ROLES.map(role => (
                    <TouchableOpacity
                      key={role}
                      style={[styles.miniChip, editForm.role === role && styles.miniChipActive]}
                      onPress={() => setEditForm(p => ({ ...p, role }))}
                    >
                      <Text style={[styles.miniChipText, editForm.role === role && styles.miniChipTextActive]}>{role}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Department / Lab</Text>
                <View style={styles.chipGrid}>
                  {DEPARTMENTS.map(dept => (
                    <TouchableOpacity
                      key={dept}
                      style={[styles.miniChip, editForm.department === dept && styles.miniChipActive]}
                      onPress={() => setEditForm(p => ({ ...p, department: dept }))}
                    >
                      <Text style={[styles.miniChipText, editForm.department === dept && styles.miniChipTextActive]}>{dept}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.miniChip, editForm.department === CUSTOM_DEPT && styles.miniChipActive]}
                    onPress={() => setEditForm(p => ({ ...p, department: CUSTOM_DEPT }))}
                  >
                    <Text style={[styles.miniChipText, editForm.department === CUSTOM_DEPT && styles.miniChipTextActive]}>+ Custom</Text>
                  </TouchableOpacity>
                </View>
                {editForm.department === CUSTOM_DEPT && (
                  <TextInput
                    style={styles.fieldInput}
                    value={editCustomDept}
                    onChangeText={setEditCustomDept}
                    placeholder="e.g. Pathology Lab, Radiology Lab"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                )}

                <Text style={styles.fieldLabel}>Shift</Text>
                {SHIFTS.map(shift => (
                  <TouchableOpacity
                    key={shift}
                    style={[styles.shiftOption, editForm.shift === shift && styles.shiftOptionActive]}
                    onPress={() => setEditForm(p => ({ ...p, shift }))}
                  >
                    <Text style={[styles.shiftOptionText, editForm.shift === shift && styles.shiftOptionTextActive]}>
                      {shift}
                    </Text>
                    {editForm.shift === shift && <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />}
                  </TouchableOpacity>
                ))}

                <TouchableOpacity style={[styles.saveBtn, savingEdit && { opacity: 0.6 }]} onPress={handleUpdateStaff} disabled={savingEdit}>
                  {savingEdit ? <ActivityIndicator color={COLORS.white} /> : (<>
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </>)}
                </TouchableOpacity>
                <View style={{ height: 30 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
