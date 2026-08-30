import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import styles from './Chat.styles';

export default function Chat({ navigation }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Patient Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <Ionicons name="chatbubbles-outline" size={42} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>Coming Soon</Text>
        <Text style={styles.sub}>
          Secure patient messaging is under development. Real-time chat with your patients will be available here once the backend is live.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
