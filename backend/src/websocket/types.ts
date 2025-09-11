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
  | { type: "LOCK_ASSIGNED"; payload: any } // 可选：给 REGISTRATION 使用
  | { type: 'MODE_CHANGED'; payload: { mode: DeviceMode } }
  | { type: 'UNPAIRED' };

export type DeviceToServer =
  | { type: "PONG"; payload?: { now: string } }
  | { type: "DELIVERED"; payload: { sessionId: string } }  // 反馈页已展示
  | { type: "LEASE"; payload: { deviceId: string } }       // 主动续租
  | { type: "STATUS"; payload?: never }
  | { type: "FEEDBACK_UPDATE"; payload?: any }            // 设备状态变更、日志等
  | { type: "FEEDBACK_CANCELLED"; payload: { sessionId: string } }; // 用户取消反馈

export type AuthedDevice = { deviceId: string; mode: DeviceMode };
