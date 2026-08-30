import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import FeatureScreen from '../components/FeatureScreen';
import { COLORS } from '../constants/theme';
import styles from './Support.styles';

export default function Support({ navigation }) {
  return (
    <FeatureScreen
      navigation={navigation}
      title="Support & help desk"
      subtitle="A frontend support area for tickets, FAQs, and partner contact options."
      badge="Support"
      primaryAction={{ label: 'Contact support', onPress: () => navigation.navigate('Profile') }}
      secondaryAction={{ label: 'Open settings', onPress: () => navigation.navigate('Settings') }}
      sections={[
        {
          title: 'Common help topics',
          children: (
            <View style={{ gap: 10 }}>
              {['Login issues', 'Billing questions', 'Earnings & payouts', 'Upload problems'].map((item) => (
                <TouchableOpacity key={item} style={styles.card}>
                  <Text style={styles.cardText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ),
        },
      ]}
    />
  );
}
