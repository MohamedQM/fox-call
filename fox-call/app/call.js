import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Vibration,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Storage } from '../utils/storage';
import { makeCall, hangupCall, formatPhoneNumber, formatPhoneDisplay } from '../utils/twilio';
import InCallControls from '../components/InCallControls';
import { Colors } from '../constants/Colors';

const CALL_STATES = {
  CONNECTING: 'connecting',
  RINGING: 'ringing',
  IN_CALL: 'in-call',
  ENDED: 'ended',
  FAILED: 'failed',
};

export default function CallScreen() {
  const router = useRouter();
  const { number } = useLocalSearchParams();
  const [callState, setCallState] = useState(CALL_STATES.CONNECTING);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callSid, setCallSid] = useState(null);
  const [error, setError] = useState(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    initiateCall();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (callState === CALL_STATES.RINGING || callState === CALL_STATES.CONNECTING) {
      startPulseAnimation();
    } else {
      pulseAnim.setValue(1);
    }

    if (callState === CALL_STATES.IN_CALL) {
      startTimer();
    }

    return () => {
      pulseAnim.stopAnimation();
    };
  }, [callState]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const initiateCall = async () => {
    try {
      const accountSid = await Storage.getTwilioSid();
      const authToken = await Storage.getToken();
      const fromNumber = await Storage.getFromNumber();

      if (!accountSid || !authToken || !fromNumber) {
        setError('Missing Twilio credentials. Please configure in Settings.');
        setCallState(CALL_STATES.FAILED);
        return;
      }

      const toNumber = formatPhoneNumber(number);
      setCallState(CALL_STATES.CONNECTING);

      const result = await makeCall(accountSid, authToken, fromNumber, toNumber);

      if (result.success) {
        setCallSid(result.callSid);
        setCallState(CALL_STATES.RINGING);
        Vibration.vibrate([0, 200, 100, 200]);

        // Add to recent calls
        await Storage.addRecentCall({
          to: formatPhoneDisplay(number),
          from: fromNumber,
          status: 'ringing',
          callSid: result.callSid,
        });

        // Simulate call progress - in production, you'd poll the call status
        setTimeout(() => {
          if (callState === CALL_STATES.RINGING) {
            setCallState(CALL_STATES.IN_CALL);
          }
        }, 5000);
      } else {
        setError(result.error || 'Failed to make call');
        setCallState(CALL_STATES.FAILED);
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
      setCallState(CALL_STATES.FAILED);
    }
  };

  const handleHangup = async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (callSid) {
      const accountSid = await Storage.getTwilioSid();
      const authToken = await Storage.getToken();
      await hangupCall(accountSid, authToken, callSid);
    }

    setCallState(CALL_STATES.ENDED);
    Vibration.vibrate(100);

    setTimeout(() => {
      router.back();
    }, 1500);
  };

  const getStatusText = () => {
    switch (callState) {
      case CALL_STATES.CONNECTING:
        return 'Connecting...';
      case CALL_STATES.RINGING:
        return 'Ringing...';
      case CALL_STATES.IN_CALL:
        return formatDuration(callDuration);
      case CALL_STATES.ENDED:
        return 'Call Ended';
      case CALL_STATES.FAILED:
        return 'Call Failed';
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    switch (callState) {
      case CALL_STATES.CONNECTING:
      case CALL_STATES.RINGING:
        return Colors.warning;
      case CALL_STATES.IN_CALL:
        return Colors.success;
      case CALL_STATES.ENDED:
        return Colors.textSecondary;
      case CALL_STATES.FAILED:
        return Colors.danger;
      default:
        return Colors.text;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Animated Avatar */}
        <View style={styles.avatarContainer}>
          <Animated.View
            style={[
              styles.avatarPulse,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <View style={styles.avatar}>
            <Text style={styles.avatarIcon}>📞</Text>
          </View>
        </View>

        {/* Phone Number */}
        <Text style={styles.phoneNumber}>
          {formatPhoneDisplay(number || '')}
        </Text>

        {/* Call Status */}
        <Text style={[styles.callStatus, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>

        {/* Error Message */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Call Duration for active calls */}
        {callState === CALL_STATES.IN_CALL && (
          <Text style={styles.durationLabel}>In Call</Text>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {callState === CALL_STATES.FAILED || callState === CALL_STATES.ENDED ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        ) : (
          <InCallControls
            onMute={() => setIsMuted(!isMuted)}
            onSpeaker={() => setIsSpeaker(!isSpeaker)}
            onHangup={handleHangup}
            isMuted={isMuted}
            isSpeaker={isSpeaker}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  avatarPulse: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.primary + '20',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  avatarIcon: {
    fontSize: 48,
  },
  phoneNumber: {
    fontSize: 28,
    fontWeight: '300',
    color: Colors.text,
    letterSpacing: 2,
  },
  callStatus: {
    fontSize: 18,
    fontWeight: '500',
  },
  durationLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: -4,
  },
  errorText: {
    fontSize: 13,
    color: Colors.danger,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginTop: 4,
  },
  controls: {
    paddingBottom: 50,
    alignItems: 'center',
  },
  backButton: {
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
