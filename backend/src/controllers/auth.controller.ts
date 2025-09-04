import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthService } from "../services/auth.service";
import { 
  AuthError, 
  MissingFieldError, 
  UserAlreadyExistsError 
} from "../error";

export class AuthController {
  static async createInvite(req: Request, res: Response) {
    if (!req.user) {
      throw new AuthError("Unauthorized", 401);
    }

    const userId = req.user.id;
    const { token, invite } = await AuthService.createInvite(userId);

    return res.json({
      inviteUrl: `${process.env.FRONTEND_URL}/register?token=${token}`,
      expiresAt: invite.expiresAt,
    });
  }

  static async register(req: Request, res: Response) {
    const { token, employeeNo, name } = req.body;

    // check param
    if (!token || !employeeNo || !name) {
      throw new MissingFieldError(
        ["token", "employeeNo", "name"].filter(f => !req.body[f])
      );
    }

    // check invitation token exists
    const invite = await AuthService.useInvite(token);
    if (!invite) {
      throw new AuthError("Invite expired or invalid", 400);
    }

    // check if user already exists
    const existing = await prisma.staff.findUnique({
      where: { employeeNo },
    });
    if (existing) {
      throw new UserAlreadyExistsError();
    }

    // create a new user
    const staff = await prisma.staff.create({
      data: {
        employeeNo,
        name,
        email: `${employeeNo}@example.com`, // not for MVP
        password: "", // not for MVP
      },
    });

    // generate session and write cookie
    const session = await AuthService.createSession(staff.id, req, res);

    return res.json({ staff, session });
  }

  static async login(req: Request, res: Response) {
    const { employeeNo } = req.body;

    // check param
    if (!employeeNo) {
      throw new MissingFieldError(["employeeNo"]);
    }

    // check user exists or not
    const staff = await prisma.staff.findUnique({
      where: { employeeNo },
    });
    if (!staff) {
      throw new AuthError("Invalid credentials", 401);
    }

    // call service to create session + access token
    const session = await AuthService.createSession(staff.id, req, res);

    return res.json({ staff, session });
  }
  
  static async refresh(req: Request, res: Response) {
    const refreshToken = req.cookies["refresh_token"];
    if (!refreshToken) {
      throw new AuthError("Missing refresh token", 401);
    }
    
    const session = await AuthService.refreshSession(refreshToken);
    if (!session) {
      throw new AuthError("Invalid or expired refresh token", 401);
    }
    
    return res.json({ accessToken: session.accessToken });
  }

  static async logout(req: Request, res: Response) {
    const refreshToken = req.cookies?.["refresh_token"];
    const logoutAll = String(req.query.all || "").toLowerCase() === "true";

    if (!refreshToken && !logoutAll) {
      // normal logout needs refresh_token
      throw new AuthError("Missing refresh token", 401);
    }

    // if revoke all sessions, needs to get UserId
    if (logoutAll) {
      if (!req.user) throw new AuthError("Unauthorized", 401);
      await AuthService.revokeAllSessionsForUser(req.user.id);
    } else {
      await AuthService.revokeSessionByRefresh(refreshToken!);
    }

    // remove refresh_token (refresh cookie)
    res.clearCookie("refresh_token", { httpOnly: true, sameSite: "lax" });

    return res.json({ ok: true });
  }
}
