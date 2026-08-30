import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const actions = ['Doctors', 'Labs', 'Medicine', 'Home Care'];

export default function QuickActions() {
  return (
    <View style={styles.container}>
      {actions.map((a) => (
        <TouchableOpacity key={a} style={styles.action}>
          <Text style={styles.actionText}>{a}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  action: { flex: 1, padding: 12, marginHorizontal: 4, backgroundColor: '#f5f5f5', borderRadius: 8, alignItems: 'center' },
  actionText: { fontWeight: '600' }
});
