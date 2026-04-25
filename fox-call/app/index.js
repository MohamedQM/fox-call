import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Vibration,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Storage } from '../utils/storage';
import { formatPhoneDisplay } from '../utils/twilio';
import DialPad from '../components/DialPad';
import RecentCalls from '../components/RecentCalls';
import { Colors } from '../constants/Colors';

export default function HomeScreen() {
  const router = useRouter();
  const [number, setNumber] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [recentCalls, setRecentCalls] = useState([]);

  useEffect(() => {
    checkConfig();
    loadRecentCalls();
  }, []);

  const checkConfig = async () => {
    const configured = await Storage.isConfigured();
    setIsConfigured(configured);
  };

  const loadRecentCalls = async () => {
    const calls = await Storage.getRecentCalls();
    setRecentCalls(calls);
  };

  const handleDialPress = (digit) => {
    if (number.length < 15) {
      setNumber((prev) => prev + digit);
      Vibration.vibrate(30);
    }
  };

  const handleDelete = () => {
    setNumber((prev) => prev.slice(0, -1));
  };

  const handleCall = async () => {
    if (!isConfigured) {
      Alert.alert(
        'Not Configured',
        'Please set up your Twilio credentials first.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => router.push('/settings') },
        ]
      );
      return;
    }

    if (!number || number.length < 3) {
      Alert.alert('Invalid Number', 'Please enter a valid phone number.');
      return;
    }

    router.push({
      pathname: '/call',
      params: { number: number },
    });
  };

  const handleRecentCall = (call) => {
    setNumber(call.to.replace(/[^\d+]/g, ''));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appName}>Fox Call</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => router.push('/settings')}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {!isConfigured && (
        <TouchableOpacity
          style={styles.warningBanner}
          onPress={() => router.push('/settings')}
        >
          <Text style={styles.warningText}>
            ⚠️ Tap here to configure your Twilio credentials
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.displayContainer}>
        <TextInput
          style={styles.numberDisplay}
          value={number ? formatPhoneDisplay(number) : ''}
          placeholder="Enter number"
          placeholderTextColor={Colors.textMuted}
          onChangeText={(text) => setNumber(text.replace(/[^\d+]/g, ''))}
          keyboardType="phone-pad"
          textAlign="center"
          maxLength={15}
        />
        {number ? (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteText}>⌫</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <DialPad onPress={handleDialPress} onLongPress={(d) => setNumber((p) => p + d)} />

      <View style={styles.callButtonContainer}>
        <TouchableOpacity
          style={[
            styles.callButton,
            !isConfigured && styles.callButtonDisabled,
          ]}
          onPress={handleCall}
          disabled={!isConfigured && !number}
        >
          <Text style={styles.callButtonText}>📞</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recentContainer}>
        <RecentCalls calls={recentCalls} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
  },
  settingsButton: {
    padding: 8,
  },
  settingsIcon: {
    fontSize: 24,
  },
  warningBanner: {
    backgroundColor: Colors.warning + '30',
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.warning + '50',
  },
  warningText: {
    color: Colors.warning,
    fontSize: 13,
    textAlign: 'center',
  },
  displayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 10,
  },
  numberDisplay: {
    flex: 1,
    fontSize: 32,
    fontWeight: '300',
    color: Colors.text,
    letterSpacing: 2,
    paddingVertical: 8,
  },
  deleteButton: {
    padding: 8,
  },
  deleteText: {
    fontSize: 24,
    color: Colors.textSecondary,
  },
  callButtonContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  callButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.callGreen,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: Colors.callGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  callButtonDisabled: {
    backgroundColor: Colors.surfaceLight,
  },
  callButtonText: {
    fontSize: 28,
  },
  recentContainer: {
    flex: 1,
  },
});
