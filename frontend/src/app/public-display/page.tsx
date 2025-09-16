"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { io, Socket } from 'socket.io-client';
import { CaseItem, CasesAPI } from "../lib/api";

export default function PublicDisplayPage() {
  const [cases, setCases] = useState<CaseItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [queueCount, setQueueCount] = useState(0); // Separate state for header count
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update current time every minute for wait time calculations
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Smart update with debouncing: only refresh list if case list actually changed
  const smartUpdateQueue = useCallback(async (eventType: string, payload?: any) => {
    // Clear any pending update
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Debounce updates to prevent rapid fire
    updateTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await CasesAPI.list('QUEUED');
        const newCount = response?.length || 0;
        
        // Always update the header count immediately
        setQueueCount(newCount);
        
        // Only update the full list if the actual cases changed
        setCases(prevCases => {
          const currentCount = prevCases?.length || 0;
          
          if (newCount !== currentCount || 
              eventType === 'case:created' || 
              !prevCases || 
              prevCases.length === 0) {
            console.log(`📋 Updating full queue list (${currentCount} → ${newCount})`);
            return response;
          } else {
            console.log(`📊 Only updating count (${newCount}), list unchanged`);
            return prevCases; // Keep existing cases
          }
        });
      } catch (error) {
        console.error('Failed to smart update queue:', error);
      }
    }, 500); // 500ms debounce
  }, []); // Remove cases dependency

  // Simplified update function for backward compatibility
  const updateQueueCount = useCallback(async () => {
    await smartUpdateQueue('case:updated');
  }, [smartUpdateQueue]);

  // Socket.io for real-time updates
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Define fetchQueueData inside useEffect to avoid dependency issues
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const response = await CasesAPI.list('QUEUED');
        console.log('📋 Public Display: Initial queue data fetched:', response);
        setCases(response);
        setQueueCount(response?.length || 0);
      } catch (error) {
        console.error('Failed to fetch initial queue data:', error);
      } finally {
        setLoading(false);
      }
    };

    // Initial load
    fetchInitialData();

    // Set up Socket.io connection for real-time updates
    const socket: Socket = io(process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000', {
      path: '/ws',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('🔌 Public Display: Socket connected for real-time updates');
    });

    socket.on('event', (event: { type: string; payload: any }) => {
      console.log('📡 Public Display: Real-time event received:', event);
      
      switch (event.type) {
        case 'case:created':
          console.log('📋 New case created, full refresh needed');
          smartUpdateQueue('case:created', event.payload);
          break;
          
        case 'case:updated':
          console.log('📋 Case updated, smart update');
          smartUpdateQueue('case:updated', event.payload);
          break;
          
        case 'case:feedback_ready':
          console.log('📋 Case feedback ready, smart update');
          smartUpdateQueue('case:feedback_ready', event.payload);
          break;
          
        default:
          // Ignore other events for public display
          break;
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 Public Display: Socket disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error('🔌 Public Display: Socket connection error:', err);
    });

    return () => {
      console.log('🧹 Public Display: Cleaning up socket connection...');
      socket.disconnect();
      
      // Clear any pending updates
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []); // Remove dependencies to prevent infinite loop

  const getWaitingTime = (createdAt: string) => {
    const now = currentTime.getTime();
    const created = new Date(createdAt).getTime();
    const diff = now - created;
    
    if (diff < 0) return "Just joined";
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return "Just joined";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-unsw-yellow mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">Loading queue...</p>
        </div>
      </div>
    );
  }

  // Sort queued cases by creation time (API already filters for QUEUED status)
  const queuedCases = cases?.sort((a: CaseItem, b: CaseItem) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Yellow Banner Header */}
      <header className="bg-[#ffd600] px-8 py-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image 
              src="/img/unswcollege.png" 
              alt="UNSW College Logo" 
              width={80}
              height={80}
              className="rounded-lg object-cover"
            />
            <div>
              <h1 className="text-3xl font-bold text-[#003366]">Help Desk Queue</h1>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-lg text-[#003366] font-medium">Students in Queue</div>
            <div className="text-5xl font-bold text-[#003366]">{queueCount}</div>
          </div>
        </div>
      </header>

      {/* Queue Content */}
      <main className="px-8 py-6">
        <div className="max-w-7xl mx-auto">
          {queueCount === 0 ? (
            <div className="text-center py-24">
              <h2 className="text-4xl font-bold text-[#003366] mb-4">Queue is empty</h2>
              <p className="text-xl text-gray-600">No students currently waiting</p>
            </div>
          ) : (
            /* Two-column layout for landscape, single column for portrait */
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-4 max-h-[calc(100vh-240px)] overflow-y-auto pr-2">
              {queuedCases.map((caseItem: CaseItem, index: number) => (
                <div 
                  key={caseItem.id} 
                  className="bg-white rounded-lg shadow-md border-l-4 border-[#ffd600] p-4 hover:shadow-lg transition-all duration-200"
                >
                  {/* Compact Position and Info Layout */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Position Badge - Smaller */}
                      <div className="w-10 h-10 rounded-full bg-[#ffd600] flex items-center justify-center shadow-sm">
                        <span className="text-lg font-bold text-[#003366]">
                          {index + 1}
                        </span>
                      </div>
                      
                      {/* Student Info - Compact */}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-[#003366] truncate leading-tight">
                          {caseItem.studentName || `Student ${index + 1}`}
                        </h3>
                      </div>
                    </div>

                    {/* Waiting Time - Compact */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-gray-500 mb-1">Waiting</div>
                      <div className="text-xl font-bold text-[#003366]">
                        {getWaitingTime(caseItem.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
