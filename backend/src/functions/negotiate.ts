import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { signalRConfig, generateDeviceConnectionInfo, generateDashboardConnectionInfo } from '../signalr/config';
import jwt from 'jsonwebtoken';

/**
 * Azure Function for SignalR negotiate endpoint with App JWT authentication
 * This function validates App JWT tokens (signed by our backend) and generates SignalR connection info
 */
export async function negotiate(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('SignalR negotiate function processing request with App JWT validation.');

  try {
    // Extract Bearer token from Authorization header - check both case variations
    const authHeader = request.headers.get('Authorization') || 
                      request.headers.get('authorization') ||
                      request.headers.get('AUTHORIZATION');
    
    context.log(`Auth header: ${authHeader ? 'present' : 'undefined'}`);
    context.log(`Extracted token: ${authHeader ? 'present' : 'null'}`);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      context.log('ERROR: Missing or invalid Authorization header');
      return {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Missing or invalid Authorization header',
          message: 'Please provide a valid App JWT token in Authorization: Bearer <token> header'
        })
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate JWT token (verify App JWT signature)
    let jwtPayload;
    try {
      // Verify App JWT token with our JWT_SECRET
      jwtPayload = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      if (!jwtPayload || typeof jwtPayload !== 'object') {
        throw new Error('Invalid token format');
      }

      // Validate required App JWT claims
      if (!jwtPayload.sub || !jwtPayload.typ) {
        throw new Error('Missing required claims (sub, typ)');
      }

      // Validate token type (should be 'staff' or 'device')
      if (!['staff', 'device'].includes(jwtPayload.typ)) {
        throw new Error(`Invalid token type. Expected 'staff' or 'device', got: ${jwtPayload.typ}`);
      }

      context.log(`App JWT validated for user: ${jwtPayload.sub}, type: ${jwtPayload.typ}`);

    } catch (error) {
      context.log('ERROR: JWT validation failed:', error);
      return {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Invalid App JWT token',
          message: error instanceof Error ? error.message : 'Token validation failed'
        })
      };
    }

    // Create user identity for SignalR using App JWT claims
    const userId = jwtPayload.sub; // Use the staff/device ID directly
    const userEmail = jwtPayload.email || jwtPayload.employeeNo || 'Unknown';
    const userName = jwtPayload.name || jwtPayload.employeeNo || 'Unknown User';
    const tokenType = jwtPayload.typ; // 'staff' or 'device'
    
    // Extract user type from query params, headers, or token type (default to dashboard for staff)
    const userType = request.query.get('userType') || 
                     request.headers.get('x-user-type') || 
                     (tokenType === 'device' ? 'device' : 'dashboard');
    
    context.log(`Negotiate request - userId: ${userId}, userType: ${userType}, tokenType: ${tokenType}`);

    // Generate SignalR connection info based on user type
    let connectionInfo;
    let response;
    
    try {
      if (userType === 'device') {
        context.log('Generating device connection info...');
        // For device connections, validate device permissions
        connectionInfo = generateDeviceConnectionInfo(userId);
      } else {
        context.log('Generating dashboard connection info...');
        connectionInfo = generateDashboardConnectionInfo(userId);
      }
      
      // Add user metadata as additional response fields
      response = {
        ...connectionInfo,
        user: {
          id: userId,
          email: userEmail,
          name: userName,
          type: userType
        }
      };
      
      context.log('SignalR connection info generated successfully for user:', userId);
    } catch (configError) {
      context.log('ERROR in connection info generation:', configError);
      throw configError;
    }

    context.log(`Generated SignalR connection for ${userType}: ${userId}`);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    context.log('Error in negotiate function:', error);
    context.log('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Failed to generate SignalR connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

// Register the negotiate function
app.http('negotiate', {
  methods: ['POST', 'GET'],
  authLevel: 'anonymous',
  route: 'negotiate',  // Changed from 'signalr/negotiate' to 'negotiate' to match frontend requests
  handler: negotiate
});
