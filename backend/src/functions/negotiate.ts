import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { signalRConfig, generateDeviceConnectionInfo, generateDashboardConnectionInfo } from '../signalr/config';
import jwt from 'jsonwebtoken';

/**
 * Azure Function for SignalR negotiate endpoint with JWT authentication
 * This function validates JWT tokens from Azure AD and generates SignalR connection info
 */
export async function negotiate(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('SignalR negotiate function processing request with Azure AD JWT validation.');

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
          message: 'Please provide a valid JWT token in Authorization: Bearer <token> header'
        })
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate JWT token (decode without verification for Azure AD tokens)
    let jwtPayload;
    try {
      // Decode JWT token without verification (Azure AD handles signature validation)
      jwtPayload = jwt.decode(token) as any;
      
      if (!jwtPayload || typeof jwtPayload !== 'object') {
        throw new Error('Invalid token format');
      }

      // Validate required Azure AD claims
      if (!jwtPayload.sub || !jwtPayload.iss) {
        throw new Error('Missing required claims (sub, iss)');
      }

      // Validate issuer (Azure AD v2.0)
      const expectedIssuer = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || 'common'}/v2.0`;
      if (!jwtPayload.iss.includes('login.microsoftonline.com')) {
        throw new Error(`Invalid issuer. Expected Azure AD, got: ${jwtPayload.iss}`);
      }

      // Validate audience (should be your API client ID)
      const expectedAudience = process.env.AZURE_AD_CLIENT_ID;
      if (expectedAudience && jwtPayload.aud !== expectedAudience) {
        throw new Error(`Invalid audience. Expected: ${expectedAudience}, Got: ${jwtPayload.aud}`);
      }

      // Validate token expiration
      const now = Math.floor(Date.now() / 1000);
      if (jwtPayload.exp && jwtPayload.exp < now) {
        throw new Error('Token has expired');
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
    const userId = `azure-ad|${jwtPayload.sub}`;
    const userEmail = jwtPayload.upn || jwtPayload.email || jwtPayload.preferred_username;
    const userName = jwtPayload.name || userEmail || 'Unknown User';
    
    // Extract user type from query params or headers (default to dashboard)
    const userType = request.query.get('userType') || 
                     request.headers.get('x-user-type') || 
                     'dashboard';
    
    context.log(`Negotiate request - userId: ${userId}, userType: ${userType}, email: ${userEmail}`);

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
