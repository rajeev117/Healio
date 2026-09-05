import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { buildMapHtml, MAP_DEFAULT_CENTRE } from '../../../lib/mapHtml';
import { GOOGLE_MAPS_API_KEY } from '../services/env';

// Interactive location picker. Google Maps + Places search when
// GOOGLE_MAPS_API_KEY is set, Leaflet + OpenStreetMap when it isn't —
// see src/lib/mapHtml.js. Either way the pin stays fixed at the centre and the
// map moves underneath it, and the WebView posts the picked point back.

export default function MapPickerModal({ visible, initialLat, initialLng, onClose, onConfirm, title }) {
  const startLat = initialLat ?? MAP_DEFAULT_CENTRE.lat;
  const startLng = initialLng ?? MAP_DEFAULT_CENTRE.lng;
  // `picked` carries address/city too when the user chose a Places result, so
  // the caller can skip a redundant reverse-geocode round trip.
  const [picked, setPicked] = useState({ latitude: startLat, longitude: startLng });
  const html = useMemo(
    () => buildMapHtml(startLat, startLng, GOOGLE_MAPS_API_KEY),
    [startLat, startLng],
  );

  const onMessage = (e) => {
    try {
      const { lat, lng, address, city } = JSON.parse(e.nativeEvent.data);
      if (typeof lat !== 'number' || typeof lng !== 'number') return;
      setPicked({
        latitude: lat,
        longitude: lng,
        ...(address ? { address } : {}),
        ...(city ? { city } : {}),
      });
    } catch (err) { /* ignore malformed frames */ }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{title || 'Pick your location'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <WebView
          originWhitelist={['*']}
          source={{ html }}
          onMessage={onMessage}
          style={{ flex: 1 }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /></View>
          )}
        />

        <View style={styles.footer}>
          <Text style={styles.coords} numberOfLines={2}>
            {picked.address
              ? `📍 ${picked.address}`
              : `📍 ${picked.latitude.toFixed(5)}, ${picked.longitude.toFixed(5)}`}
          </Text>
          <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm(picked)}>
            <Text style={styles.confirmText}>Use this location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 10 },
  coords: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600', textAlign: 'center' },
  confirmBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  confirmText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
});
