"use client";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ExcelFilterParams } from "../../lib/api";
import { toast } from "react-hot-toast";
import Tooltip from "../Tooltip";

interface ExcelFilterSectionProps {
  filters: ExcelFilterParams;
  startDate: Date | null;
  endDate: Date | null;
  onFilterChange: (filters: Partial<ExcelFilterParams>) => void;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
  onQuickDateChange?: (start: Date | null, end: Date | null) => void;
}

export default function ExcelFilterSection({
  filters,
  startDate,
  endDate,
  onFilterChange,
  onStartDateChange,
  onEndDateChange,
  onQuickDateChange
}: ExcelFilterSectionProps) {
  
  const handleStartDateChange = (date: Date | null) => {
    onStartDateChange(date);
    
    if (date && endDate && date > endDate) {
      onEndDateChange(null);
      onFilterChange({ 
        startDate: date.toISOString().split('T')[0],
        endDate: ''
      });
    } else {
      onFilterChange({ 
        startDate: date ? date.toISOString().split('T')[0] : ''
      });
    }
  };

  const handleEndDateChange = (date: Date | null) => {
    // Validate that end date is not before start date
    if (date && startDate && date < startDate) {
      toast.error('End date cannot be before start date');
      return;
    }
    
    onEndDateChange(date);
    onFilterChange({ 
      endDate: date ? date.toISOString().split('T')[0] : ''
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-4">
          Export Filters
        </h3>

        {/* Feedback Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-700 mb-3">
            Feedback Status
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'both', label: 'All Cases' },
              { value: 'yes', label: 'With Feedback' },
              { value: 'no', label: 'Without Feedback' }
            ].map(option => (
              <label
                key={option.value}
                className="flex items-center p-3 border border-zinc-200 bg-white rounded-md hover:bg-zinc-50 cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name="hasFeedback"
                  value={option.value}
                  checked={filters.hasFeedback === option.value}
                  onChange={(e) => onFilterChange({ hasFeedback: e.target.value as 'yes' | 'no' | 'both' })}
                  className="border-zinc-300 text-[#ffd600] focus:ring-[#ffd600] focus:ring-2"
                />
                <span className="ml-3 text-sm text-zinc-700 font-medium">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Resolved Only Filter */}
        <div className="mb-6">
          <label className="flex items-center p-3 border border-zinc-200 bg-white rounded-md hover:bg-zinc-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={filters.resolvedOnly || false}
              onChange={(e) => onFilterChange({ resolvedOnly: e.target.checked })}
              className="rounded border-zinc-300 text-[#ffd600] focus:ring-[#ffd600] focus:ring-2"
            />
            <span className="ml-3 text-sm font-medium text-zinc-700">
              Resolved cases only
            </span>
            <Tooltip content="Export only RESOLVED cases (excludes queued, in-progress, pending feedback)">
              <svg className="ml-2 w-4 h-4 text-zinc-400 hover:text-zinc-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </Tooltip>
          </label>
        </div>

        {/* Date Range with DatePicker */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-700 mb-3">
            Date Range
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-2">
                Start Date
              </label>
              <DatePicker
                selected={startDate}
                onChange={handleStartDateChange}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                maxDate={endDate || new Date()}
                placeholderText="Select start date"
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:ring-[#ffd600] focus:border-[#ffd600] transition-colors"
                dateFormat="yyyy-MM-dd"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-2">
                End Date
              </label>
              <DatePicker
                selected={endDate}
                onChange={handleEndDateChange}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate || undefined}
                maxDate={new Date()}
                placeholderText="Select end date"
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:ring-[#ffd600] focus:border-[#ffd600] transition-colors"
                dateFormat="yyyy-MM-dd"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
              />
            </div>
          </div>
        </div>

        {/* Quick Date Filters */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-700 mb-3">
            Quick Filters
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Last 7 days', days: 7 },
              { label: 'Last 30 days', days: 30 },
              { label: 'Last 90 days', days: 90 },
              { label: 'This year', days: null, isYear: true }
            ].map(option => (
              <button
                key={option.label}
                onClick={() => {
                  const end = new Date();
                  let start: Date;

                  if (option.isYear) {
                    start = new Date(end.getFullYear(), 0, 1);
                  } else {
                    start = new Date(end);
                    start.setDate(end.getDate() - option.days!);
                  }

                  const filterUpdate = {
                    startDate: start.toISOString().split('T')[0],
                    endDate: end.toISOString().split('T')[0]
                  };

                  onFilterChange(filterUpdate);
                  if (onQuickDateChange) {
                    onQuickDateChange(start, end);
                  } else {
                    onStartDateChange(start);
                    onEndDateChange(end);
                  }
                }}
                className="px-3 py-1.5 text-sm font-medium rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-[#ffd600] hover:border-[#ffd600] hover:text-black transition-colors"
              >
                {option.label}
              </button>
            ))}
            <button
              onClick={() => {
                onFilterChange({ startDate: '', endDate: '' });
                if (onQuickDateChange) {
                  onQuickDateChange(null, null);
                } else {
                  onStartDateChange(null);
                  onEndDateChange(null);
                }
              }}
              className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            >
              Clear dates
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
