"use client";

import { useState, useEffect, ReactNode, cloneElement, isValidElement } from "react";
import { ChevronLeft, ChevronRight, Smartphone } from "lucide-react";
import CompactDeviceSelector from "./CompactDeviceSelector";

interface ResponsiveLayoutProps {
  queueSection: ReactNode;
  activeCasesSection: ReactNode;
  devicesSection: ReactNode;
  selectedDevice?: any;
  className?: string;
  onPairDevice?: () => void;
}

type ScreenSize = 'mobile' | 'tablet' | 'desktop';

export default function ResponsiveLayout({ 
  queueSection, 
  activeCasesSection, 
  devicesSection,
  selectedDevice,
  className = "",
  onPairDevice
}: ResponsiveLayoutProps) {
  const [screenSize, setScreenSize] = useState<ScreenSize>('desktop');
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // monitor screen size changes
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      if (width <= 640) {
        setScreenSize('mobile');
        setDevicesOpen(false); // close devices panel on mobile
      } else if (width <= 1024) {
        setScreenSize('tablet');
        setDevicesOpen(false); // default to closed on tablet
      } else {
        setScreenSize('desktop');
        setDevicesOpen(false); // default to closed on desktop
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // close devices panel
  const closeDevicesPanel = () => {
    setDevicesOpen(false);
    setIsDrawerOpen(false);
  };

  // handle keyboard navigation and focus trap
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDevicesPanel();
      }
      if (event.key === 'Tab' && (devicesOpen || isDrawerOpen)) {
        const focusableElements = document.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    if (devicesOpen || isDrawerOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // lock background scrolling
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [devicesOpen, isDrawerOpen]);

  // render currently selected device info
  const renderSelectedDeviceInfo = () => {
    return (
      <CompactDeviceSelector 
        selectedDevice={selectedDevice}
        showStatus={true}
        className="flex-1"
      />
    );
  };

  // desktop layout
  if (screenSize === 'desktop') {
    return (
      <div className={`h-full grid grid-cols-3 gap-6 min-h-0 ${className}`}>
        {queueSection}
        {activeCasesSection}
        {devicesSection}
      </div>
    );
  }

  // tablet layout
  if (screenSize === 'tablet') {
    return (
      <div className={`h-full relative ${className}`}>
        {/* currenty selected device status bar */}
        <div className="mb-4 p-3 bg-white rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
          {renderSelectedDeviceInfo()}
          <button
            onClick={() => setDevicesOpen(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-[#ffd600] text-black rounded-md text-sm font-medium hover:bg-[#003366] hover:text-white transition-colors"
            aria-label="Open devices panel"
          >
            <Smartphone className="w-4 h-4" />
            <span>Devices</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* main content */}
        <div className="h-full grid grid-cols-2 gap-6 min-h-0" style={{ height: 'calc(100% - 5rem)' }}>
          {queueSection}
          {activeCasesSection}
        </div>

        {/* equipment overlay */}
        {devicesOpen && (
          <>
            <div 
              className="fixed inset-0 glass-overlay z-40"
              onClick={closeDevicesPanel}
              aria-hidden="true"
            />

            {/* equipment panel */}
            <div 
              className="fixed right-0 top-0 h-full w-96 glass-panel shadow-2xl z-50 transform transition-transform duration-300 ease-in-out focus-within:outline-none border-l border-gray-200/30 rounded-none"
              role="dialog"
              aria-modal="true"
              aria-label="Device management panel"
            >
              <div className="h-full flex flex-col">
                {/* panel header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200/50">

                  {onPairDevice && (
                    <button
                      onClick={() => {
                        onPairDevice();
                        closeDevicesPanel();
                      }}
                      className="bg-[#ffd600] text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-[#003366] hover:text-white transition-colors shadow-sm"
                    >
                      Pair New Device
                    </button>
                  )}

                  {/* right: close button */}
                  <button
                    onClick={closeDevicesPanel}
                    className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ml-auto"
                    aria-label="Close devices panel"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Close</span>
                  </button>
                </div>

                {/* panel content */}
                <div className="flex-1 overflow-hidden">
                  {isValidElement(devicesSection) 
                    ? cloneElement(devicesSection as any, { 
                        showPairButton: false,
                        showHeader: false
                      })
                    : devicesSection
                  }
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // mobile layout
  return (
    <div className={`h-full flex flex-col space-y-4 ${className}`}>
      {/* current selected device status bar */}
      <div className="flex-shrink-0 p-2 bg-white rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
        {renderSelectedDeviceInfo()}
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="flex items-center space-x-1 px-2 py-1.5 bg-[#ffd600] text-black rounded text-xs font-medium hover:bg-[#003366] hover:text-white transition-colors min-h-[36px]"
          aria-label="Open devices drawer"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Devices</span>
        </button>
      </div>

      {/* main content area */}
      <div className="flex-1 space-y-4 min-h-0 overflow-hidden">
        <div className="h-1/2 min-h-0">
          {queueSection}
        </div>
        <div className="h-1/2 min-h-0">
          {activeCasesSection}
        </div>
      </div>

      {/* bottom drawer */}
      {isDrawerOpen && (
        <>
          <div 
            className="fixed inset-0 glass-overlay z-40"
            onClick={() => setIsDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* drawer content */}
          <div
            className="fixed inset-0 glass-panel shadow-2xl z-50 transform transition-transform duration-300 ease-out focus-within:outline-none rounded-none"
            role="dialog"
            aria-modal="true"
            aria-label="Device management drawer"
          >
                        <div className="h-full flex flex-col">
              {/* 抽屉头部 - 重新设计，简化布局 */}
              <div className="flex-shrink-0 p-4 border-b border-gray-200/50">
                <div className="flex items-center justify-between">
                  {/* 左侧：Pair Device 按钮 */}
                  {onPairDevice && (
                    <button
                      onClick={() => {
                        onPairDevice();
                        setIsDrawerOpen(false);
                      }}
                      className="bg-[#ffd600] text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-[#003366] hover:text-white transition-colors shadow-sm"
                    >
                      Pair New Device
                    </button>
                  )}

                  {/* right: close button */}
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 ml-auto"
                    aria-label="Close devices drawer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Close</span>
                  </button>
                </div>
              </div>

              {/* drawer content */}
              <div className="flex-1 overflow-hidden">
                {isValidElement(devicesSection) 
                  ? cloneElement(devicesSection as any, { 
                      showPairButton: false,
                      showHeader: false
                    })
                  : devicesSection
                }
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
