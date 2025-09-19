import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
/**
 * Azure Function for SignalR negotiate endpoint with JWT authentication
 * This function validates JWT tokens from Azure AD and generates SignalR connection info
 */
export declare function negotiate(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit>;
//# sourceMappingURL=negotiate.d.ts.map