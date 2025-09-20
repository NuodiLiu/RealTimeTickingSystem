import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
/**
 * Azure Function for sending SignalR messages with App JWT authentication
 * This function validates App JWT tokens (signed by our backend) and allows authenticated users to send real-time messages
 */
export declare function sendMessage(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit>;
//# sourceMappingURL=sendMessage.d.ts.map