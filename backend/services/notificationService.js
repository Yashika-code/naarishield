import dotenv from 'dotenv';
dotenv.config();

/**
 * Modular Notification Architecture for NariShield.ai
 * Supports:
 * 1. Safe Demo Mode (Logs to server console & audit trail, no unauthorized SMS/Calls)
 * 2. Twilio SMS
 * 3. Twilio Outbound Voice Calls (Telephony escalation)
 * 4. Meta WhatsApp Business Cloud API
 */
export class NotificationService {
  constructor() {
    this.smsProvider = process.env.SMS_PROVIDER || 'demo';
    this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    this.whatsappToken = process.env.WHATSAPP_API_TOKEN;
    this.whatsappPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  }

  isTwilioConfigured() {
    return Boolean(
      this.twilioAccountSid && 
      this.twilioAuthToken && 
      this.twilioPhoneNumber &&
      !this.twilioAccountSid.includes('xxxx')
    );
  }

  isWhatsAppConfigured() {
    return Boolean(
      this.whatsappToken && 
      this.whatsappPhoneId && 
      !this.whatsappToken.includes('xxxx')
    );
  }

  /**
   * Dispatch an Emergency SOS notification to a trusted contact
   */
  async dispatchSOSNotification({ contact, user, incident, locationLink }) {
    const timestamp = new Date().toISOString();
    const displayName = user.displayName || 'A NariShield User';
    const messageBody = `EMERGENCY ALERT: ${displayName} has triggered an SOS distress alert at ${new Date(incident.createdAt).toLocaleTimeString()}. Location: ${locationLink || 'Location unavailable'}. Please verify their safety or contact emergency services (112) immediately. Incident ID: ${incident.id}`;

    const deliveryRecord = {
      contactId: contact.id || contact._id,
      name: contact.name,
      phoneNumber: contact.phoneNumber,
      channel: 'SMS/WhatsApp',
      provider: this.smsProvider,
      status: 'QUEUED',
      attempts: 1,
      createdAt: timestamp,
      details: null
    };

    // 1. Production Twilio SMS
    if (this.isTwilioConfigured() && this.smsProvider === 'twilio') {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', contact.phoneNumber);
        params.append('From', this.twilioPhoneNumber);
        params.append('Body', messageBody);

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
          }
        );

        const result = await response.json();
        if (response.ok) {
          deliveryRecord.status = 'DELIVERED';
          deliveryRecord.provider = 'twilio-sms';
          deliveryRecord.providerMessageId = result.sid;
          deliveryRecord.details = 'Delivered to Twilio SMS Gateway';
        } else {
          deliveryRecord.status = 'FAILED';
          deliveryRecord.details = result.message || 'Twilio API rejection';
        }
      } catch (err) {
        deliveryRecord.status = 'FAILED';
        deliveryRecord.details = err.message;
      }
      return deliveryRecord;
    }

    // 2. Production WhatsApp Business API
    if (this.isWhatsAppConfigured() && this.smsProvider === 'whatsapp') {
      try {
        const cleanPhone = contact.phoneNumber.replace(/[^0-9]/g, '');
        const response = await fetch(
          `https://graph.facebook.com/v19.0/${this.whatsappPhoneId}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.whatsappToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: cleanPhone,
              type: 'text',
              text: { body: messageBody }
            })
          }
        );
        const result = await response.json();
        if (response.ok) {
          deliveryRecord.status = 'DELIVERED';
          deliveryRecord.provider = 'meta-whatsapp';
          deliveryRecord.providerMessageId = result.messages?.[0]?.id;
        } else {
          deliveryRecord.status = 'FAILED';
          deliveryRecord.details = result.error?.message || 'WhatsApp API rejection';
        }
      } catch (err) {
        deliveryRecord.status = 'FAILED';
        deliveryRecord.details = err.message;
      }
      return deliveryRecord;
    }

    // 3. Safe Local Demo Mode (Transparently indicated)
    deliveryRecord.status = 'DEMO_DISPATCHED';
    deliveryRecord.provider = 'safe-demo-mode';
    deliveryRecord.details = `Safe demo dispatch. In production, configure TWILIO_ACCOUNT_SID or WHATSAPP_API_TOKEN. Preview: "${messageBody.substring(0, 80)}..."`;
    console.log(`[NotificationService Demo] SOS Notification for ${contact.name} (${contact.phoneNumber}):\n  ${messageBody}`);

    return deliveryRecord;
  }

  /**
   * Dispatch Contact Invitation Link/Code
   */
  async sendContactInvitation({ contact, user, inviteToken }) {
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-contact?token=${inviteToken}&contactId=${contact.id}`;
    const inviterName = user.displayName || 'A user';
    const message = `Hello ${contact.name}, ${inviterName} has nominated you as their trusted emergency contact on NariShield.ai. Please confirm and verify your number by clicking: ${inviteUrl}`;

    console.log(`[NotificationService] Invitation for ${contact.name} (${contact.phoneNumber}): ${message}`);

    if (this.isTwilioConfigured() && this.smsProvider === 'twilio') {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', contact.phoneNumber);
        params.append('From', this.twilioPhoneNumber);
        params.append('Body', message);

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
          }
        );

        const result = await response.json();
        if (response.ok) {
          return {
            status: 'DELIVERED',
            provider: 'twilio-sms',
            providerMessageId: result.sid,
            inviteUrl,
            timestamp: new Date().toISOString()
          };
        } else {
          return {
            status: 'FAILED',
            provider: 'twilio-sms',
            details: result.message || 'Twilio rejected message',
            inviteUrl,
            timestamp: new Date().toISOString()
          };
        }
      } catch (err) {
        return {
          status: 'FAILED',
          provider: 'twilio-sms',
          details: err.message,
          inviteUrl,
          timestamp: new Date().toISOString()
        };
      }
    }

    return {
      status: 'DEMO_DISPATCHED',
      provider: 'safe-demo-mode',
      inviteUrl,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Supported server-side Telephony Call Trigger
   */
  async initiateEmergencyCall({ contact, user, incidentId }) {
    if (!this.isTwilioConfigured()) {
      return {
        status: 'DEMO_CALL_QUEUED',
        provider: 'telephony-demo',
        supportedAction: `tel:${contact.phoneNumber}`,
        message: 'Direct automated call requires configured Twilio Voice credentials. Use the web-native tel: action for immediate calling.'
      };
    }

    try {
      const authHeader = 'Basic ' + Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('To', contact.phoneNumber);
      params.append('From', this.twilioPhoneNumber);
      params.append('Url', 'https://demo.twilio.com/docs/voice.xml');

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Calls.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params
        }
      );

      const result = await response.json();
      if (response.ok) {
        return {
          status: 'INITIATED',
          provider: 'twilio-voice',
          callSid: result.sid,
          timestamp: new Date().toISOString()
        };
      }
      return {
        status: 'FAILED',
        error: result.message,
        supportedAction: `tel:${contact.phoneNumber}`
      };
    } catch (err) {
      return {
        status: 'FAILED',
        error: err.message,
        supportedAction: `tel:${contact.phoneNumber}`
      };
    }
  }
}

export const notificationService = new NotificationService();
