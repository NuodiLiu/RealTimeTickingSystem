import "cookie-session";

declare module "cookie-session" {
  interface CookieSessionObject {
    user?: {
      identityKey: string;               // `${iss}|${sub}`
      tid?: string | null;               // 租户ID
      oid?: string | null;
      upn?: string | null;
      name?: string | null;

      // 若在登录时同步绑定到 Staff，可顺便带上
      staffId?: string;
      role?: "STAFF" | "ADMIN";
      employeeNo?: string;
    };
    oauth_state?: string;
    oauth_nonce?: string;
  }
}

export {};
