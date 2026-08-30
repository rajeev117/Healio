import React from 'react';
import { View, Text } from 'react-native';
import FeatureScreen from '../components/FeatureScreen';
import { COLORS } from '../constants/theme';

export default function Wallet({ navigation }) {
  return (
    <FeatureScreen
      navigation={navigation}
      title="Wallet (deprecated)"
      subtitle="The wallet UI has been replaced by the Earnings & Ledger screens."
      badge="Earnings"
      primaryAction={{ label: 'Open earnings', onPress: () => navigation.navigate('Earnings') }}
      secondaryAction={{ label: 'Open ledger', onPress: () => navigation.navigate('Ledger') }}
      sections={[
        {
          title: 'Note',
          children: (
            <View style={{ gap: 8 }}>
              <Text style={{ color: COLORS.textSecondary }}>This screen remains for compatibility and will be removed in a future release.</Text>
            </View>
          ),
        },
      ]}
    />
  );
}
