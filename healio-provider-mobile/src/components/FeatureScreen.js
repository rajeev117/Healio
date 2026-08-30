import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import styles from './FeatureScreen.styles';

function StatCard({ item }) {
  return (
    <View style={[styles.statCard, { backgroundColor: item.tint || COLORS.surface }]}>
      <View style={[styles.statIcon, { backgroundColor: item.iconBg || COLORS.white }]}>
        <Ionicons name={item.icon} size={18} color={item.color || COLORS.primary} />
      </View>
      <Text style={styles.statValue}>{item.value}</Text>
      <Text style={styles.statLabel}>{item.label}</Text>
    </View>
  );
}

function SectionCard({ section }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        {section.actionLabel ? <Text style={styles.sectionAction}>{section.actionLabel}</Text> : null}
      </View>
      {section.children}
    </View>
  );
}

export default function FeatureScreen({
  navigation,
  title,
  subtitle,
  badge,
  stats = [],
  primaryAction,
  secondaryAction,
  sections = [],
  children,
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
              <Ionicons name="chevron-back" size={20} color={COLORS.text} />
            </TouchableOpacity>
            {badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : <View style={{ width: 40 }} />}
          </View>

          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          {(primaryAction || secondaryAction) && (
            <View style={styles.actionsRow}>
              {primaryAction ? (
                <TouchableOpacity style={styles.primaryBtn} onPress={primaryAction.onPress}>
                  <Text style={styles.primaryBtnText}>{primaryAction.label}</Text>
                </TouchableOpacity>
              ) : null}
              {secondaryAction ? (
                <TouchableOpacity style={styles.secondaryBtn} onPress={secondaryAction.onPress}>
                  <Text style={styles.secondaryBtnText}>{secondaryAction.label}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>

        {stats.length > 0 && (
          <View style={styles.statsGrid}>
            {stats.map((item) => <StatCard key={item.label} item={item} />)}
          </View>
        )}

        {sections.map((section) => (
          <SectionCard key={section.title} section={section} />
        ))}

        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
