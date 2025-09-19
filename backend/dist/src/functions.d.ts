import './functions/negotiate';
import './functions/sendMessage';
import './functions/signalrEvents';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
export declare function httpTrigger(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit>;
declare function createExpressResponse(): any;
export { createExpressResponse };
//# sourceMappingURL=functions.d.ts.map