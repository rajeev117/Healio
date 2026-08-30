import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';

const CONVERSATIONS = [
  { id: 'c1', doctorName: 'Dr. Ayaan Khan', specialty: 'General Physician', lastMessage: 'Take rest and complete the course of antibiotics.', time: '10:42 AM', unread: 1, online: true },
  { id: 'c2', doctorName: 'Dr. Priya Sharma', specialty: 'Dermatologist', lastMessage: 'The cream should show improvement in 7–10 days.', time: 'Yesterday', unread: 0, online: false },
  { id: 'c3', doctorName: 'Dr. Rahul Verma', specialty: 'Orthopaedic', lastMessage: 'Please share the X-ray report when ready.', time: '2 days ago', unread: 0, online: false },
];

const INITIAL_MESSAGES = [
  { id: 'm1', from: 'doctor', text: 'Hello! How are you feeling today?', time: '10:30 AM' },
  { id: 'm2', from: 'patient', text: 'Slightly better than yesterday, Doctor. The fever has reduced.', time: '10:32 AM' },
  { id: 'm3', from: 'doctor', text: 'Good to hear. Have you been taking the medicines on time?', time: '10:33 AM' },
  { id: 'm4', from: 'patient', text: 'Yes, taking all three after food as prescribed.', time: '10:35 AM' },
  { id: 'm5', from: 'doctor', text: 'Perfect. Continue for the full course. If fever comes back above 102°F, please visit the clinic.', time: '10:38 AM' },
  { id: 'm6', from: 'doctor', text: 'Take rest and complete the course of antibiotics.', time: '10:42 AM' },
];

const QUICK_REPLIES = [
  'Thank you, Doctor',
  'I have a question',
  'Feeling better now',
  'When should I follow up?',
];

function ConversationList({ onSelect }) {
  return (
    <FlatList
      data={CONVERSATIONS}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: SPACING.m, paddingTop: 8 }}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.convRow} onPress={() => onSelect(item)}>
          <View style={styles.convAvatar}>
            <Ionicons name="person" size={20} color={COLORS.primary} />
            {item.online && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.convInfo}>
            <View style={styles.convTopRow}>
              <Text style={styles.convName}>{item.doctorName}</Text>
              <Text style={styles.convTime}>{item.time}</Text>
            </View>
            <Text style={styles.convSpec}>{item.specialty}</Text>
            <Text style={styles.convLast} numberOfLines={1}>{item.lastMessage}</Text>
          </View>
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    />
  );
}

function ChatWindow({ conversation, onBack }) {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef();

  const send = (text) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, {
      id: `m${Date.now()}`, from: 'patient', text: text.trim(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    }]);
    setInputText('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.chatAvatar}>
          <Ionicons name="person" size={18} color={COLORS.primary} />
          {conversation.online && <View style={styles.onlineDotSm} />}
        </View>
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderName}>{conversation.doctorName}</Text>
          <Text style={[styles.chatHeaderSub, conversation.online && { color: COLORS.success }]}>
            {conversation.online ? 'Online' : conversation.specialty}
          </Text>
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="videocam-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="call-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMe = item.from === 'patient';
          return (
            <View style={[styles.bubbleWrap, isMe && styles.bubbleWrapRight]}>
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleDoctor]}>
                <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.text}</Text>
                <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>{item.time}</Text>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.quickRow}>
        {QUICK_REPLIES.map((qr) => (
          <TouchableOpacity key={qr} style={styles.quickChip} onPress={() => send(qr)}>
            <Text style={styles.quickChipText}>{qr}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.attachBtn}>
          <Ionicons name="attach" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor={COLORS.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          onPress={() => send(inputText)}
          disabled={!inputText.trim()}
        >
          <Ionicons name="send" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function Chat({ navigation, route }) {
  const [selectedConv, setSelectedConv] = useState(route?.params?.conversation || null);

  return (
    <SafeAreaView style={styles.safe}>
      {!selectedConv ? (
        <>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Messages</Text>
            <View style={{ width: 40 }} />
          </View>
          <ConversationList onSelect={setSelectedConv} />
        </>
      ) : (
        <ChatWindow conversation={selectedConv} onBack={() => setSelectedConv(null)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.surface,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  convRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  convAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.success,
    borderWidth: 2, borderColor: COLORS.background,
  },
  convInfo: { flex: 1 },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  convTime: { fontSize: 11, color: COLORS.textSecondary },
  convSpec: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', marginTop: 1 },
  convLast: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  unreadBadge: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },
  separator: { height: 1, backgroundColor: COLORS.border, marginLeft: 60 },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chatAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  onlineDotSm: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success,
    borderWidth: 1.5, borderColor: COLORS.background,
  },
  chatHeaderInfo: { flex: 1 },
  chatHeaderName: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  chatHeaderSub: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.surface,
  },
  messageList: { padding: SPACING.m, gap: 8 },
  bubbleWrap: { flexDirection: 'row', marginBottom: 4 },
  bubbleWrapRight: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '75%', borderRadius: 18, padding: 12,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  bubbleMe: {
    backgroundColor: COLORS.primary, borderColor: COLORS.primary,
    borderBottomLeftRadius: 18, borderBottomRightRadius: 4,
  },
  bubbleDoctor: {},
  bubbleText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  bubbleTextMe: { color: COLORS.white },
  bubbleTime: { fontSize: 10, color: COLORS.textSecondary, marginTop: 4, textAlign: 'right' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.7)' },
  quickRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: SPACING.m, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  quickChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  quickChipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: SPACING.m, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  attachBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.surface,
  },
  textInput: {
    flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: COLORS.surface,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.border },
});
