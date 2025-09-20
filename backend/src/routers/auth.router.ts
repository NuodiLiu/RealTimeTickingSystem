import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { verifyAzureJWT, requireScopes } from '../middlewares/azure-auth.middleware';
import { msalClient, authParams, urls } from '../auth/azure';
import { signStaffToken } from '../lib/utils/auth';
import { prisma } from '../lib/prisma';
import { normalizeEmail } from '../lib/email-utils';
import { refreshStore, REFRESH_COOKIE_OPTIONS, REFRESH_COOKIE_NAME } from '../lib/refresh-store';

// Secure Azure AD SSO auth router
// Endpoints:
// - GET /auth/login         -> initiate Azure AD login
// - GET /auth/redirect      -> handle Azure AD callback and issue App JWT
// - POST /auth/refresh      -> refresh App JWT using Azure AD token
// - GET /auth/me            -> returns current user from validated Azure AD token
// - POST /auth/dev-login    -> 410 Gone (retired)
// - POST /auth/dev-login-staff -> 410 Gone (retired)

const router = Router();

/**
 * Initiate Azure AD OAuth login
 * Redirects user to Microsoft login page
 */
router.get('/login', async (req, res) => {
  try {
    console.log('Azure AD login initiated');
    console.log('MSAL Config:', {
      clientId: process.env.AZURE_AD_CLIENT_ID?.substring(0, 8) + '...',
      tenantId: process.env.AZURE_AD_TENANT_ID,
      redirectUri: authParams.redirectUri,
      scopes: authParams.scopes
    });

    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');

    console.log('Generating auth URL...');
    // Generate authorization URL using MSAL
    const url = await msalClient.getAuthCodeUrl({
      scopes: authParams.scopes,
      redirectUri: authParams.redirectUri,
      state,
      nonce,
      responseMode: 'query',
    });

    console.log('Auth URL generated successfully, redirecting...');
    res.redirect(url);
  } catch (error: any) {
    console.error('Login initiation error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code || error.errorCode
    });
    res.status(500).json({
      error: 'login_failed',
      error_description: 'Failed to initiate Azure AD login',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Handle Azure AD OAuth callback
 * Exchange authorization code for tokens and issue App JWT
 */
router.get('/redirect', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const error = req.query.error;

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error, req.query.error_description);
      return res.redirect(`${urls.frontendUrl}/login?error=oauth_error`);
    }

    if (!code) {
      return res.redirect(`${urls.frontendUrl}/login?error=missing_code`);
    }

    // Exchange authorization code for tokens using MSAL
    const tokenResponse = await msalClient.acquireTokenByCode({
      code,
      scopes: authParams.scopes,
      redirectUri: authParams.redirectUri,
    });

    const claims: any = tokenResponse?.idTokenClaims || {};
    
    // Create identity key for staff lookup/creation
    const identityKey = `${claims.iss}|${claims.sub}`;
    const email = normalizeEmail(claims.preferred_username || claims.upn || claims.email);
    const name = claims.name;
    const tid = claims.tid;
    const oid = claims.oid;

    // Look up or create staff record
    let staff = await prisma.staff.findUnique({
      where: { identityKey },
      select: {
        id: true,
        role: true,
        employeeNo: true,
        name: true,
        email: true,
        identityKey: true,
      }
    });

    if (!staff) {
      // Create new staff member on first login
      const createData: any = {
        identityKey,
        employeeNo: `aad-${tid}-${oid.slice(0, 8)}`,
        role: 'STAFF',
      };
      
      if (email) createData.email = email;
      if (name) createData.name = name;

      staff = await prisma.staff.create({
        data: createData,
        select: {
          id: true,
          role: true,
          employeeNo: true,
          name: true,
          email: true,
          identityKey: true,
        }
      });
    } else {
      // Update name and email if changed
      const updates: any = {};
      if (email && email !== staff.email) updates.email = email;
      if (name && name !== staff.name) updates.name = name;

      if (Object.keys(updates).length > 0) {
        staff = await prisma.staff.update({
          where: { identityKey },
          data: updates,
          select: {
            id: true,
            role: true,
            employeeNo: true,
            name: true,
            email: true,
            identityKey: true,
          }
        });
      }
    }

    // Sign App JWT (short-lived)
    const appJwt = signStaffToken({
      id: staff.id,
      role: staff.role as 'ADMIN' | 'STAFF',
      employeeNo: staff.employeeNo,
      identityKey: staff.identityKey,
      ...(staff.name && { name: staff.name }),
      ...(staff.email && { email: staff.email }),
    });

    // Store refresh token securely with handle  
    // Note: In MSAL Node, refresh tokens are handled internally
    // We store the account info to enable silent token refresh
    const refreshHandle = refreshStore.generateHandle();
    await refreshStore.set(refreshHandle, {
      msalAccount: tokenResponse.account,
      providerRefresh: '', // MSAL handles refresh internally
      staffId: staff.id,
      tokenVersion: 1,
      exp: Math.floor(Date.now() / 1000) + (14 * 24 * 60 * 60), // 14 days
      identityKey: staff.identityKey,
    });

    // Set HttpOnly cookie with refresh handle
    res.cookie(REFRESH_COOKIE_NAME, refreshHandle, REFRESH_COOKIE_OPTIONS);

    // Redirect to frontend with App JWT
    const redirectUrl = `${urls.frontendUrl}/auth/callback?token=${encodeURIComponent(appJwt)}`;
    
    res.redirect(redirectUrl);
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.redirect(`${urls.frontendUrl}/login?error=auth_failed`);
  }
});

/**
 * Get current user information from App JWT
 * Requires valid App JWT (not Azure AD token)
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'unauthorized',
        error_description: 'Missing or invalid Authorization header'
      });
    }

    const token = authHeader.substring(7);
    
    // Verify App JWT
    let jwtPayload;
    try {
      jwtPayload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    } catch (jwtError) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid or expired JWT token'
      });
    }

    // Validate token type
    if (jwtPayload.typ !== 'staff') {
      return res.status(401).json({
        error: 'invalid_token_type',
        error_description: 'Token is not a staff token'
      });
    }

    // Get staff record
    const staff = await prisma.staff.findUnique({
      where: { id: jwtPayload.sub },
      select: {
        id: true,
        role: true,
        employeeNo: true,
        name: true,
        email: true,
        identityKey: true,
      }
    });

    if (!staff) {
      return res.status(404).json({
        error: 'staff_not_found',
        error_description: 'Staff record not found'
      });
    }

    // Return user info in format expected by frontend
    res.json({
      ok: true,
      user: {
        id: staff.id,           // Frontend expects 'id', not 'staffId'
        role: staff.role,
        employeeNo: staff.employeeNo,
        name: staff.name,
        email: staff.email,
        identityKey: staff.identityKey,
      }
    });
  } catch (error: any) {
    console.error('Error in /auth/me:', error);
    return res.status(500).json({
      error: 'internal_error',
      error_description: 'Failed to retrieve user information'
    });
  }
});

/**
 * Refresh App JWT using refresh handle from HttpOnly cookie
 * No Authorization header required - uses cookie-based refresh handle
 */
router.post('/refresh', async (req, res) => {
  try {
    // Get refresh handle from HttpOnly cookie
    const refreshHandle = req.cookies[REFRESH_COOKIE_NAME];
    
    if (!refreshHandle) {
      return res.status(401).json({
        error: 'no_refresh_token',
        error_description: 'No refresh handle found'
      });
    }

    // Retrieve refresh data from store
    const refreshData = await refreshStore.get(refreshHandle);
    
    if (!refreshData) {
      return res.status(401).json({
        error: 'invalid_refresh_token',
        error_description: 'Refresh handle invalid or expired'
      });
    }

    // Get staff record
    const staff = await prisma.staff.findUnique({
      where: { id: refreshData.staffId },
      select: {
        id: true,
        role: true,
        employeeNo: true,
        name: true,
        email: true,
        identityKey: true,
      }
    });

    if (!staff) {
      await refreshStore.delete(refreshHandle);
      return res.status(404).json({
        error: 'staff_not_found',
        error_description: 'Staff record not found'
      });
    }

    // Try to refresh Microsoft token using MSAL silent flow
    try {
      if (refreshData.msalAccount) {
        const silentRequest = {
          account: refreshData.msalAccount,
          scopes: authParams.scopes,
        };
        
        // Attempt silent token refresh
        await msalClient.acquireTokenSilent(silentRequest);
      }
    } catch (msalError) {
      console.warn('MSAL silent refresh failed:', msalError);
      // Continue anyway - we can still issue new App JWT based on stored data
    }

    // Generate new App JWT
    const newAppJwt = signStaffToken({
      id: staff.id,
      role: staff.role as 'ADMIN' | 'STAFF',
      employeeNo: staff.employeeNo,
      identityKey: staff.identityKey,
      ...(staff.name && { name: staff.name }),
      ...(staff.email && { email: staff.email }),
    });

    // Rotate refresh handle for security
    const newHandle = await refreshStore.rotateHandle(refreshHandle, {
      ...refreshData,
      tokenVersion: refreshData.tokenVersion + 1,
      exp: Math.floor(Date.now() / 1000) + (14 * 24 * 60 * 60), // Extend expiry
    });

    // Set new refresh handle cookie
    res.cookie(REFRESH_COOKIE_NAME, newHandle, REFRESH_COOKIE_OPTIONS);

    // Return new App JWT
    res.json({
      accessToken: newAppJwt,
      tokenType: 'Bearer',
      expiresIn: 15 * 60, // 15 minutes in seconds
    });
  } catch (error: any) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'refresh_failed',
      error_description: 'Failed to refresh token'
    });
  }
});

// Logout endpoint - clear refresh handle
router.post('/logout', async (req, res) => {
  try {
    const refreshHandle = req.cookies[REFRESH_COOKIE_NAME];
    
    if (refreshHandle) {
      await refreshStore.delete(refreshHandle);
    }
    
    // Clear the refresh cookie
    res.clearCookie(REFRESH_COOKIE_NAME, { 
      path: REFRESH_COOKIE_OPTIONS.path,
      secure: REFRESH_COOKIE_OPTIONS.secure,
      httpOnly: true,
      sameSite: REFRESH_COOKIE_OPTIONS.sameSite,
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'logout_failed' });
  }
});

// Retire dev-login endpoints (keep path, return 410)
router.post('/dev-login', (_req, res) => {
  return res.status(410).json({
    ok: false,
    message: 'Dev login has been retired. Please authenticate via Microsoft SSO.',
  });
});

router.post('/dev-login-staff', (_req, res) => {
  return res.status(410).json({
    ok: false,
    message: 'Dev login has been retired. Please authenticate via Microsoft SSO.',
  });
});

export default router;
