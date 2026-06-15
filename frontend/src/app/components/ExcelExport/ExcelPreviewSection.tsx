"use client";

import React from "react";
import { ExcelPreviewResponse } from "../../lib/api";

interface ExcelPreviewSectionProps {
  preview: ExcelPreviewResponse | null;
  isLoadingPreview: boolean;
  startDate: Date | null;
  endDate: Date | null;
}

const SectionHeading = () => (
  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-4">
    Export Preview
  </h3>
);

const ExcelPreviewSection = React.memo(function ExcelPreviewSection({
  preview,
  isLoadingPreview,
  startDate,
  endDate
}: ExcelPreviewSectionProps) {

  if (isLoadingPreview) {
    return (
      <div className="mt-6 pt-6 border-t border-zinc-200">
        <SectionHeading />
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#ffd600] border-t-transparent"></div>
            <span className="text-sm text-zinc-600">Loading preview...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="mt-6 pt-6 border-t border-zinc-200">
        <SectionHeading />
        <div className="text-center py-8 text-zinc-500">
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
    <div className="mt-6 pt-6 border-t border-zinc-200">
      <SectionHeading />

      <div className="space-y-4">
        <DataStatsCards totalCases={preview.totalCases} estimatedFileSize={preview.estimatedFileSize} />

        <DateRangeDisplay startDate={startDate} endDate={endDate} />

        {preview.totalCases > 0 && <ExportInfoCard />}

        {preview.totalCases === 0 && <NoDataMessage />}
      </div>
    </div>
  );
});

const DataStatsCards = React.memo(function DataStatsCards({
  totalCases,
  estimatedFileSize
}: {
  totalCases: number;
  estimatedFileSize: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-md border border-zinc-200 bg-white p-4">
        <div className="text-xs uppercase tracking-wide text-zinc-500 font-semibold mb-1">Total Cases</div>
        <div className="text-2xl font-bold text-zinc-900">{totalCases}</div>
      </div>
      <div className="rounded-md border border-zinc-200 bg-white p-4">
        <div className="text-xs uppercase tracking-wide text-zinc-500 font-semibold mb-1">Estimated File Size</div>
        <div className="text-2xl font-bold text-zinc-900">{estimatedFileSize}</div>
      </div>
    </div>
  );
});

const DateRangeDisplay = React.memo(function DateRangeDisplay({
  startDate,
  endDate
}: {
  startDate: Date | null;
  endDate: Date | null;
}) {
  if (startDate && endDate) {
    return (
      <div className="p-4 rounded-md border border-zinc-200 bg-white">
        <h4 className="font-medium text-zinc-900 mb-1">Selected Date Range</h4>
        <div className="text-sm text-zinc-600">
          From {startDate.toLocaleDateString()}
          {' '}to {endDate.toLocaleDateString()}
          {' '}({Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} days)
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-md border border-amber-200 bg-amber-50">
      <h4 className="font-medium text-amber-900 mb-1">No Date Range Selected</h4>
      <div className="text-sm text-amber-800">
        Please select a start and end date to see available data for export.
      </div>
    </div>
  );
});

const ExportInfoCard = React.memo(function ExportInfoCard() {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-sm font-medium text-zinc-900 mb-2">
        Your export will include comprehensive data analysis across multiple worksheets:
      </p>
      <ul className="space-y-1 text-xs text-zinc-700">
        <li>• All Cases — Complete case details with calculated metrics</li>
        <li>• Summary Analysis — Overview statistics and trends</li>
        <li>• Category Analysis — Breakdown by case categories</li>
        <li>• Staff Performance — Individual staff metrics</li>
        <li>• Time Analysis — Response and resolution times</li>
        <li>• Feedback Quality — Customer satisfaction data</li>
        <li>• Date Trends — Time-based analysis</li>
      </ul>
    </div>
  );
});

const NoDataMessage = React.memo(function NoDataMessage() {
  return (
    <div className="text-center py-8 text-zinc-500">
      <div className="w-12 h-12 mx-auto mb-3 text-zinc-300">
        <svg fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm8 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V8z" clipRule="evenodd" />
        </svg>
      </div>
      <p>No cases match the selected filters.</p>
    </div>
  );
});

export default ExcelPreviewSection;
