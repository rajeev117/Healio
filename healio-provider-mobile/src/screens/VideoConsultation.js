import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import styles from './VideoConsultation.styles';

// Video consultation is not wired to a real calling backend yet.
// Honest placeholder until WebRTC / a video provider is integrated.
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
          Video calling needs a secure calling backend. It will be enabled here once
          that integration is live. In the meantime you can use Chat and in-person consults.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
