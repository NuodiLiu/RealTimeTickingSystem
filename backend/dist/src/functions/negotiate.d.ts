import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
/**
 * Azure Function for SignalR negotiate endpoint with App JWT authentication
 * This function validates App JWT tokens (signed by our backend) and generates SignalR connection info
 */
export declare function negotiate(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit>;
//# sourceMappingURL=negotiate.d.ts.map