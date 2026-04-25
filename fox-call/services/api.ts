import { decodeFoxToken, FoxTokenInfo } from './foxToken';

export interface UserInfo {
  userId: string;
  username: string;
  fullName: string;
  balance: number;
  cost: number;
  possibleCalls: number;
}

export interface SipCreds {
  username: string;
  password: string;
  domain: string;
  port: number;
  protocol: 'tls' | 'tcp' | 'udp';
  callLimit: number;
}

export interface CallStartResult {
  sip: SipCreds;
  from: string;
  to: string;
  balance: number;
  callId?: string;
}

export class FoxApi {
  private serverUrl: string;
  private userId: string;
  private deviceId: string;

  constructor(token: FoxTokenInfo, deviceId: string) {
    this.serverUrl = token.serverUrl.replace(/\/+$/, '');
    this.userId = token.userId;
    this.deviceId = deviceId;
  }

  static fromToken(rawToken: string, deviceId: string): FoxApi | null {
    const info = decodeFoxToken(rawToken);
    if (!info) return null;
    return new FoxApi(info, deviceId);
  }

  private headers(): Record<string, string> {
    return {
      'x-user-id': this.userId,
      'x-device-id': this.deviceId,
      'content-type': 'application/json',
      'accept': 'application/json',
    };
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.serverUrl}${path}`;

    try {
      const res = await this.fetchWithTimeout(url, {
        method,
        headers: this.headers(),
        body: body ? JSON.stringify(body) : undefined,
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        // Response is not JSON
      }

      if (!res.ok) {
        // Try to get error message from response
        const msg = data?.error || data?.message || data?.detail || `خطأ ${res.status}`;

        // Handle specific status codes
        if (res.status === 401) {
          throw new Error('التوكن منتهي أو غير صالح - سجّل دخول مرة أخرى');
        }
        if (res.status === 402 || res.status === 403) {
          throw new Error('الرصيد غير كافي - اشحن رصيدك أولاً');
        }
        if (res.status === 429) {
          throw new Error('طلبات كثيرة - انتظر قليلاً وحاول مرة أخرى');
        }

        throw new Error(msg);
      }

      return data as T;
    } catch (e: any) {
      if (e.name === 'AbortError') {
        throw new Error('انقطع الاتصال بالسيرفر - تحقق من الإنترنت');
      }
      if (e.message === 'Network request failed') {
        throw new Error('لا يوجد اتصال بالإنترنت');
      }
      // Re-throw if already a friendly error
      throw e;
    }
  }

  getMe() {
    return this.req<UserInfo>('GET', '/api/me');
  }

  getBalance() {
    return this.req<{ balance: number; cost: number }>('GET', '/api/balance');
  }

  startCall(to: string) {
    return this.req<CallStartResult>('POST', '/api/call/start', { to });
  }

  endCall(callId?: string, duration?: number) {
    return this.req<{ ok: boolean }>('POST', '/api/call/end', { callId, duration });
  }
}
