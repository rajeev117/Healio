import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

const RELATION_OPTIONS = ['Father', 'Mother', 'Sister', 'Brother', 'Spouse', 'Child'];
const BLOOD_OPTIONS = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'];

const ageToDob = (age) => `${new Date().getFullYear() - parseInt(age, 10)}-01-01`;
const dobToAge = (dob) => {
  const y = parseInt(String(dob || '').slice(0, 4), 10);
  return y ? `${new Date().getFullYear() - y} yrs` : '—';
};

export default function FamilyProfiles({ navigation }) {
  const [members, setMembers] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('Father');
  const [age, setAge] = useState('');
  const [blood, setBlood] = useState('O+');

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingList(false); return; }
      const { data } = await supabase
        .from('family_profiles').select('*').eq('owner_id', user.id).order('created_at');
      setMembers((data || []).map(m => ({
        id: m.id, name: m.name, relation: m.relation,
        age: dobToAge(m.date_of_birth), blood: m.blood_group || '—',
      })));
    } catch (e) { /* ignore */ }
    finally { setLoadingList(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleOpenAddModal = () => {
    if (members.length >= 4) {
      Alert.alert("Limit Reached", "You can add a maximum of 4 family members.");
      return;
    }
    setShowAddModal(true);
  };

  const handleConfirmAdd = async () => {
    if (!name.trim() || name.trim().length < 2) { Alert.alert("Name Required", "Enter the family member's full name (at least 2 characters)."); return; }
    const ageNum = Number(age);
    if (!age.trim() || isNaN(ageNum) || !Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) {
      Alert.alert("Valid Age Required", "Enter a whole number between 1 and 120.");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('family_profiles').insert({
        owner_id: user.id, name: name.trim(), relation,
        date_of_birth: ageToDob(age), blood_group: blood,
      });
      if (error) throw error;
      setShowAddModal(false);
      setName(''); setRelation('Father'); setAge(''); setBlood('O+');
      load();
    } catch (e) { Alert.alert('Could not add', e?.message || 'Try again'); }
    finally { setSaving(false); }
  };

  const handleDeleteMember = (id, memberName) => {
    Alert.alert("Remove Member", `Remove ${memberName}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        await supabase.from('family_profiles').delete().eq('id', id);
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
        <Text style={styles.headerTitle}>Family Profiles</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Add up to 4 family members to manage their health records and appointments.</Text>

        {members.map(member => (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.avatarSmall}>
              <Ionicons name="person" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.memberSub}>{member.relation} • {member.age} • {member.blood}</Text>
            </View>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteMember(member.id, member.name)}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        ))}

        {members.length < 4 && (
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenAddModal}>
            <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
            <Text style={styles.addBtnText}>Add Family Member ({members.length}/4)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Add Family Member bottom sheet modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Family Member</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollBody}>
              {/* Name Input */}
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. John Doe"
                placeholderTextColor={COLORS.textSecondary}
                value={name}
                onChangeText={setName}
              />

              {/* Age Input */}
              <Text style={styles.inputLabel}>Age (in Years)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 28"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
                value={age}
                onChangeText={setAge}
              />

              {/* Relationship Pills */}
              <Text style={styles.inputLabel}>Relationship</Text>
              <View style={styles.pillsRow}>
                {RELATION_OPTIONS.map((opt) => {
                  const isSelected = relation === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.pill, isSelected && styles.selectedPill]}
                      onPress={() => setRelation(opt)}
                    >
                      <Text style={[styles.pillText, isSelected && styles.selectedPillText]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Blood Group Pills */}
              <Text style={styles.inputLabel}>Blood Group</Text>
              <View style={styles.pillsRow}>
                {BLOOD_OPTIONS.map((opt) => {
                  const isSelected = blood === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.pill, isSelected && styles.selectedPill]}
                      onPress={() => setBlood(opt)}
                    >
                      <Text style={[styles.pillText, isSelected && styles.selectedPillText]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.6 }]} onPress={handleConfirmAdd} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitBtnText}>Add Profile</Text>}
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
    padding: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  backBtn: { marginRight: 15 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { padding: SPACING.m },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: SPACING.l },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.m,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  avatarSmall: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  memberSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  deleteBtn: { padding: 8 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.m,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    marginTop: 10
  },
  addBtnText: { color: COLORS.primary, fontWeight: '800', marginLeft: 10, fontSize: 16 },

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
    maxHeight: '80%',
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
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.m,
    marginBottom: SPACING.s,
  },
  textInput: {
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 15,
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.s,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedPill: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  selectedPillText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  submitBtn: {
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
  submitBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});