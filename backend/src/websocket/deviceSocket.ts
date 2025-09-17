import { Server } from "socket.io";
import type { FeedbackShowPayload, ServerToDevice } from "./types";

export class DeviceGateway {
  private static _io: Server;

  static init(httpServer: any) {
    const io = new Server(httpServer, {
      path: "/ws",                              
      cors: {
        origin: (origin, callback) => {
          if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
          }
          
          // In production, check specific origins
          const allowedOrigins = [
            process.env.FRONTEND_URL || "http://localhost:3001",
            "capacitor://localhost", // Capacitor apps
            "ionic://localhost",     // Ionic apps
            null,                    // Mobile apps and Postman
            undefined                // No origin header
          ];
          
          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          
          return callback(new Error("Origin not allowed by CORS"), false);
        },
        credentials: true,
      },
      maxHttpBufferSize: 256 * 1024,               //  maxPayload
      transports: ["websocket"],                  
      allowEIO3: true,                        
    });

    DeviceGateway._io = io;
    return io;
  }

  static io(): Server {
    if (!DeviceGateway._io) throw new Error("DeviceGateway not initialized");
    return DeviceGateway._io;
  }

  // entry point to business layer 
  static publish(deviceId: string, message: ServerToDevice) {
    DeviceGateway.io().to(`device:${deviceId}`).emit("message", message);
  }

  // notify all dashboard-connected clients
  static notifyDashboard(event: { type: string; payload: any }) {
    DeviceGateway.io().emit("event", event);
  }

  // wrapper for WS naming
  static notifyFeedback(deviceId: string, payload: FeedbackShowPayload) {
    DeviceGateway.publish(deviceId, { type: "SHOW_FEEDBACK", payload });
  }

  static dismiss(deviceId: string) {
    DeviceGateway.publish(deviceId, { type: "DISMISS" });
  }
  static lockAssigned(deviceId: string, payload: any) {
    DeviceGateway.publish(deviceId, { type: "LOCK_ASSIGNED", payload });
  }
}
