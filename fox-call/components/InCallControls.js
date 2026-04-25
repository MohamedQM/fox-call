import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

export default function InCallControls({
  onMute,
  onSpeaker,
  onHangup,
  isMuted,
  isSpeaker,
}) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.activeControl]}
          onPress={onMute}
        >
          <Text style={styles.controlIcon}>🎤</Text>
          <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isSpeaker && styles.activeControl]}
          onPress={onSpeaker}
        >
          <Text style={styles.controlIcon}>🔊</Text>
          <Text style={styles.controlLabel}>
            {isSpeaker ? 'Speaker On' : 'Speaker'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.hangupButton} onPress={onHangup}>
        <Text style={styles.hangupIcon}>📵</Text>
        <Text style={styles.hangupLabel}>End Call</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 30,
  },
  row: {
    flexDirection: 'row',
    gap: 40,
  },
  controlButton: {
    alignItems: 'center',
    gap: 6,
    padding: 12,
  },
  activeControl: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 16,
  },
  controlIcon: {
    fontSize: 32,
  },
  controlLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  hangupButton: {
    alignItems: 'center',
    backgroundColor: Colors.callRed,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 40,
    gap: 4,
  },
  hangupIcon: {
    fontSize: 28,
  },
  hangupLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
