import { FoxApi, SipCreds, CallStartResult } from './api';
import LinphoneCall, { CallEvent } from '../modules/linphone-call';

export type CallState = 'idle' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed';

interface Listener {
  onState?: (s: CallState) => void;
  onDuration?: (sec: number) => void;
  onError?: (msg: string) => void;
  onEnd?: () => void;
}

export class CallManager {
  private api: FoxApi;
  private listener: Listener = {};
  private state: CallState = 'idle';
  private startedAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentCall: CallStartResult | null = null;
  private muted = false;
  private speaker = false;
  private nativeUnsub: (() => void) | null = null;
  private calling = false; // Track if a call is in progress

  constructor(api: FoxApi) {
    this.api = api;
  }

  on(l: Listener) { this.listener = l; }

  isMuted() { return this.muted; }
  isSpeaker() { return this.speaker; }
  getState() { return this.state; }
  getCallInfo() { return this.currentCall; }
  isCalling() { return this.calling; }

  private setState(s: CallState) {
    this.state = s;
    this.listener.onState?.(s);
  }

  async startCall(to: string): Promise<CallStartResult> {
    // Prevent double calls
    if (this.calling) {
      this.listener.onError?.('يوجد مكالمة جارية بالفعل');
      throw new Error('Call in progress');
    }
    this.calling = true;
    this.setState('connecting');

    let res: CallStartResult;
    try {
      res = await this.api.startCall(to);
    } catch (e: any) {
      this.setState('failed');
      this.calling = false;
      const errMsg = e?.message || 'فشل بدء المكالمة';
      const friendly = this.translateError(errMsg);
      this.listener.onError?.(friendly);
      // Trigger onEnd so the UI goes back to dialer
      this.listener.onEnd?.();
      throw e;
    }
    this.currentCall = res;

    // Check if Linphone native module is available
    if (!LinphoneCall.isAvailable()) {
      this.setState('failed');
      this.calling = false;
      this.listener.onError?.('الوحدة الصوتية غير متاحة - يجب تثبيت نسخة محدثة من التطبيق');
      this.listener.onEnd?.();
      throw new Error('Linphone module not available');
    }

    // Subscribe to native call events
    this.nativeUnsub = LinphoneCall.addCallListener((evt: CallEvent) => {
      console.log('[CallManager] Native event:', evt.state, evt.reason);

      if (evt.state === 'ringing' || evt.state === 'outgoing_progress') {
        this.setState('ringing');
      } else if (evt.state === 'outgoing_init') {
        // Still connecting, keep state
      } else if (evt.state === 'connected') {
        this.setState('connected');
        this.startedAt = Date.now();
        this.startTimer();
      } else if (evt.state === 'ended') {
        this.cleanup('ended');
      } else if (evt.state === 'failed') {
        const reason = evt.reason || 'فشل الاتصال';
        console.error('[CallManager] Call failed:', reason);
        // Translate error if needed
        const friendly = this.translateError(reason);
        this.listener.onError?.(friendly);
        this.cleanup('failed');
      }
    });

    try {
      await LinphoneCall.startCall({
        username: res.sip.username,
        password: res.sip.password,
        domain: res.sip.domain,
        port: res.sip.port,
        protocol: res.sip.protocol,
        destination: to.replace(/^\+/, ''),
        callLimitSec: res.sip.callLimit,
      });
      this.setState('ringing');
    } catch (e: any) {
      const errMsg = e?.message || 'فشل تشغيل الصوت';
      const friendly = this.translateError(errMsg);
      console.error('[CallManager] Linphone startCall error:', errMsg);
      this.listener.onError?.(friendly);
      this.cleanup('failed');
      throw e;
    }
    return res;
  }

  private translateError(msg: string): string {
    const lower = msg.toLowerCase();
    // Network errors
    if (lower.includes('network') || lower.includes('unreachable') || lower.includes('timeout')) {
      return 'تعذر الاتصال بالخادم - تحقق من اتصال الإنترنت';
    }
    // SIP registration errors
    if (lower.includes('registration') || lower.includes('reg')) {
      return 'فشل التسجيل بخادم SIP - حاول مرة أخرى';
    }
    // TLS/SSL errors
    if (lower.includes('tls') || lower.includes('ssl') || lower.includes('certificate')) {
      return 'مشكلة في الاتصال الآمن - حاول مرة أخرى';
    }
    // Not found
    if (lower.includes('not found') || lower.includes('404')) {
      return 'الخدمة غير متاحة حالياً - حاول بعد قليل';
    }
    // Module errors
    if (lower.includes('module') || lower.includes('native')) {
      return 'التطبيق يحتاج تحديث - حمّل النسخة الأحدث';
    }
    // Balance
    if (lower.includes('رصيد') || lower.includes('balance')) {
      return msg; // Already in Arabic
    }
    // Already translated Arabic errors - pass through
    if (/[\u0600-\u06FF]/.test(msg)) {
      return msg;
    }
    // Default - return original
    return msg;
  }

  private startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      const sec = Math.floor((Date.now() - this.startedAt) / 1000);
      this.listener.onDuration?.(sec);
      const limit = this.currentCall?.sip.callLimit ?? 0;
      if (limit > 0 && sec >= limit) this.hangup();
    }, 1000);
  }

  async hangup() {
    try { await LinphoneCall.hangup(); } catch (e) {
      console.warn('[CallManager] hangup error:', e);
    }
    this.cleanup('ended');
  }

  async toggleMute() {
    this.muted = !this.muted;
    try { await LinphoneCall.setMute(this.muted); } catch (e) {
      console.warn('[CallManager] mute error:', e);
      // Revert on failure
      this.muted = !this.muted;
    }
    return this.muted;
  }

  async toggleSpeaker() {
    this.speaker = !this.speaker;
    try { await LinphoneCall.setSpeaker(this.speaker); } catch (e) {
      console.warn('[CallManager] speaker error:', e);
      // Revert on failure
      this.speaker = !this.speaker;
    }
    return this.speaker;
  }

  async sendDtmf(d: string) {
    try { await LinphoneCall.sendDtmf(d); } catch (e) {
      console.warn('[CallManager] DTMF error:', e);
    }
  }

  private cleanup(finalState: CallState) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.nativeUnsub) {
      this.nativeUnsub();
      this.nativeUnsub = null;
    }

    // Report call end to API
    const dur = this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0;
    const callId = (this.currentCall as any)?.callId;
    this.api.endCall(callId, dur).catch((e) => {
      console.warn('[CallManager] endCall API error:', e);
    });

    this.startedAt = 0;
    this.muted = false;
    this.speaker = false;
    this.calling = false;
    this.setState(finalState);

    // Delay onEnd callback so UI can show the final state briefly
    // before transitioning back to dialer
    setTimeout(() => {
      this.listener.onEnd?.();
    }, finalState === 'failed' ? 2000 : 1500);
  }

  destroy() {
    // Cancel any pending timer
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.nativeUnsub) {
      this.nativeUnsub();
      this.nativeUnsub = null;
    }
    this.calling = false;
    this.state = 'idle';
    this.currentCall = null;
  }
}
