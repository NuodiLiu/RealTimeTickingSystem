export declare class AzureSignalRServerlessService {
    private static instance;
    private constructor();
    static getInstance(): AzureSignalRServerlessService;
    sendToGroup(group: string, message: any): Promise<void>;
    sendToUser(userId: string, message: any): Promise<void>;
    sendToAllDevices(message: any): Promise<void>;
    sendToDashboard(message: any): Promise<void>;
    sendToDevice(deviceId: string, message: any): Promise<void>;
    addUserToGroup(userId: string, groupName: string): Promise<void>;
    removeUserFromGroup(userId: string, groupName: string): Promise<void>;
    getConnectionInfo(userId: string): {
        url: string;
        accessToken: string;
    };
    healthCheck(): Promise<{
        status: string;
        serverless: boolean;
    }>;
    handleConnect(userId: string, connectionId: string): Promise<void>;
    handleDisconnect(userId: string, connectionId: string): Promise<void>;
    handleMessage(userId: string, message: any): Promise<void>;
}
//# sourceMappingURL=serverless-service.d.ts.map