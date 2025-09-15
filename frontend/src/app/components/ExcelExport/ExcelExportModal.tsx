"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ExcelAPI, ExcelFilterParams, ExcelPreviewResponse } from "../../lib/api";
import { toast } from "react-hot-toast";
import { handleError } from "../../lib/toaster";
import ExcelFilterSection from "./ExcelFilterSection";
import ExcelPreviewSection from "./ExcelPreviewSection";

interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: string;
}

export default function ExcelExportModal({ isOpen, onClose, userRole }: ExcelExportModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<ExcelPreviewResponse | null>(null);
  const [filters, setFilters] = useState<ExcelFilterParams>({
    startDate: '',
    endDate: '',
    hasFeedback: 'both',
    resolvedOnly: true
  });
  
  // Date state for react-datepicker
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // 滚动容器的引用，用于保持滚动位置
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  // Load preview when modal opens or filters change
  const loadPreview = useCallback(async (filtersToUse: ExcelFilterParams) => {
    if (!isOpen) return;
    
    // 保存当前滚动位置
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }
    
    // If no date range is selected, show empty state without loading
    if (!filtersToUse.startDate || !filtersToUse.endDate) {
      setPreview({
        totalCases: 0,
        estimatedFileSize: '0 KB',
        dateRange: {
          earliest: null,
          latest: null
        },
        statusBreakdown: {},
        categoryBreakdown: {},
        staffBreakdown: {},
        filters: filtersToUse
      });
      setIsLoadingPreview(false);
      return;
    }
    
    setIsLoadingPreview(true);
    try {
      const previewData = await ExcelAPI.getPreview(filtersToUse);
      setPreview(previewData);
      
      // 恢复滚动位置
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollPositionRef.current;
        }
      }, 0);
    } catch (error) {
      console.error('Failed to load preview:', error);
      handleError(error);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [isOpen]); // 只依赖 isOpen，避免循环依赖

  // Handle filter change and reload preview
  const handleFilterChange = useCallback((newFilters: Partial<ExcelFilterParams>) => {
    setFilters(currentFilters => {
      const updatedFilters = { ...currentFilters, ...newFilters };
      
      // Only show loading if we have both dates
      if (updatedFilters.startDate && updatedFilters.endDate) {
        setIsLoadingPreview(true);
      }
      
      loadPreview(updatedFilters);
      return updatedFilters;
    });
  }, [loadPreview]);

  // 专门用于快速日期按钮的日期更新，不触发额外的API调用
  const handleQuickDateChange = useCallback((start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);
  }, []);

  // Handle export to Excel
  const handleExportToExcel = async () => {
    if (userRole !== 'ADMIN') {
      toast.error('You do not have permission to export this data.');
      return;
    }

    if (!preview || preview.totalCases === 0) {
      toast.error('No data available to export.');
      return;
    }

    setIsExporting(true);
    const exportToast = toast.loading(
      `Exporting ${preview.totalCases} cases to Excel... This may take a moment.`
    );

    try {
      // Show progress message for larger datasets
      if (preview.totalCases > 1000) {
        toast.loading(
          `Processing ${preview.totalCases} records. Please wait...`,
          { id: exportToast }
        );
      }

      const blob = await ExcelAPI.exportAsExcel(filters);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with timestamp
      const now = new Date();
      const timestamp = now.toISOString().split('T')[0]; // YYYY-MM-DD
      link.download = `cases_detailed_export_${timestamp}.xlsx`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(
        `Successfully exported ${preview.totalCases} cases to Excel!`,
        { id: exportToast }
      );
      
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      toast.error(
        'Failed to export data. Please try again or contact support.',
        { id: exportToast }
      );
      handleError(error);
    } finally {
      setIsExporting(false);
    }
  };

  // Initialize preview when modal opens
  useEffect(() => {
    if (isOpen) {
      // Set default date range to last 30 days when modal opens
      const end = new Date();
      const start = new Date(end);
      start.setDate(end.getDate() - 30);
      
      const defaultFilters = {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        hasFeedback: 'both' as const,
        resolvedOnly: true
      };
      
      // Set all states together to avoid glitches
      setStartDate(start);
      setEndDate(end);
      setFilters(defaultFilters);
      setIsLoadingPreview(true);
      scrollPositionRef.current = 0; // 重置滚动位置
      loadPreview(defaultFilters);
    } else {
      // Reset when modal closes
      setStartDate(null);
      setEndDate(null);
      setFilters({
        startDate: '',
        endDate: '',
        hasFeedback: 'both',
        resolvedOnly: true
      });
      setPreview(null);
      setIsLoadingPreview(false);
      scrollPositionRef.current = 0;
    }
  }, [isOpen]); // 只依赖 isOpen

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4">
      <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-lg shadow-2xl border-2 border-white/40 ring-1 ring-black/10">
        {/* Header */}
        <div className="px-6 py-4 flex-shrink-0 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Export Cases to Excel</h2>
            </div>
            <button
              onClick={onClose}
              disabled={isExporting}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-md hover:bg-white/10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 p-6 overflow-y-auto min-h-0"
        >
          {/* Filters Section */}
          <ExcelFilterSection
            filters={filters}
            startDate={startDate}
            endDate={endDate}
            onFilterChange={handleFilterChange}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onQuickDateChange={handleQuickDateChange}
          />

          {/* Preview Section */}
          <ExcelPreviewSection
            preview={preview}
            isLoadingPreview={isLoadingPreview}
            startDate={startDate}
            endDate={endDate}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white/30 border-t border-white/10 flex-shrink-0 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              {preview && preview.totalCases > 0 ? (
                <>
                  Ready to export {preview.totalCases} cases
                  {preview.totalCases > 500 && (
                    <span className="text-amber-600 ml-2">
                      ⚠️ Large dataset - export may take a few minutes
                    </span>
                  )}
                </>
              ) : (
                'Select filters to see exportable data'
              )}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                disabled={isExporting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white/50 border border-white/30 rounded-md hover:bg-white/70 disabled:opacity-50 transition-colors backdrop-blur-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleExportToExcel}
                disabled={isExporting || !preview || preview.totalCases === 0 || userRole !== 'ADMIN'}
                className="px-4 py-2 text-sm font-medium bg-[#ffd600] text-black border border-transparent rounded-md hover:bg-[#003366] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors shadow-sm"
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Export to Excel</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
