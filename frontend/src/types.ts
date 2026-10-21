export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  phone?: string;
  name?: string;
  isDemo?: boolean;
  preferences?: {
    voiceTriggerEnabled?: boolean;
    smsAlerts?: boolean;
    whatsappAlerts?: boolean;
    locationHighAccuracy?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface TrustedContact {
  id: string;
  userId: string;
  name: string;
  phoneNumber: string;
  phone?: string;
  relationship: string;
  priority: number;
  createdAt: string;
  updatedAt?: string;
}

export interface NotificationStatus {
  contactId: string;
  name: string;
  phoneNumber?: string;
  phone?: string;
  channel: string;
  provider: string;
  status: 'delivered' | 'sent' | 'pending' | 'failed';
  deliveryTimestamp?: string;
  receiptId?: string;
}

export interface SOSEvent {
  id: string;
  userId: string;
  idempotencyKey: string;
  triggerSource: 'manual' | 'voice';
  status: 'active' | 'cancelled' | 'resolved';
  createdAt: string;
  timestamp?: string; // backwards compatibility
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracy?: number | null;
  coordinates?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null;
  batteryLevel?: number | null;
  notes?: string | null;
  cancelledAt?: string | null;
  cancellationTimestamp?: string | null;
  cancellationReason?: string | null;
  notifications: NotificationStatus[];
}
