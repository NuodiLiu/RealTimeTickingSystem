export type DeviceMode = 'REGISTRATION' | 'FEEDBACK';

export type FeedbackShowPayload = {
  sessionId: string;
  caseId: string;
  staff: { id: string; name: string };
  expireAt: string; // ISO
};

export type ServerToDevice =
  | { type: "SHOW_FEEDBACK"; payload: FeedbackShowPayload }
  | { type: "DISMISS" }
  | { type: "PING"; payload?: { now: string } }
  | { type: "LOCK_ASSIGNED"; payload: any } 
  | { type: 'MODE_CHANGED'; payload: { mode: DeviceMode } }
  | { type: 'UNPAIRED' };

export type DeviceToServer =
  | { type: "PONG"; payload?: { now: string } }
  | { type: "DELIVERED"; payload: { sessionId: string } }  
  | { type: "LEASE"; payload: { deviceId: string } }       
  | { type: "STATUS"; payload?: never }
  | { type: "FEEDBACK_UPDATE"; payload?: any }            
  | { type: "FEEDBACK_CANCELLED"; payload: { sessionId: string } }; 

export type AuthedDevice = { deviceId: string; mode: DeviceMode };
