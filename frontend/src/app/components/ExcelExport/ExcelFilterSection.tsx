"use client";

import { useState } from "react";
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
    
    // If end date is before start date, clear end date
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Filters</h3>
        
        {/* Feedback Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Feedback Status
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'both', label: 'All Cases' },
              { value: 'yes', label: 'With Feedback' },
              { value: 'no', label: 'Without Feedback' }
            ].map(option => (
              <label key={option.value} className="flex items-center p-3 border border-white/20 rounded-md hover:bg-white/10 cursor-pointer transition-colors backdrop-blur-sm">
                <input
                  type="radio"
                  name="hasFeedback"
                  value={option.value}
                  checked={filters.hasFeedback === option.value}
                  onChange={(e) => onFilterChange({ hasFeedback: e.target.value as 'yes' | 'no' | 'both' })}
                  className="border-gray-300 text-[#ffd600] focus:ring-[#ffd600] focus:ring-2"
                />
                <span className="ml-3 text-sm text-gray-700 font-medium">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Resolved Only Filter */}
        <div className="mb-6">
          <label className="flex items-center p-3 border border-white/20 rounded-md hover:bg-white/10 cursor-pointer transition-colors backdrop-blur-sm">
            <input
              type="checkbox"
              checked={filters.resolvedOnly || false}
              onChange={(e) => onFilterChange({ resolvedOnly: e.target.checked })}
              className="rounded border-gray-300 text-[#ffd600] focus:ring-[#ffd600] focus:ring-2"
            />
            <span className="ml-3 text-sm font-medium text-gray-700">
              Resolved cases only
            </span>
            <Tooltip content="Export only RESOLVED cases (excludes queued, in-progress, pending feedback)">
              <svg className="ml-2 w-4 h-4 text-gray-400 hover:text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </Tooltip>
          </label>
        </div>

        {/* Date Range with DatePicker */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Date Range
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-2">
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
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-[#ffd600] focus:border-[#ffd600] transition-colors"
                dateFormat="yyyy-MM-dd"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">
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
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-[#ffd600] focus:border-[#ffd600] transition-colors"
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
          <label className="block text-sm font-medium text-gray-700 mb-3">
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
                    start = new Date(end.getFullYear(), 0, 1); // Jan 1st of current year
                  } else {
                    start = new Date(end);
                    start.setDate(end.getDate() - option.days!);
                  }
                  
                  // 一次性更新所有状态，避免多次渲染和API调用
                  const filterUpdate = {
                    startDate: start.toISOString().split('T')[0],
                    endDate: end.toISOString().split('T')[0]
                  };
                  
                  // 先更新父组件的过滤器状态，这会触发API调用
                  onFilterChange(filterUpdate);
                  // 然后使用专门的函数更新本地日期状态，不触发额外的API调用
                  if (onQuickDateChange) {
                    onQuickDateChange(start, end);
                  } else {
                    // 后备方案，如果没有提供onQuickDateChange
                    onStartDateChange(start);
                    onEndDateChange(end);
                  }
                }}
                className="px-3 py-2 text-sm border border-white/30 rounded-md hover:bg-white/20 hover:border-white/50 hover:scale-105 active:scale-95 active:bg-white/30 transition-all duration-200 font-medium backdrop-blur-sm shadow-sm hover:shadow-md"
              >
                {option.label}
              </button>
            ))}
            <button
              onClick={() => {
                // 先更新过滤器状态，这会触发API调用
                onFilterChange({ startDate: '', endDate: '' });
                // 然后使用专门的函数更新本地日期状态
                if (onQuickDateChange) {
                  onQuickDateChange(null, null);
                } else {
                  // 后备方案
                  onStartDateChange(null);
                  onEndDateChange(null);
                }
              }}
              className="px-3 py-2 text-sm border border-white/30 rounded-md hover:bg-white/20 hover:border-white/50 hover:scale-105 active:scale-95 active:bg-white/30 transition-all duration-200 text-gray-500 hover:text-gray-700 backdrop-blur-sm shadow-sm hover:shadow-md"
            >
              Clear dates
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
