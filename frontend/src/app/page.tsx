"use client";

import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    // Redirect to dashboard immediately when the component mounts
    window.location.href = '/dashboard';
  }, []);

  // Show a loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
