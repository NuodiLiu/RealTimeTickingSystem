import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
export declare function webhookHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit>;
declare function handleSystemEvent(eventData: any, context: InvocationContext): Promise<HttpResponseInit>;
declare function handleUserEvent(eventData: any, context: InvocationContext): Promise<HttpResponseInit>;
export { handleSystemEvent, handleUserEvent };
//# sourceMappingURL=webhook-handler.d.ts.map