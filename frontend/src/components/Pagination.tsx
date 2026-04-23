/**
 * @fileoverview Pagination - Reusable pagination control component.
 * 
 * Provides navigation buttons (First, Previous, Next, Last), page number
 * selection, and a results summary (e.g., "Showing 1 to 10 of 50 results").
 * Also includes a dropdown to adjust the number of items displayed per page.
 */
import React from 'react';
import type { PaginationProps } from '../types';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Renders pagination controls for data tables and lists.
 *
 * @component
 * @param {Object}   props               - Component props.
 * @param {number}   props.currentPage   - Zero-based index of the current page.
 * @param {number}   props.totalPages    - Total number of available pages.
 * @param {number}   props.totalElements - Total number of items across all pages.
 * @param {number}   props.size          - Number of items displayed per page.
 * @param {Function} props.onPageChange  - Callback function (page, [newSize]) invoked on page or size change.
 * @param {boolean}  props.darkMode      - Whether the UI is in dark mode.
 * @returns {JSX.Element} The rendered pagination bar.
 */
const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, totalElements, size, onPageChange, darkMode }) => {
  const startItem = currentPage * size + 1;
  const endItem = Math.min((currentPage + 1) * size, totalElements);

  /**
   * Generates an array of page numbers to display around the current page.
   * Limits the visible page buttons to a maximum of 5.
   * @returns {number[]} Array of zero-based page indices.
   */
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    let start = Math.max(0, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages - 1, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(0, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  };

  return (
    <div className={`flex items-center justify-between px-6 py-3 border-t mt-auto ${
      darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
    }`}>
      {/* Results info */}
      <div className="flex-1 flex justify-start">
        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
          Showing <span className="font-medium">{startItem}</span> to{' '}
          <span className="font-medium">{endItem}</span> of{' '}
          <span className="font-medium">{totalElements}</span> results
        </p>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center gap-2">
        {/* First page */}
        <button
          onClick={() => onPageChange(0)}
          disabled={currentPage === 0}
          className={`p-2 rounded-lg transition ${
            currentPage === 0
              ? darkMode
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-400 cursor-not-allowed'
              : darkMode
                ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <ChevronsLeft className="w-5 h-5" />
        </button>

        {/* Previous page */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
          className={`p-2 rounded-lg transition ${
            currentPage === 0
              ? darkMode
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-400 cursor-not-allowed'
              : darkMode
                ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Page numbers */}
        {getPageNumbers().map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => onPageChange(pageNum)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              pageNum === currentPage
                ? 'bg-indigo-600 text-white'
                : darkMode
                  ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {pageNum + 1}
          </button>
        ))}

        {/* Next page */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          className={`p-2 rounded-lg transition ${
            currentPage >= totalPages - 1
              ? darkMode
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-400 cursor-not-allowed'
              : darkMode
                ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Last page */}
        <button
          onClick={() => onPageChange(totalPages - 1)}
          disabled={currentPage >= totalPages - 1}
          className={`p-2 rounded-lg transition ${
            currentPage >= totalPages - 1
              ? darkMode
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-400 cursor-not-allowed'
              : darkMode
                ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <ChevronsRight className="w-5 h-5" />
        </button>
      </div>

      {/* Page size selector */}
      <div className="flex-1 flex justify-end items-center gap-2">
        <label className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
          Per page:
        </label>
        <select
          value={size}
          onChange={(e) => onPageChange(0, parseInt(e.target.value))}
          className={`px-3 py-1 rounded-lg border text-sm ${
            darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300 text-gray-900'
          }`}
        >
          <option value="6">6</option>
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>
    </div>
  );
};

export default Pagination;