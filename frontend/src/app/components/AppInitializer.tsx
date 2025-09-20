"use client";

export default function AppInitializer({ children }: { children: React.ReactNode }) {
  // This component previously set up MSAL access token provider
  // Now we use App JWT from localStorage and HttpOnly cookie refresh
  // So no initialization is needed
  return <>{children}</>;
}
