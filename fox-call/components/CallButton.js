import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

export default function CallButton({ onPress, type = 'call', disabled, size = 64 }) {
  const bgColor = type === 'call' ? Colors.callGreen : Colors.callRed;
  const icon = type === 'call' ? '📞' : '📵';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: bgColor,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{icon}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  disabled: {
    opacity: 0.4,
  },
  icon: {
    fontSize: 28,
  },
});
