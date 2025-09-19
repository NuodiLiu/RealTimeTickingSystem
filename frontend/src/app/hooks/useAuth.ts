"use client";

import { useEffect, useState } from "react";
import { AuthAPI, User } from "../lib/api";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";



export default function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // First check if we have a stored token and user
        const accessToken = localStorage.getItem('access_token');
        const storedUser = localStorage.getItem('user');
        
        if (accessToken && storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            // Validate token by calling /auth/me
            const meResponse = await fetch(`${API_BASE}/auth/me`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            });

            if (meResponse.ok) {
              const data = await meResponse.json();
              if (data.user && mounted) {
                setUser({
                  id: data.user.staffId || userData.staffId,
                  email: data.user.email || userData.email,
                  username: data.user.name || userData.name,
                  role: data.user.role || userData.role,
                });
                setBooting(false);
                return;
              }
            } else {
              // Token is invalid, clear stored data
              localStorage.removeItem('access_token');
              localStorage.removeItem('token_type');
              localStorage.removeItem('user');
            }
          } catch (parseError) {
            console.warn('Failed to parse stored user data:', parseError);
            localStorage.removeItem('user');
          }
        }

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
      setUser(null);
      window.location.href = '/login';
    }
  }

  return { user, booting, login, logout };
}