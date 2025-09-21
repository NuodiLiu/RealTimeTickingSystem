interface SignalRConnectionInfo {
    url: string;
    accessToken: string;
}
interface SignalRConfig {
    generateAccessToken(userId: string, roles?: string[]): string;
    getConnectionInfo(userId: string, hub?: string, roles?: string[]): SignalRConnectionInfo;
    sendToDevice(deviceId: string, message: any): Promise<void>;
    sendToDashboard(message: any): Promise<void>;
    sendToGroup(group: string, message: any): Promise<void>;
    sendToUser(userId: string, message: any): Promise<void>;
}
declare class AzureSignalRServiceConfig implements SignalRConfig {
    private connectionString;
    private hubName;
    private endpoint;
    private accessKey;
    constructor();
    private get hmacKey();
    private get baseEndpoint();
    private parseConnectionString;
    private buildClientToken;
    private buildServerToken;
    generateAccessToken(userId: string, roles?: string[]): string;
    getConnectionInfo(userId: string, hub?: string, roles?: string[]): SignalRConnectionInfo;
    sendToDevice(deviceId: string, message: any): Promise<void>;
    sendToDashboard(message: any): Promise<void>;
    sendToGroup(group: string, message: any): Promise<void>;
    sendToUser(userId: string, message: any): Promise<void>;
    addUserToGroup(userId: string, group: string): Promise<void>;
    removeUserFromGroup(userId: string, group: string): Promise<void>;
}
export declare const signalRConfig: AzureSignalRServiceConfig;
export { AzureSignalRServiceConfig };
export declare function validateSignalREnvironment(): boolean;
export declare function generateDeviceConnectionInfo(deviceId: string): SignalRConnectionInfo;
export declare function generateDashboardConnectionInfo(userId: string): SignalRConnectionInfo;
//# sourceMappingURL=config.d.ts.map