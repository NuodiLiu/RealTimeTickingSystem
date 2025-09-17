import "cookie-session";

declare module "cookie-session" {
  interface CookieSessionObject {
    user?: {
      identityKey: string;               // `${iss}|${sub}`
      tid?: string | null;               // tenantId
      oid?: string | null;
      upn?: string | null;
      name?: string | null;

      staffId?: string;
      role?: "STAFF" | "ADMIN";
      employeeNo?: string;
    };
    oauth_state?: string;
    oauth_nonce?: string;
  }
}

export {};
