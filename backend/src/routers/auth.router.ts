import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { verifyAzureJWT, requireScopes } from '../middlewares/azure-auth.middleware';
import { msalClient, authParams, urls } from '../auth/azure';
import { signStaffToken } from '../lib/utils/auth';
import { prisma } from '../lib/prisma';
import { normalizeEmail } from '../lib/email-utils';
import { refreshStore, REFRESH_COOKIE_OPTIONS, REFRESH_COOKIE_NAME } from '../lib/refresh-store';
import { staffService, createStandardIdentityKey } from '../services/staff.service';
import { handleAuthError, validateAzureAdClaims, AUTH_ERROR_CODES, sendAuthError } from '../lib/auth-errors';
import { SignalRGateway } from '../signalr';
import { signDeviceToken } from '../lib/utils/auth';
import type { DeviceMode } from '../lib/utils/type';

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
    
    // Validate required Azure AD claims using standardized validation
    try {
      validateAzureAdClaims(claims);
    } catch (error) {
      console.error('Invalid Azure AD claims:', { 
        iss: !!claims.iss, 
        sub: !!claims.sub, 
        tid: !!claims.tid, 
        oid: !!claims.oid 
      });
      return res.redirect(`${urls.frontendUrl}/login?error=invalid_token`);
    }

    // Use unified staff service for consistent user management
    const staff = await staffService.getOrCreateStaff({
      iss: claims.iss,
      sub: claims.sub,
      tid: claims.tid,
      oid: claims.oid,
      upn: claims.upn,
      preferred_username: claims.preferred_username,
      email: claims.email,
      name: claims.name,
    });

    // Sign App JWT (short-lived)
    const appJwt = signStaffToken({
      id: staff.id,
      role: staff.role,
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
    
    // Use standardized error handling for specific error types
    if (error.message?.includes('claims')) {
      return res.redirect(`${urls.frontendUrl}/login?error=invalid_claims`);
    }
    if (error.message?.includes('tenant')) {
      return res.redirect(`${urls.frontendUrl}/login?error=tenant_not_authorized`);
    }
    
    return res.redirect(`${urls.frontendUrl}/login?error=auth_failed`);
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
      return sendAuthError(
        res, 
        AUTH_ERROR_CODES.INVALID_REQUEST, 
        'Missing or invalid Authorization header', 
        401
      );
    }

    const token = authHeader.substring(7);
    
    // Verify App JWT
    let jwtPayload;
    try {
      jwtPayload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    } catch (jwtError) {
      return sendAuthError(
        res, 
        AUTH_ERROR_CODES.INVALID_TOKEN, 
        'Invalid or expired JWT token', 
        401
      );
    }

    // Validate token type
    if (jwtPayload.typ !== 'staff') {
      return sendAuthError(
        res, 
        AUTH_ERROR_CODES.INVALID_TOKEN, 
        'Token is not a staff token', 
        401
      );
    }

    // Get staff record using unified service
    const staff = await staffService.findStaffById(jwtPayload.sub);

    if (!staff) {
      return sendAuthError(
        res, 
        AUTH_ERROR_CODES.STAFF_NOT_FOUND, 
        'Staff record not found', 
        404
      );
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
    return handleAuthError(error, res);
  }
});

/**
 * Refresh App JWT using refresh handle from HttpOnly cookie
 * No Authorization header required - uses cookie-based refresh handle
 */
router.post('/refresh', async (req, res) => {
  try {
    // Parse cookies manually in serverless environment
    const cookies = req.cookies || parseCookies(req.headers.cookie);
    const refreshHandle = cookies[REFRESH_COOKIE_NAME];
    
    if (!refreshHandle) {
      return sendAuthError(
        res, 
        AUTH_ERROR_CODES.INVALID_REQUEST, 
        'No refresh handle found', 
        401
      );
    }

    // Retrieve refresh data from store
    const refreshData = await refreshStore.get(refreshHandle);
    
    if (!refreshData) {
      return sendAuthError(
        res, 
        AUTH_ERROR_CODES.INVALID_TOKEN, 
        'Refresh handle invalid or expired', 
        401
      );
    }

    // Get staff record using unified service
    const staff = await staffService.findStaffById(refreshData.staffId);

    if (!staff) {
      await refreshStore.delete(refreshHandle);
      return sendAuthError(
        res, 
        AUTH_ERROR_CODES.STAFF_NOT_FOUND, 
        'Staff record not found', 
        404
      );
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
      role: staff.role,
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
      expiresIn: 2 * 60 * 60, // 2 hours in seconds
    });
  } catch (error: any) {
    console.error('Token refresh error:', error);
    return handleAuthError(error, res);
  }
});

// Helper function to parse cookies in serverless environment
function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    const value = rest.join('=').trim();
    if (name && value) {
      cookies[name.trim()] = decodeURIComponent(value);
    }
  });
  
  return cookies;
}

// Logout endpoint - clear refresh handle
router.post('/logout', async (req, res) => {
  try {
    // Parse cookies manually in serverless environment
    const cookies = req.cookies || parseCookies(req.headers.cookie);
    const refreshHandle = cookies[REFRESH_COOKIE_NAME];
    
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

/**
 * Test-only login bypass — issues a staff session WITHOUT Microsoft SSO.
 *
 * Two independent guards, so a single misconfiguration cannot expose it:
 *   1. NODE_ENV === 'production'  -> always 404, no matter what.
 *   2. TEST_AUTH_ENABLED !== 'true' -> 404 (off by default everywhere else).
 *
 * Enabled only on non-production test environments so the E2E suite can
 * exercise authenticated @Dashboard / @Admin scenarios without driving the
 * (un-automatable) real Microsoft login page.
 *
 * GET /auth/test-login?role=STAFF|ADMIN
 * Mirrors /auth/redirect: upserts a deterministic test staff record, signs
 * an App JWT, and redirects to the frontend /auth/callback page — which
 * stores the token and lands on the dashboard exactly like a real login.
 */
router.get('/test-login', async (req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.TEST_AUTH_ENABLED !== 'true') {
    return res.status(404).json({ error: 'not_found' });
  }

  try {
    const role = String(req.query.role || 'STAFF').toUpperCase() === 'ADMIN'
      ? 'ADMIN'
      : 'STAFF';
    const identityKey = `test:${role.toLowerCase()}`;

    const staff = await prisma.staff.upsert({
      where: { identityKey },
      update: { role },
      create: {
        identityKey,
        email: `test-${role.toLowerCase()}@e2e.local`,
        name: role === 'ADMIN' ? 'E2E Admin' : 'E2E Staff',
        employeeNo: `e2e-${role.toLowerCase()}`,
        role,
        password: '',
      },
      select: {
        id: true,
        role: true,
        employeeNo: true,
        name: true,
        email: true,
        identityKey: true,
      },
    });

    const appJwt = signStaffToken({
      id: staff.id,
      role: staff.role,
      employeeNo: staff.employeeNo,
      identityKey: staff.identityKey,
      ...(staff.name && { name: staff.name }),
      ...(staff.email && { email: staff.email }),
    });

    return res.redirect(`${urls.frontendUrl}/auth/callback?token=${encodeURIComponent(appJwt)}`);
  } catch (error: any) {
    console.error('test-login error:', error);
    return res.redirect(`${urls.frontendUrl}/login?error=auth_failed`);
  }
});

/**
 * Test-only data-seeding helpers for the E2E suite.
 *
 * Same dual guard as /auth/test-login:
 *   1. NODE_ENV === 'production'  -> 404 always
 *   2. TEST_AUTH_ENABLED !== 'true' -> 404
 *
 * Lets the frontend regression suite create queued StudentCases without going
 * through device-paired kiosk authentication. Every seeded record carries a
 * recognisable studentName prefix so the cleanup endpoint can wipe just the
 * suite's own rows without touching real data.
 */
function testEndpointsDisabled(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.TEST_AUTH_ENABLED !== 'true';
}

router.post('/test-seed-case', async (req, res) => {
  if (testEndpointsDisabled()) {
    return res.status(404).json({ error: 'not_found' });
  }
  try {
    const { studentName, category, zID } = req.body ?? {};
    if (!studentName || !category) {
      return res.status(400).json({ error: 'studentName and category are required' });
    }
    const created = await prisma.studentCase.create({
      data: { studentName, category, zID: zID || null },
    });
    // Mirror the real CasesService.postCase emit so the frontend SignalR
    // listeners on the dashboard and public-display update live — without
    // this, /auth/test-seed-case only changes DB state and the UI sits stale
    // until the next poll/refresh.
    SignalRGateway.notifyDashboard({
      type: 'case:created',
      payload: {
        id: created.id,
        studentName: created.studentName,
        category: created.category,
        zID: created.zID,
        status: created.status,
        createdAt: created.createdAt,
      },
    });
    return res.status(201).json({
      id: created.id,
      studentName: created.studentName,
      category: created.category,
      zID: created.zID,
      status: created.status,
      createdAt: created.createdAt,
    });
  } catch (error: any) {
    console.error('test-seed-case error:', error);
    return res.status(500).json({ error: 'seed_failed', detail: error.message });
  }
});

/**
 * Test-only kiosk pairing helper. Bypasses the QR/pairingSession dance to
 * give an E2E driver the same `{deviceId, apiKey, wsToken, mode}` bundle the
 * real /pair/complete returns. Use only for tests:
 *   - studentName/deviceName is forced to start with "E2E_Kiosk_" so the
 *     companion cleanup endpoint can wipe just suite-created rows.
 *   - Guarded the same way as test-seed-case.
 *   - Emits device:paired on SignalR so the staff dashboard reflects the
 *     fake device live.
 */
router.post('/test-pair-device', async (req, res) => {
  if (testEndpointsDisabled()) {
    return res.status(404).json({ error: 'not_found' });
  }
  try {
    const requestedMode = String((req.body && req.body.mode) || 'FEEDBACK').toUpperCase();
    const mode: DeviceMode = requestedMode === 'REGISTRATION' ? 'REGISTRATION' : 'FEEDBACK';
    const suffix = crypto.randomBytes(4).toString('hex');
    const deviceName = `E2E_Kiosk_${mode}_${suffix}`;

    const deviceSecret = crypto.randomBytes(32).toString('hex');
    const secretHash = crypto.createHash('sha256').update(deviceSecret).digest('hex');

    const device = await prisma.kioskDevice.create({
      data: {
        name: deviceName,
        secretHash,
        mode,
        lastSeenAt: new Date(),
        isConnected: true,
      },
    });
    const wsToken = signDeviceToken(device.id, mode);

    SignalRGateway.notifyDashboard({
      type: 'device:paired',
      payload: { deviceId: device.id, deviceName: device.name, mode: device.mode },
    });

    return res.status(201).json({
      deviceId: device.id,
      deviceSecret,
      apiKey: `${device.id}:${deviceSecret}`,
      wsToken,
      deviceName: device.name,
      mode: device.mode,
    });
  } catch (error: any) {
    console.error('test-pair-device error:', error);
    return res.status(500).json({ error: 'pair_failed', detail: error.message });
  }
});

router.delete('/test-pair-devices', async (req, res) => {
  if (testEndpointsDisabled()) {
    return res.status(404).json({ error: 'not_found' });
  }
  try {
    const prefix = String(req.query.prefix || 'E2E_Kiosk_');
    const matchingDevices = await prisma.kioskDevice.findMany({
      where: { name: { startsWith: prefix } },
      select: { id: true },
    });
    const deviceIds = matchingDevices.map(d => d.id);
    if (deviceIds.length > 0) {
      // KioskDevice has a one-to-one currentLock relation; null it before
      // deleting the lock rows so the orphan check passes.
      await prisma.kioskDevice.updateMany({
        where: { id: { in: deviceIds } },
        data: { currentLockId: null },
      });
      // Submitted Feedback rows aren't directly tied to the device, but the
      // lock + session both are; clear those before device deletion.
      await prisma.feedbackSession.deleteMany({
        where: { deviceId: { in: deviceIds } },
      });
      await prisma.kioskLock.deleteMany({
        where: { deviceId: { in: deviceIds } },
      });
    }
    const deleted = await prisma.kioskDevice.deleteMany({
      where: { name: { startsWith: prefix } },
    });
    return res.json({ deleted: deleted.count, prefix });
  } catch (error: any) {
    console.error('test-pair-devices delete error:', error);
    return res.status(500).json({ error: 'cleanup_failed', detail: error.message });
  }
});

router.delete('/test-seed-cases', async (req, res) => {
  if (testEndpointsDisabled()) {
    return res.status(404).json({ error: 'not_found' });
  }
  try {
    const prefix = String(req.query.prefix || 'E2E_');
    const matchingCases = await prisma.studentCase.findMany({
      where: { studentName: { startsWith: prefix } },
      select: { id: true },
    });
    const caseIds = matchingCases.map(c => c.id);
    if (caseIds.length > 0) {
      // Locks, feedback sessions, and submitted Feedback rows all reference
      // the case via FK; clear them before deleting the cases themselves.
      await prisma.kioskDevice.updateMany({
        where: { currentLockId: { in: (await prisma.kioskLock.findMany({
          where: { caseId: { in: caseIds } }, select: { id: true } })).map(l => l.id) } },
        data: { currentLockId: null },
      });
      await prisma.feedback.deleteMany({
        where: { caseId: { in: caseIds } },
      });
      await prisma.feedbackSession.deleteMany({
        where: { caseId: { in: caseIds } },
      });
      await prisma.kioskLock.deleteMany({
        where: { caseId: { in: caseIds } },
      });
    }
    const deleted = await prisma.studentCase.deleteMany({
      where: { studentName: { startsWith: prefix } },
    });
    return res.json({ deleted: deleted.count, prefix });
  } catch (error: any) {
    console.error('test-seed-cases delete error:', error);
    return res.status(500).json({ error: 'cleanup_failed', detail: error.message });
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
