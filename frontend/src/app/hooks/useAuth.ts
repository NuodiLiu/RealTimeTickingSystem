"use client";

import { useEffect, useState } from "react";
import { AuthAPI, ApiError, User } from "../lib/api";

export default function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await AuthAPI.refresh();
        // Set a mock user since we don't have a /me endpoint
        if (mounted) setUser({ 
          id: "current-user", 
          email: "staff@example.com",
          username: "Staff Member"
        });
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setBooting(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function login(employeeNo: string) {
    try {
      const res = await AuthAPI.login({ employeeNo });
      // Now access res.staff instead of res.user
      setUser({ 
        id: res.staff.id, 
        email: res.staff.email,
        username: res.staff.name
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
    }
  }

  return { user, booting, login, logout };
}