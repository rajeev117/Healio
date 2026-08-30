import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '../constants/theme';
import FeatureScreen from '../components/FeatureScreen';

export default function WalletHistory({ navigation }) {
  return (
    <FeatureScreen
      navigation={navigation}
      title="Ledger (deprecated)"
      subtitle="Use the Ledger screen for transaction history and the Earnings screen for balances."
      badge="Ledger"
      primaryAction={{ label: 'Open ledger', onPress: () => navigation.navigate('Ledger') }}
      secondaryAction={{ label: 'Open earnings', onPress: () => navigation.navigate('Earnings') }}
      sections={[
        {
          title: 'Note',
          children: (
            <View style={{ gap: 8 }}>
              <Text style={{ color: COLORS.textSecondary }}>This legacy wallet history page is preserved for compatibility.</Text>
            </View>
          ),
        },
      ]}
    />
  );
}
