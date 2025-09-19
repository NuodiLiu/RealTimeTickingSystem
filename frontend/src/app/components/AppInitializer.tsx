"use client";

import { useEffect } from 'react';
import { useMSAL } from '../lib/msalProvider';
import { setAccessTokenProvider } from '../lib/api';

export default function AppInitializer({ children }: { children: React.ReactNode }) {
  const { getAccessToken } = useMSAL();

  useEffect(() => {
    // Set the access token provider for API calls
    setAccessTokenProvider(getAccessToken);
  }, [getAccessToken]);

  return <>{children}</>;
}
