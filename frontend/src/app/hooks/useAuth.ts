"use client";

import { useEffect, useState } from "react";
import { AuthAPI, User } from "../lib/api";

export default function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Check if we have an App JWT
        const appJwt = localStorage.getItem('appJwt');
        
        if (appJwt) {
          try {
            // Validate App JWT by calling /auth/me through our API layer
            const response = await AuthAPI.me();
            
            if (response.user && mounted) {
              setUser({
                id: response.user.id,
                email: response.user.email,
                username: response.user.name,
                role: response.user.role as 'ADMIN' | 'STAFF',
              });
              setBooting(false);
              return;
            }
          } catch (error) {
            console.warn('App JWT validation failed:', error);
            // Clear invalid App JWT
            localStorage.removeItem('appJwt');
          }
        }

        // Clean up any old token storage patterns
        localStorage.removeItem('access_token');
        localStorage.removeItem('token_type');
        localStorage.removeItem('user');

        if (mounted) {
          setUser(null);
          setBooting(false);
        }
      } catch (e) {
        if (mounted) {
          setUser(null);
          setBooting(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function login(employeeNo: string) {
    try {
      const res = await AuthAPI.login({ employeeNo });
      if (res.staff.role != "STAFF" && res.staff.role != "ADMIN") {
        throw new Error("Must be admin or staff");
      }
      setUser({
        id: res.staff.id,
        email: res.staff.email,
        username: res.staff.name,
        role: res.staff.role,
      });
    } catch (error) {
      throw error;
    }
  }

  async function logout() {
    try {
      await AuthAPI.logout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      // Clear App JWT and user state
      localStorage.removeItem('appJwt');
      setUser(null);
      window.location.href = '/login';
    }
  }

  return { user, booting, login, logout };
}