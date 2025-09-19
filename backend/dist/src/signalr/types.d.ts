export type DeviceMode = 'REGISTRATION' | 'FEEDBACK';
export type FeedbackShowPayload = {
    sessionId: string;
    caseId: string;
    staff: {
        id: string;
        name: string;
    };
    expireAt: string;
};
export type ServerToDevice = {
    type: "SHOW_FEEDBACK";
    payload: FeedbackShowPayload;
} | {
    type: "DISMISS";
} | {
    type: "PING";
    payload?: {
        now: string;
    };
} | {
    type: "LOCK_ASSIGNED";
    payload: any;
} | {
    type: 'MODE_CHANGED';
    payload: {
        mode: DeviceMode;
    };
} | {
    type: 'UNPAIRED';
};
export type DeviceToServer = {
    type: "PONG";
    payload?: {
        now: string;
    };
} | {
    type: "DELIVERED";
    payload: {
        sessionId: string;
    };
} | {
    type: "LEASE";
    payload: {
        deviceId: string;
    };
} | {
    type: "STATUS";
    payload?: never;
} | {
    type: "FEEDBACK_UPDATE";
    payload?: any;
} | {
    type: "FEEDBACK_CANCELLED";
    payload: {
        sessionId: string;
    };
};
export type AuthedDevice = {
    deviceId: string;
    mode: DeviceMode;
};
export interface SignalRConfig {
    connectionString: string;
    hubName: string;
}
export interface DeviceConnectionInfo {
    deviceId: string;
    connectionId: string;
    mode: DeviceMode;
    connectedAt: Date;
    lastSeen: Date;
}
export interface DashboardConnectionInfo {
    connectionId: string;
    userId?: string;
    connectedAt: Date;
}
export interface DeviceHubMethods {
    showFeedback: (payload: FeedbackShowPayload) => void;
    dismiss: () => void;
    ping: (payload?: {
        now: string;
    }) => void;
    lockAssigned: (payload: any) => void;
    modeChanged: (payload: {
        mode: DeviceMode;
    }) => void;
    unpaired: () => void;
}
export interface DeviceClientMethods {
    pong: (payload?: {
        now: string;
    }) => void;
    delivered: (payload: {
        sessionId: string;
    }) => void;
    lease: (payload: {
        deviceId: string;
    }) => void;
    status: () => void;
    feedbackUpdate: (payload?: any) => void;
    feedbackCancelled: (payload: {
        sessionId: string;
    }) => void;
}
export interface DashboardHubMethods {
    caseUpdated: (payload: {
        id: string;
        status: string;
    }) => void;
    deviceUpdated: (payload: {
        id: string;
        isBusy: boolean;
        isOnline: boolean;
    }) => void;
    deviceConnected: (payload: {
        deviceId: string;
        mode: DeviceMode;
    }) => void;
    deviceDisconnected: (payload: {
        deviceId: string;
    }) => void;
}
export interface SignalRMessage {
    type: string;
    payload?: any;
    target?: string;
    connectionId?: string;
}
//# sourceMappingURL=types.d.ts.map