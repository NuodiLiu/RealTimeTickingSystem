'use client';

import React, { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export default function TestSignalRPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[${timestamp}] ${message}`);
  };

  useEffect(() => {
    testFlow();
  }, []);

  const testFlow = async () => {
    try {
      addLog('Starting SignalR connection test...');
      
      // Step 1: Check existing session
      addLog('Step 1: Checking existing session...');
      let authResponse = await fetch(`${API_BASE}/auth/me`, {
        credentials: 'include',
      });
      
      if (authResponse.ok) {
        const data = await authResponse.json();
        if (data.user) {
          addLog('✅ Existing session found');
          setUser(data.user);
        } else {
          addLog('❌ No existing session');
          
          // Step 2: Try dev login
          addLog('Step 2: Attempting dev login...');
          const devLoginResponse = await fetch(`${API_BASE}/auth/dev-login`, {
            method: 'POST',
            credentials: 'include',
          });
          
          if (devLoginResponse.ok) {
            const devData = await devLoginResponse.json();
            addLog('✅ Dev login successful');
            setUser(devData.user);
          } else {
            addLog('❌ Dev login failed');
            return;
          }
        }
      } else {
        addLog('❌ Auth check failed');
        return;
      }

      // Step 3: Get SignalR connection info
      addLog('Step 3: Getting SignalR connection info...');
      const signalrResponse = await fetch(`${API_BASE}/api/signalr/dashboard/connect`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (signalrResponse.ok) {
        const signalrData = await signalrResponse.json();
        addLog('✅ SignalR connection info received');
        addLog(`URL: ${signalrData.url}`);
        setConnectionInfo(signalrData);
        
        // Step 4: Test the URL
        addLog('Step 4: Testing Azure Web PubSub URL...');
        
        // Try to test the negotiate endpoint
        try {
          const urlObj = new URL(signalrData.url);
          const baseTestUrl = `https://${urlObj.host}/client/negotiate?hub=ticketingHub`;
          
          addLog(`Testing negotiate endpoint: ${baseTestUrl}`);
          
          const testResponse = await fetch(baseTestUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          addLog(`Test response status: ${testResponse.status}`);
          const testResult = await testResponse.text();
          addLog(`Test response: ${testResult.substring(0, 200)}...`);
          
        } catch (error) {
          addLog(`❌ URL test error: ${error}`);
        }
      } else {
        const errorText = await signalrResponse.text();
        addLog(`❌ SignalR connection info failed: ${errorText}`);
        return;
      }

    } catch (error) {
      addLog(`❌ Test flow error: ${error}`);
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">SignalR Connection Test</h1>
      
      {user && (
        <div className="mb-4 p-3 bg-green-100 rounded">
          <h3 className="font-semibold">User Info:</h3>
          <pre className="text-sm">{JSON.stringify(user, null, 2)}</pre>
        </div>
      )}

      {connectionInfo && (
        <div className="mb-4 p-3 bg-blue-100 rounded">
          <h3 className="font-semibold">Connection Info:</h3>
          <pre className="text-sm">{JSON.stringify(connectionInfo, null, 2)}</pre>
        </div>
      )}

      <div className="mb-4">
        <button 
          onClick={testFlow}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Run Test Again
        </button>
      </div>

      <div className="bg-gray-100 p-4 rounded">
        <h3 className="font-semibold mb-2">Test Logs:</h3>
        <div className="max-h-96 overflow-y-auto">
          {logs.map((log, index) => (
            <div key={index} className="text-sm font-mono mb-1">
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
