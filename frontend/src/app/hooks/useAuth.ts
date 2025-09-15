"use client";

import { useEffect, useState } from "react";
import { AuthAPI, ApiError, User } from "../lib/api";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";



export default function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // First try to refresh/check existing session
        const meResponse = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include',
        });

        if (meResponse.ok) {
          const data = await meResponse.json();
          if (data.user && mounted) {
            // Ensure user has the role property
            setUser({
              id: data.user.staffId,
              email: data.user.upn,
              username: data.user.name,
              role: data.user.role,  // Ensure role is included
            });
            setBooting(false);
            return;
          }
        }

        // If no session, user is not logged in
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
      // Ensure the response includes role
      if (res.staff.role != "STAFF" && res.staff.role != "ADMIN") {
        throw new Error("Must be admin or staff");
      }
      setUser({
        id: res.staff.id,
        email: res.staff.email,
        username: res.staff.name,
        role: res.staff.role, // Ensure role is set
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
      // Immediately redirect to login page to prevent any lingering API calls
      window.location.href = '/login';
    }
  }

  return { user, booting, login, logout };
}