import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';

// Video consultation is not wired to a real calling backend yet.
// Honest placeholder until a video provider is integrated.
export default function VideoConsultation({ navigation }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Video Consultation</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <Ionicons name="videocam-outline" size={42} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>Coming soon</Text>
        <Text style={styles.sub}>
          Video calls will be available here once secure video calling is enabled.
          You can still book in-person and chat consultations.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.secondary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  sub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21 },
  btn: {
    marginTop: 24, backgroundColor: COLORS.primary, borderRadius: 12,
    paddingHorizontal: 28, paddingVertical: 13,
  },
  btnText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
});
