import { Server } from "socket.io";
import type { FeedbackShowPayload, ServerToDevice } from "./types";
export declare class DeviceGateway {
    private static _io;
    static init(httpServer: any): Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
    static io(): Server;
    static publish(deviceId: string, message: ServerToDevice): void;
    static notifyDashboard(event: {
        type: string;
        payload: any;
    }): void;
    static notifyFeedback(deviceId: string, payload: FeedbackShowPayload): void;
    static dismiss(deviceId: string): void;
    static lockAssigned(deviceId: string, payload: any): void;
}
//# sourceMappingURL=deviceSocket.d.ts.map