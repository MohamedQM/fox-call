import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

const DIAL_KEYS = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

export default function DialPad({ onPress, onLongPress, disabled }) {
  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {DIAL_KEYS.map((item) => (
          <TouchableOpacity
            key={item.digit}
            style={[styles.key, disabled && styles.keyDisabled]}
            onPress={() => onPress(item.digit)}
            onLongPress={
              item.digit === '0' ? () => onLongPress?.('+') : undefined
            }
            activeOpacity={0.6}
            disabled={disabled}
          >
            <Text style={styles.digitText}>{item.digit}</Text>
            {item.letters ? (
              <Text style={styles.lettersText}>{item.letters}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const CIRCLE_SIZE = 72;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 252,
    gap: 12,
  },
  key: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: Colors.dialPadBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  keyDisabled: {
    opacity: 0.4,
  },
  digitText: {
    fontSize: 28,
    fontWeight: '500',
    color: Colors.dialPadText,
    lineHeight: 34,
  },
  lettersText: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.dialPadSubText,
    letterSpacing: 2,
    marginTop: -2,
  },
});
