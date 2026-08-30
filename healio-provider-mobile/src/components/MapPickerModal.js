import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import styles from './MapPickerModal.styles';

// Interactive map picker using Leaflet + OpenStreetMap inside a WebView.
// No API key, works in Expo Go.
const DEFAULT = { lat: 20.5937, lng: 78.9629 };

function buildHtml(lat, lng) {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0;padding:0}</style>
</head><body><div id="map"></div>
<script>
  var lat=${lat}, lng=${lng};
  var map=L.map('map').setView([lat,lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
  var marker=L.marker([lat,lng],{draggable:true}).addTo(map);
  function send(){var p=marker.getLatLng();window.ReactNativeWebView.postMessage(JSON.stringify({lat:p.lat,lng:p.lng}));}
  marker.on('dragend',send);
  map.on('click',function(e){marker.setLatLng(e.latlng);send();});
  send();
</script></body></html>`;
}

export default function MapPickerModal({ visible, initialLat, initialLng, onClose, onConfirm }) {
  const startLat = initialLat ?? DEFAULT.lat;
  const startLng = initialLng ?? DEFAULT.lng;
  const [picked, setPicked] = useState({ latitude: startLat, longitude: startLng });
  const html = useMemo(() => buildHtml(startLat, startLng), [startLat, startLng]);

  const onMessage = (e) => {
    try {
      const { lat, lng } = JSON.parse(e.nativeEvent.data);
      if (typeof lat === 'number' && typeof lng === 'number') setPicked({ latitude: lat, longitude: lng });
    } catch (err) { /* ignore */ }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Set hospital location</Text>
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
          <Text style={styles.coords}>📍 {picked.latitude.toFixed(5)}, {picked.longitude.toFixed(5)}</Text>
          <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm(picked)}>
            <Text style={styles.confirmText}>Use this location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
