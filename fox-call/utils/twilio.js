/**
 * Twilio Voice API integration for Fox Call
 * Uses Twilio REST API to make outbound calls
 */

const TWILIO_BASE_URL = 'https://api.twilio.com/2010-04-01';

/**
 * Make an outbound call using Twilio REST API
 * @param {string} accountSid - Twilio Account SID
 * @param {string} authToken - Twilio Auth Token
 * @param {string} fromNumber - The Twilio phone number to call from
 * @param {string} toNumber - The phone number to call
 * @returns {Promise<object>} - The call details
 */
export async function makeCall(accountSid, authToken, fromNumber, toNumber) {
  const url = `${TWILIO_BASE_URL}/Accounts/${accountSid}/Calls.json`;

  const credentials = btoa(`${accountSid}:${authToken}`);

  const params = new URLSearchParams();
  params.append('To', toNumber);
  params.append('From', fromNumber);
  params.append(
    'Url',
    'https://handler.twilio.com/twiml/EH8de4e4c7e0e0e0e0e0e0e0e0e0e0e0e0'
  );

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Twilio API error: ${response.status}`);
    }

    return {
      success: true,
      callSid: data.sid,
      status: data.status,
      to: data.to,
      from: data.from,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get call status from Twilio
 */
export async function getCallStatus(accountSid, authToken, callSid) {
  const url = `${TWILIO_BASE_URL}/Accounts/${accountSid}/Calls/${callSid}.json`;
  const credentials = btoa(`${accountSid}:${authToken}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    const data = await response.json();
    return {
      success: true,
      status: data.status,
      duration: data.duration,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Hang up a call using Twilio REST API
 */
export async function hangupCall(accountSid, authToken, callSid) {
  const url = `${TWILIO_BASE_URL}/Accounts/${accountSid}/Calls/${callSid}.json`;
  const credentials = btoa(`${accountSid}:${authToken}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'Status=completed',
    });

    const data = await response.json();
    return {
      success: true,
      status: data.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Format phone number to E.164 format
 */
export function formatPhoneNumber(number) {
  let cleaned = number.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  return cleaned;
}

/**
 * Format phone number for display
 */
export function formatPhoneDisplay(number) {
  const cleaned = number.replace(/[^\d]/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return number;
}
