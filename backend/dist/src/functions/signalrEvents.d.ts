import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
export declare function onConnected(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit>;
export declare function onDisconnected(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit>;
export declare function onMessage(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit>;
//# sourceMappingURL=signalrEvents.d.ts.map