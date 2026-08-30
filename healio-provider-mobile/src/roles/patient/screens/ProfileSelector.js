import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { useActiveProfile } from '../context/ActiveProfileContext';
import { supabase } from '../services/supabase';

const { width } = Dimensions.get('window');
const AVATAR_SIZE = (width - SPACING.l * 2 - 30) / 3;

// Deterministic colour per profile so avatars don't all look the same.
const AVATAR_COLORS = ['#821c03', '#2563eb', '#7c3aed', '#059669', '#b45309', '#0891b2'];
const colorFor = (i) => AVATAR_COLORS[i % AVATAR_COLORS.length];

function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
}

export default function ProfileSelector({ navigation, route }) {
  const { t } = useLanguage();
  const { profile: activeProfile, switchProfile } = useActiveProfile();
  const fallbackName = route?.params?.userName;

  const [loading, setLoading] = useState(true);
  const [selfName, setSelfName] = useState(fallbackName || 'Me');
  const [family, setFamily] = useState([]);

  const load = useCallback(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const [{ data: prof }, { data: members }] = await Promise.all([
          supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
          supabase.from('family_profiles').select('id, name, relation').eq('owner_id', user.id).order('created_at'),
        ]);
        if (cancelled) return;
        if (prof?.name) setSelfName(prof.name);
        setFamily(members || []);
      } catch (_) { /* keep fallback */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  useFocusEffect(load);

  const profiles = [
    { id: null, type: 'self', name: selfName, relation: null },
    ...family.map(m => ({ id: m.id, type: 'family', name: m.name, relation: m.relation })),
  ];

  const handleSelectProfile = async (p) => {
    await switchProfile(p);
    navigation.replace('Main', { screen: 'Home', params: { userName: p.name } });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Back button — only when reached from within the app (e.g. "Switch profile"),
          not on the post-login entry where there's nowhere to go back to. */}
      {navigation.canGoBack() && (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
      )}
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('whos_using') || "Who's using Healio?"}</Text>
          <Text style={styles.subtitle}>Select your profile to continue</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} />
        ) : (
          <View style={styles.grid}>
            {profiles.map((profile, i) => {
              const isActive = activeProfile?.type === profile.type
                && (profile.type === 'self' || activeProfile?.id === profile.id);
              return (
                <TouchableOpacity
                  key={profile.type === 'self' ? 'self' : profile.id}
                  style={styles.profileItem}
                  onPress={() => handleSelectProfile(profile)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.avatarCircle,
                    { backgroundColor: colorFor(i) + '18' },
                    isActive && { borderColor: colorFor(i) },
                  ]}>
                    <Text style={[styles.avatarInitials, { color: colorFor(i) }]}>
                      {getInitials(profile.name)}
                    </Text>
                  </View>
                  <Text style={styles.profileName}>{profile.name}</Text>
                  {profile.relation && <Text style={styles.profileRelation}>{profile.relation}</Text>}
                </TouchableOpacity>
              );
            })}

            {/* Add Profile */}
            {profiles.length < 5 && (
              <TouchableOpacity
                style={styles.profileItem}
                onPress={() => navigation.navigate('FamilyProfiles')}
                activeOpacity={0.7}
              >
                <View style={styles.addCircle}>
                  <Ionicons name="add" size={32} color={COLORS.primary} />
                </View>
                <Text style={styles.addText}>{t('add_profile') || 'Add Profile'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.manageBtn}
          onPress={() => navigation.navigate('FamilyProfiles')}
        >
          <Ionicons name="settings-outline" size={18} color={COLORS.primary} />
          <Text style={styles.manageBtnText}>Manage Profiles</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backBtn: {
    position: 'absolute',
    top: SPACING.m,
    left: SPACING.l,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.l,
  },

  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl * 1.5,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 6,
    fontWeight: '500',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
  },

  profileItem: {
    alignItems: 'center',
    width: AVATAR_SIZE,
  },
  avatarCircle: {
    width: AVATAR_SIZE - 10,
    height: AVATAR_SIZE - 10,
    borderRadius: (AVATAR_SIZE - 10) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'transparent',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 10,
    textAlign: 'center',
  },
  profileRelation: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },

  addCircle: {
    width: AVATAR_SIZE - 10,
    height: AVATAR_SIZE - 10,
    borderRadius: (AVATAR_SIZE - 10) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    backgroundColor: COLORS.secondary,
  },
  addText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 10,
    textAlign: 'center',
  },

  footer: {
    padding: SPACING.l,
    alignItems: 'center',
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  manageBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
