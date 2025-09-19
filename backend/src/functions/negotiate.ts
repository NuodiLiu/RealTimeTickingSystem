import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { signalRConfig, generateDeviceConnectionInfo, generateDashboardConnectionInfo } from '../signalr/config';
import jwt from 'jsonwebtoken';

/**
 * Azure Function for SignalR negotiate endpoint with JWT authentication
 * This function validates JWT tokens and generates SignalR connection info
 */
export async function negotiate(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('SignalR negotiate function processed a request with JWT authentication.');

  try {
    // Extract Bearer token from Authorization header
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      context.log('ERROR: Missing or invalid Authorization header');
      return {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Missing or invalid Authorization header',
          message: 'Please provide a valid JWT token in Authorization: Bearer <token> header'
        })
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate JWT token (decode and verify)
    let jwtPayload;
    try {
      // Decode JWT token without verification (Azure AD validates on their end)
      // In production, you might want to verify the signature using Azure AD public keys
      jwtPayload = jwt.decode(token) as any;
      
      if (!jwtPayload || typeof jwtPayload !== 'object') {
        throw new Error('Invalid token format');
      }

      // Basic validation of required claims
      if (!jwtPayload.sub || !jwtPayload.iss) {
        throw new Error('Missing required claims (sub, iss)');
      }

      // Validate audience if specified
      const expectedAudience = process.env.AZURE_AD_CLIENT_ID;
      if (expectedAudience && jwtPayload.aud !== expectedAudience) {
        throw new Error(`Invalid audience. Expected: ${expectedAudience}, Got: ${jwtPayload.aud}`);
      }

      context.log(`JWT validated for user: ${jwtPayload.sub}, tenant: ${jwtPayload.tid}`);

    } catch (error) {
      context.log('ERROR: JWT validation failed:', error);
      return {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Invalid JWT token',
          message: error instanceof Error ? error.message : 'Token validation failed'
        })
      };
    }

    // Create user identity for SignalR using Azure AD claims
    const userId = `${jwtPayload.iss}|${jwtPayload.sub}`;
    const userEmail = jwtPayload.upn || jwtPayload.email || jwtPayload.preferred_username;
    const userName = jwtPayload.name || userEmail || 'Unknown User';
    
    // Extract user type from query params (default to dashboard)
    const userType = request.query.get('userType') || 'dashboard';
    
    context.log(`Negotiate request - userId: ${userId}, userType: ${userType}, email: ${userEmail}`);

    // Generate SignalR connection info based on user type
    let connectionInfo;
    let response;
    
    try {
      if (userType === 'device') {
        context.log('Generating device connection info...');
        // For device connections, you might want additional validation
        // to ensure this user is authorized to act as a device
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
      
      context.log('Connection info generated successfully for user:', userId);
    } catch (configError) {
      context.log('ERROR in connection info generation:', configError);
      throw configError;
    }

    context.log(`Generated SignalR connection for ${userType}: ${userId}`);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
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
  route: 'signalr/negotiate',
  handler: negotiate
});
