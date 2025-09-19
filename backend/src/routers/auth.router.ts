import { Router } from 'express';
import { verifyAzureJWT, requireScopes } from '../middlewares/azure-auth.middleware';
import { prisma } from '../lib/prisma';
import { normalizeEmail } from '../lib/email-utils';

// Secure Azure AD SSO auth router
// Endpoints:
// - GET /auth/me            -> returns current user from validated Azure AD token
// - POST /auth/dev-login    -> 410 Gone (retired)
// - POST /auth/dev-login-staff -> 410 Gone (retired)

const router = Router();

/**
 * Get current user information from Azure AD token
 * Requires valid Azure AD JWT with our API audience
 */
router.get('/me', verifyAzureJWT, requireScopes(['Api.Read']), async (req, res) => {
  try {
    if (!req.azureAuth) {
      return res.status(401).json({
        error: 'unauthorized',
        error_description: 'Authentication required'
      });
    }

    const { identityKey, email, name, tid, oid } = req.azureAuth;

    // Normalize email to lowercase for consistent storage and lookup
    const normalizedEmail = normalizeEmail(email);

    // Look up or create staff record using stable identityKey
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
      // First-time login: create new staff record with Azure AD identity
      
      // Check if user exists with this email but different identityKey (account migration)
      let existingByEmail = null;
      if (normalizedEmail) {
        existingByEmail = await prisma.staff.findUnique({
          where: { email: normalizedEmail }
        });
      }

      if (existingByEmail) {
        // Migrate existing account to new identityKey
        staff = await prisma.staff.update({
          where: { email: normalizedEmail! }, // We know normalizedEmail is not null here
          data: {
            identityKey,
            // Only update name if we have a new value and existing is null/empty
            ...(name && !existingByEmail.name ? { name } : {}),
          },
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
        // Create new staff record - only include fields that have values
        const createData: any = {
          identityKey,
          employeeNo: `aad-${tid}-${oid.slice(0, 8)}`,
          role: 'STAFF',
        };
        
        // Only set email if we have one (normalized)
        if (normalizedEmail) {
          createData.email = normalizedEmail;
        }
        
        // Only set name if we have one
        if (name) {
          createData.name = name;
        }

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
      }
    } else {
      // Update name and email if they've changed and we have new values
      const updates: any = {};
      
      // Update email only if we have a new value and it's different
      if (normalizedEmail && normalizedEmail !== staff.email) {
        updates.email = normalizedEmail;
      }
      
      // Update name only if we have a new value and it's different
      if (name && name !== staff.name) {
        updates.name = name;
      }

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

    // Return minimal user info (don't expose internal claims)
    return res.json({
      ok: true,
      user: {
        staffId: staff.id,
        role: staff.role,
        employeeNo: staff.employeeNo,
        name: staff.name,
        email: staff.email,
        identityKey: staff.identityKey,
      },
      // Optional: return some safe token metadata
      tokenInfo: {
        tenantId: tid,
        scopes: req.azureAuth.scopes,
        roles: req.azureAuth.roles,
        expiresAt: new Date(req.azureAuth.exp * 1000).toISOString(),
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
