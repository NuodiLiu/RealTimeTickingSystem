// src/types/express-session.d.ts
import "express-session";

// 你的会话里实际放了哪些字段，就在这里声明清楚
declare module "express-session" {
  interface SessionData {
    user?: {
      identityKey: string;            // `${iss}|${sub}`
      tid?: string | null;
      oid?: string | null;
      upn?: string | null;
      name?: string | null;

      // 如果你在回调里顺便把 staff 映射出来，可以加上这几个：
      staffId?: string;
      role?: "STAFF" | "ADMIN";
      employeeNo?: string;
    };

    // OIDC 登录流程用到的临时值
    oauth_state?: string;
    oauth_nonce?: string;
  }
}

export {};
