import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ACCESS_TOKEN: 'foxcall_access_token',
  TWILIO_SID: 'foxcall_twilio_sid',
  FROM_NUMBER: 'foxcall_from_number',
  RECENT_CALLS: 'foxcall_recent_calls',
  SETTINGS: 'foxcall_settings',
};

export const Storage = {
  async saveToken(token) {
    await AsyncStorage.setItem(KEYS.ACCESS_TOKEN, token);
  },

  async getToken() {
    return await AsyncStorage.getItem(KEYS.ACCESS_TOKEN);
  },

  async saveTwilioSid(sid) {
    await AsyncStorage.setItem(KEYS.TWILIO_SID, sid);
  },

  async getTwilioSid() {
    return await AsyncStorage.getItem(KEYS.TWILIO_SID);
  },

  async saveFromNumber(number) {
    await AsyncStorage.setItem(KEYS.FROM_NUMBER, number);
  },

  async getFromNumber() {
    return await AsyncStorage.getItem(KEYS.FROM_NUMBER);
  },

  async saveRecentCalls(calls) {
    await AsyncStorage.setItem(KEYS.RECENT_CALLS, JSON.stringify(calls));
  },

  async getRecentCalls() {
    const data = await AsyncStorage.getItem(KEYS.RECENT_CALLS);
    return data ? JSON.parse(data) : [];
  },

  async addRecentCall(call) {
    const calls = await this.getRecentCalls();
    calls.unshift({ ...call, timestamp: Date.now() });
    if (calls.length > 50) calls.pop();
    await this.saveRecentCalls(calls);
    return calls;
  },

  async clearAll() {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  },

  async isConfigured() {
    const token = await this.getToken();
    const sid = await this.getTwilioSid();
    return !!(token && sid);
  },
};
