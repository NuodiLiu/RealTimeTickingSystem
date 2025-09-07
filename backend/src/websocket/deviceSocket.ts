// src/websocket/deviceSocket.ts
import WebSocket from 'ws';
import { Server } from 'http';
import { PairService } from '../services/pair.service';
import { parse } from 'url';

export function setupDeviceWebSocket(server: Server) {
    const wss = new WebSocket.Server({ 
        server,
        path: '/ws/device'
    });

// track active connections
    const deviceConnections = new Map<string, WebSocket>();

    wss.on('connection', async (ws: WebSocket, request: any) => {
        let deviceId: string | undefined;
        let deviceName: string | undefined;

        try {
            // extract device ID from url path
            const pathname = parse(request.url).pathname;
            deviceId = pathname?.split('/').pop();
            
            if (!deviceId) {
                ws.close(1008, 'Device ID required in URL path');
                return;
            }

            // get device credentials from query param or headers
            const url = new URL(request.url, 'ws://localhost');
            const token = url.searchParams.get('token') ||
                         request.headers.authorization?.replace('Bearer ', '');
            
            if (!token) {
                ws.close(1008, 'Device credentials required');
                return;
            }

            // validate credentials
            const deviceAuth = await PairService.validateDeviceCredentials(token);
            
            if (deviceAuth.deviceId !== deviceId) {
                ws.close(1008, 'Device ID mismatch');
                return;
            }

            deviceName = deviceAuth.device.name;
            console.log(`Device ${deviceId} (${deviceName}) connected via WebSocket`);
            
            // store connection
            deviceConnections.set(deviceId, ws);

            // send initial connection confirmation
            const status = await PairService.getDeviceStatus(deviceId);
            ws.send(JSON.stringify({
                type: 'connection_established',
                deviceInfo: {
                    id: status.deviceId,
                    name: status.name,
                    mode: status.mode,
                    status: status.status
                },
                currentLock: status.currentLock,
                timestamp: new Date()
            }));

            // handle incoming messages from device
            ws.on('message', async (message: string) => {
                try {
                    const data = JSON.parse(message.toString());
                    await handleDeviceMessage(deviceId!, data, ws);
                } catch (error) {
                    console.error(`WebSocket message error for device ${deviceId}:`, error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid message format'
                    }));
                }
            });

            // handle connection close
            ws.on('close', () => {
                console.log(`Device ${deviceId} (${deviceName}) disconnected`);
                deviceConnections.delete(deviceId!);
            });

            ws.on('error', (error: any) => {
                console.error(`WebSocket error for device ${deviceId}:`, error);
                deviceConnections.delete(deviceId!);
            });

        } catch (error) {
            console.error('WebSocket connection error:', error);
            ws.close(1008, 'Authentication failed');
        }
    });

    
    async function handleDeviceMessage(deviceId: string, data: any, ws: WebSocket) {
        switch (data.type) {
            case 'heartbeat':
                // heartbeat via WebSocket
                const heartbeatResult = await PairService.handleHeartbeat(deviceId);
                
                ws.send(JSON.stringify({
                    type: 'heartbeat_ack',
                    ...heartbeatResult
                }));
                break;
                
            case 'status_request':
                // device requests curr status
                const currentStatus = await PairService.getDeviceStatus(deviceId);
                
                ws.send(JSON.stringify({
                    type: 'status_response',
                    ...currentStatus
                }));
                break;
                
            case 'feedback_session_update':
                // device reports feedback session status change
                console.log(`📝 Feedback session update from device ${deviceId}:`, data);
                
                
                ws.send(JSON.stringify({
                    type: 'feedback_update_ack',
                    received: true,
                    timestamp: new Date()
                }));
                break;
                
            default:
                console.log(`Unknown message type from device ${deviceId}: ${data.type}`);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `Unknown message type: ${data.type}`
                }));
        }
    }

    function sendToDevice(deviceId: string, message: any): boolean {
        const ws = deviceConnections.get(deviceId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
            return true;
        }
        return false;
    }

    //  send message to all connected devices
    function broadcastToDevices(message: any): number {
        let sentCount = 0;
        
        deviceConnections.forEach((ws, deviceId) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
                sentCount++;
            }
        });
        
        return sentCount;
    }


    //  Send lock assignment notification to device
    function notifyDeviceOfLockAssignment(deviceId: string, lockData: any): boolean {
        return sendToDevice(deviceId, {
            type: 'lock_assigned',
            lock: lockData,
            timestamp: new Date()
        });
    }

    // send feedback session notification to device
    function notifyDeviceOfFeedbackSession(deviceId: string, feedbackSessionData: any): boolean {
        return sendToDevice(deviceId, {
            type: 'feedback_session_created',
            feedbackSession: feedbackSessionData,
            timestamp: new Date()
        });
    }

  
    function getOnlineDeviceCount(): number {
        return deviceConnections.size;
    }


    function getOnlineDeviceIds(): string[] {
        return Array.from(deviceConnections.keys());
    }

    // expose utility functions for use by other services
    const deviceSocket = {
        sendToDevice,
        broadcastToDevices,
        notifyDeviceOfLockAssignment,
        notifyDeviceOfFeedbackSession,
        getOnlineDeviceCount,
        getOnlineDeviceIds,
        // expose the WebSocket server instance
        wss
    };

    console.log('WebSocket server initialised for device connections');
    return deviceSocket;
}