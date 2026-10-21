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
    communityAlertsEnabled?: boolean;
    autoCallEnabled?: boolean;
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
  verificationStatus: 'verified' | 'pending_verification' | 'rejected';
  inviteToken?: string;
  verifiedAt?: string;
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
  status: 'QUEUED' | 'DELIVERED' | 'FAILED' | 'DEMO_DISPATCHED' | 'delivered' | 'sent' | 'pending' | 'failed';
  attempts?: number;
  providerMessageId?: string;
  details?: string | null;
  deliveryTimestamp?: string;
  acknowledged?: boolean;
  acknowledgedAt?: string;
}

export interface SOSEvent {
  id: string;
  userId: string;
  idempotencyKey: string;
  triggerSource: 'manual' | 'voice';
  status: 'CREATED' | 'LOCATION_ACQUIRED' | 'ALERTS_QUEUED' | 'ALERTS_SENT' | 'PARTIALLY_FAILED' | 'RESOLVED' | 'active' | 'cancelled';
  createdAt: string;
  timestamp?: string; // backwards compatibility
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracy?: number | null;
  locationLink?: string | null;
  coordinates?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null;
  batteryLevel?: number | null;
  notes?: string | null;
  timeline?: Array<{
    status: string;
    message: string;
    timestamp: string;
  }>;
  callWorkflow?: {
    status: string;
    provider: string;
    primaryContactId?: string;
    primaryContactName?: string;
    primaryContactPhone?: string;
    supportedAction?: string;
    timestamp?: string;
  };

  cancelledAt?: string | null;
  cancellationTimestamp?: string | null;
  cancellationReason?: string | null;
  notifications: NotificationStatus[];
}

export interface Journey {
  id: string;
  userId: string;
  destination: string;
  expectedArrivalTime: string;
  status: 'ACTIVE' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
  sharedContacts: string[];
  lastLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    updatedAt: string;
  };
  createdAt: string;
  completedAt?: string;
}

export interface CommunityRequest {
  id: string;
  userId: string;
  incidentId?: string;
  category: string;
  description: string;
  radiusKm: number;
  status: 'OPEN' | 'ACCEPTED' | 'RESOLVED' | 'EXPIRED';
  latitude: number;
  longitude: number;
  responders: Array<{
    helperId: string;
    helperName: string;
    acceptedAt: string;
  }>;
  createdAt: string;
  expiresAt: string;
}

