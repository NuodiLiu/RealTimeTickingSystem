"use client";

import { useState, useCallback, useEffect } from "react";
import QRCode from "qrcode";
import { PairAPI } from "../lib/api";

interface QRGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: string;
}

export default function QRGeneratorModal({ 
  isOpen, 
  onClose, 
  defaultMode = "REGISTRATION" 
}: QRGeneratorModalProps) {
  const [pairGenerating, setPairGenerating] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairQrDataUrl, setPairQrDataUrl] = useState<string | null>(null);

  const handleGenerateQR = useCallback(async (mode: string = defaultMode) => {
    try {
      setPairError(null);
      setPairGenerating(true);

      // Fetch QR URL 
      const res = await PairAPI.generateQR({ mode });

      // Generate the QR code using the URL
      const dataUrl = await QRCode.toDataURL(res.qrUrl);
      setPairQrDataUrl(dataUrl);
    } catch (e: any) {
      setPairError(e?.message ?? "Failed to generate QR.");
    } finally {
      setPairGenerating(false);
    }
  }, [defaultMode]);

  const handleClose = useCallback(() => {
    setPairQrDataUrl(null);
    setPairError(null);
    setPairGenerating(false);
    onClose();
  }, [onClose]);

  // Auto-generate QR when modal opens
  useEffect(() => {
    if (isOpen && !pairQrDataUrl && !pairGenerating) {
      handleGenerateQR(defaultMode);
    }
  }, [isOpen, pairQrDataUrl, pairGenerating, handleGenerateQR, defaultMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-2xl p-6">
        <button
          className="absolute top-4 right-4 rounded-md border px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-200 transition-colors"
          onClick={handleClose}
        >
          Close
        </button>

        <div className="space-y-4">
          <p className="text-sm text-zinc-600 text-center">
            Scan this code on the iPad to pair
          </p>

          {pairError && (
            <p className="text-sm text-[#D03E16] text-center">{pairError}</p>
          )}

          {pairQrDataUrl ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <img
                  src={pairQrDataUrl}
                  alt="Pairing QR"
                  className="max-h-64 rounded-lg border p-2 bg-white"
                />
              </div>
              
              {/* Refresh button below QR */}
              <button
                disabled={pairGenerating}
                onClick={() => handleGenerateQR("REGISTRATION")}
                className="p-2 rounded-full hover:bg-zinc-100 disabled:opacity-50 transition-colors"
                title="Generate new QR code"
              >
                {pairGenerating ? (
                  <svg className="w-5 h-5 animate-spin text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <div className="w-64 h-64 border-2 border-dashed border-zinc-300 rounded-lg flex items-center justify-center">
                <button
                  disabled={pairGenerating}
                  onClick={() => handleGenerateQR("REGISTRATION")}
                  className="p-4 rounded-full hover:bg-zinc-100 disabled:opacity-50 transition-colors"
                  title="Generate QR code"
                >
                  {pairGenerating ? (
                    <svg className="w-8 h-8 animate-spin text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-500 text-center">
                Click the refresh icon to generate a pairing code
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
