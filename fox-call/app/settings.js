import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Storage } from '../utils/storage';
import { Colors } from '../constants/Colors';

export default function SettingsScreen() {
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const sid = await Storage.getTwilioSid();
    const token = await Storage.getToken();
    const from = await Storage.getFromNumber();
    if (sid) setAccountSid(sid);
    if (token) setAuthToken(token);
    if (from) setFromNumber(from);
  };

  const handleSave = async () => {
    if (!accountSid.trim()) {
      Alert.alert('Error', 'Please enter your Twilio Account SID');
      return;
    }
    if (!authToken.trim()) {
      Alert.alert('Error', 'Please enter your Twilio Auth Token');
      return;
    }
    if (!fromNumber.trim()) {
      Alert.alert('Error', 'Please enter your Twilio phone number');
      return;
    }

    setLoading(true);
    try {
      await Storage.saveTwilioSid(accountSid.trim());
      await Storage.saveToken(authToken.trim());
      await Storage.saveFromNumber(fromNumber.trim());
      Alert.alert('Success', 'Your Twilio credentials have been saved!', [
        { text: 'OK' },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save credentials');
    }
    setLoading(false);
  };

  const handleClear = () => {
    Alert.alert(
      'Clear Credentials',
      'Are you sure you want to remove all saved credentials?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await Storage.clearAll();
            setAccountSid('');
            setAuthToken('');
            setFromNumber('');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Twilio Configuration</Text>
            <Text style={styles.sectionDesc}>
              Enter your Twilio Account SID, Auth Token, and your Twilio phone
              number to make outbound calls. You can find these in your Twilio
              Console dashboard.
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Account SID</Text>
            <TextInput
              style={styles.input}
              value={accountSid}
              onChangeText={setAccountSid}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>Starts with "AC"</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Auth Token</Text>
            <View style={styles.tokenRow}>
              <TextInput
                style={[styles.input, styles.tokenInput]}
                value={authToken}
                onChangeText={setAuthToken}
                placeholder="Your auth token"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showToken}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowToken(!showToken)}
              >
                <Text style={styles.eyeIcon}>{showToken ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Your Twilio Number</Text>
            <TextInput
              style={styles.input}
              value={fromNumber}
              onChangeText={setFromNumber}
              placeholder="+1234567890"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>
              The Twilio phone number that will make the calls (E.164 format)
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Saving...' : 'Save Credentials'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
            <Text style={styles.clearButtonText}>Clear All Credentials</Text>
          </TouchableOpacity>

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>How it works</Text>
            <Text style={styles.infoText}>
              1. Sign up at twilio.com and get a phone number{'\n'}
              2. Copy your Account SID and Auth Token from the console{'\n'}
              3. Enter your Twilio phone number above{'\n'}
              4. Save and start making calls!{'\n'}
              {'\n'}
              Your credentials are stored securely on your device only.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  section: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: Colors.text,
    fontSize: 16,
  },
  tokenRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tokenInput: {
    flex: 1,
  },
  eyeButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
  },
  eyeIcon: {
    fontSize: 20,
  },
  hint: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  clearButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.danger + '40',
  },
  clearButtonText: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
