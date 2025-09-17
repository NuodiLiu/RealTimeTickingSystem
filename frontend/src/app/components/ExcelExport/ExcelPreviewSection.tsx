"use client";

import React from "react";
import { ExcelPreviewResponse } from "../../lib/api";

interface ExcelPreviewSectionProps {
  preview: ExcelPreviewResponse | null;
  isLoadingPreview: boolean;
  startDate: Date | null;
  endDate: Date | null;
}

// 使用 React.memo 优化，只有当 props 真正变化时才重新渲染
const ExcelPreviewSection = React.memo(function ExcelPreviewSection({
  preview,
  isLoadingPreview,
  startDate,
  endDate
}: ExcelPreviewSectionProps) {
  
  if (isLoadingPreview) {
    return (
      <div className="border-t border-white/10 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Preview</h3>
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#ffd600]"></div>
            <span className="text-sm text-gray-600">Loading preview...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="border-t border-white/10 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Preview</h3>
        <div className="text-center py-8 text-gray-500">
          <div className="w-12 h-12 mx-auto mb-3 text-red-300">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <p>Failed to load preview. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 pt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Preview</h3>
      
      <div className="space-y-4">
        {/* 数据统计卡片 - 使用单独的组件来优化更新 */}
        <DataStatsCards totalCases={preview.totalCases} estimatedFileSize={preview.estimatedFileSize} />

        {/* Date Range Display */}
        <DateRangeDisplay startDate={startDate} endDate={endDate} />

        {/* Additional Export Info
        {preview.totalCases > 0 && <ExportInfoCard />} */}

        {/* No data message */}
        {preview.totalCases === 0 && <NoDataMessage />}
      </div>
    </div>
  );
});

// 单独的数据统计卡片组件，使用 memo 优化
const DataStatsCards = React.memo(function DataStatsCards({ 
  totalCases, 
  estimatedFileSize 
}: { 
  totalCases: number; 
  estimatedFileSize: string; 
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100/50 backdrop-blur-sm">
        <div className="text-sm text-blue-600 font-medium mb-1">Total Cases</div>
        <div className="text-2xl font-bold text-blue-900">{totalCases}</div>
      </div>
      <div className="bg-green-50/50 rounded-lg p-4 border border-green-100/50 backdrop-blur-sm">
        <div className="text-sm text-green-600 font-medium mb-1">Estimated File Size</div>
        <div className="text-2xl font-bold text-green-900">{estimatedFileSize}</div>
      </div>
    </div>
  );
});

// 日期范围显示组件，使用 memo 优化
const DateRangeDisplay = React.memo(function DateRangeDisplay({
  startDate,
  endDate
}: {
  startDate: Date | null;
  endDate: Date | null;
}) {
  if (startDate && endDate) {
    return (
      <div className="p-4 bg-white/30 rounded-lg border border-white/20 backdrop-blur-sm">
        <h4 className="font-medium text-gray-900 mb-2">Selected Date Range</h4>
        <div className="text-sm text-gray-600">
          From {startDate.toLocaleDateString()} 
          {' '}to {endDate.toLocaleDateString()}
          {' '}({Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} days)
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-yellow-50/50 rounded-lg border border-yellow-100/50 backdrop-blur-sm">
      <h4 className="font-medium text-yellow-800 mb-2">📅 No Date Range Selected</h4>
      <div className="text-sm text-yellow-700">
        Please select a start and end date to see available data for export.
      </div>
    </div>
  );
});

// 无数据消息组件，这个是静态的
const NoDataMessage = React.memo(function NoDataMessage() {
  return (
    <div className="text-center py-8 text-gray-500">
      <div className="w-12 h-12 mx-auto mb-3 text-gray-300">
        <svg fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm8 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V8z" clipRule="evenodd" />
        </svg>
      </div>
      <p>No cases match the selected filters.</p>
    </div>
  );
});

export default ExcelPreviewSection;
