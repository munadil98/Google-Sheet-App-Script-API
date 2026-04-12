/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { 
  Plus, 
  RefreshCw, 
  Trash2, 
  Edit2, 
  ExternalLink, 
  Database, 
  AlertCircle,
  Settings,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Download,
  ChevronDown,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppsScriptService } from './services/appsScript';
import { SheetRow, DropdownConfig } from './types';
import { cn } from './lib/utils';

const APPS_SCRIPT_CODE = `function doGet(e) {
  try {
    const action = e.parameter.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === 'GET_SHEETS') {
      const sheets = ss.getSheets().map(s => s.getName());
      return createResponse({ status: 'success', data: sheets });
    }

    const sheetName = e.parameter.sheet || ss.getSheets()[0].getName();
    const sheet = ss.getSheetByName(sheetName);
    
    if (sheet.getLastRow() === 0) {
      return createResponse({ status: 'success', data: [], message: 'Sheet is empty' });
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    if (action === 'GET_ALL') {
      const rows = data.slice(1).map((row, index) => {
        const obj = { __rowId__: (index + 2).toString() };
        headers.forEach((header, i) => {
          obj[header] = row[i];
        });
        return obj;
      });
      return createResponse({ status: 'success', data: rows });
    }
    
    return createResponse({ status: 'error', message: 'Invalid action: ' + action });
  } catch (error) {
    return createResponse({ status: 'error', message: error.toString() });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = payload.sheet || ss.getSheets()[0].getName();
    const sheet = ss.getSheetByName(sheetName);
    
    if (action === 'ADD_ROW') {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const newRow = headers.map(header => payload.data[header] || "");
      sheet.appendRow(newRow);
      return createResponse({ status: 'success', message: 'Row added' });
    }

    if (action === 'UPDATE_ROW') {
      const rowId = parseInt(payload.id);
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      headers.forEach((header, i) => {
        if (payload.data[header] !== undefined) {
          sheet.getRange(rowId, i + 1).setValue(payload.data[header]);
        }
      });
      return createResponse({ status: 'success', message: 'Row updated' });
    }

    if (action === 'DELETE_ROW') {
      const rowId = parseInt(payload.id);
      sheet.deleteRow(rowId);
      return createResponse({ status: 'success', message: 'Row deleted' });
    }
    
    return createResponse({ status: 'error', message: 'Invalid action: ' + action });
  } catch (error) {
    return createResponse({ status: 'error', message: error.toString() });
  }
}

function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;

export default function App() {
  const [scriptUrl, setScriptUrl] = useState<string>(localStorage.getItem('sheetflow_url') || import.meta.env.VITE_APPS_SCRIPT_URL || '');
  const [isUrlSet, setIsUrlSet] = useState<boolean>(!!(localStorage.getItem('sheetflow_url') || import.meta.env.VITE_APPS_SCRIPT_URL));
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<SheetRow | null>(null);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(!(localStorage.getItem('sheetflow_url') || import.meta.env.VITE_APPS_SCRIPT_URL));
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  
  // Helper for robust string matching
  const normalize = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  const urlConfig = new URLSearchParams(window.location.search).get('config');
  const [dropdownConfigs, setDropdownConfigs] = useState<DropdownConfig[]>(() => {
    if (urlConfig) {
      try {
        // Unicode-safe base64 decode
        const decoded = decodeURIComponent(atob(urlConfig).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(decoded);
      } catch (e) {
        console.error('Failed to parse config from URL', e);
      }
    }
    return JSON.parse(localStorage.getItem('sheetflow_dropdowns') || '[]');
  });
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, string[]>>({});
  
  const view = new URLSearchParams(window.location.search).get('view') || 'admin';
  const urlSheet = new URLSearchParams(window.location.search).get('sheet');

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const service = useMemo(() => scriptUrl ? new AppsScriptService(scriptUrl) : null, [scriptUrl]);

  // Handle sheet from URL for public form
  useEffect(() => {
    if (view === 'form' && urlSheet && sheets.includes(urlSheet)) {
      setSelectedSheet(urlSheet);
    }
  }, [view, urlSheet, sheets]);

  const fetchData = async () => {
    if (!service) return;
    setIsLoading(true);
    try {
      const data = await service.getAll(selectedSheet);
      setRows(data);
    } catch (error) {
      toast.error('Failed to fetch data. Check your Apps Script URL and permissions.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSheets = async () => {
    if (!service) return;
    try {
      const data = await service.getSheets();
      setSheets(data);
      if (data.length > 0) {
        setSelectedSheet(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch sheets:', error);
      toast.error('Could not fetch sheet names. Make sure you have updated your Apps Script code.');
    }
  };

  useEffect(() => {
    if (isUrlSet && scriptUrl) {
      fetchSheets();
    }
  }, [isUrlSet, scriptUrl]);

  useEffect(() => {
    localStorage.setItem('sheetflow_dropdowns', JSON.stringify(dropdownConfigs));
    if (service) {
      fetchDropdownOptions();
    }
  }, [dropdownConfigs, service]);

  const fetchDropdownOptions = async () => {
    if (!service) return;
    const options: Record<string, string[]> = {};
    
    for (const config of dropdownConfigs) {
      const { fieldName, sourceSheet } = config;
      if (!sourceSheet) continue;
      
      try {
        const data = await service.getAll(sourceSheet);
        if (data.length > 0) {
          // Try to find a column that matches the fieldName, or fallback to the first meaningful column
          const headers = Object.keys(data[0]);
          let key = headers.find(k => normalize(k) === normalize(fieldName));
          
          if (!key) {
            key = headers.find(k => 
              k !== '__rowId__' && 
              k.toLowerCase() !== 'timestamp' && 
              k.toLowerCase() !== 'id'
            );
          }

          if (key) {
            const optionKey = `${sourceSheet}_${fieldName}`;
            options[optionKey] = [...new Set(data.map(row => String((row as any)[key])).filter(v => v && v !== 'undefined' && v.trim() !== ''))] as string[];
          }
        }
      } catch (error) {
        console.error(`Failed to fetch options for ${fieldName} from ${sourceSheet}:`, error);
      }
    }
    setDropdownOptions(options);
  };

  // Handle horizontal scroll visibility
  const handleCopyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopied(true);
    toast.success('Apps Script code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyFormLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'form');
    url.searchParams.set('sheet', selectedSheet);
    if (dropdownConfigs.length > 0) {
      try {
        // Unicode-safe base64 encode
        const jsonStr = JSON.stringify(dropdownConfigs);
        const encoded = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
        url.searchParams.set('config', encoded);
      } catch (e) {
        console.error('Failed to encode config', e);
      }
    }
    navigator.clipboard.writeText(url.toString());
    toast.success('Public form link copied to clipboard');
  };

  const addDropdownConfig = () => {
    setDropdownConfigs([...dropdownConfigs, { fieldName: '', sourceSheet: sheets[0] || '' }]);
  };

  const removeDropdownConfig = (index: number) => {
    setDropdownConfigs(dropdownConfigs.filter((_, i) => i !== index));
  };

  const updateDropdownConfig = (index: number, updates: Partial<DropdownConfig>) => {
    const newConfigs = [...dropdownConfigs];
    newConfigs[index] = { ...newConfigs[index], ...updates };
    setDropdownConfigs(newConfigs);
  };

  const checkScroll = () => {
    if (tableContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tableContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [rows]);

  const scrollTable = (direction: 'left' | 'right') => {
    if (tableContainerRef.current) {
      const scrollAmount = 300;
      tableContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!service) return;
    const formData = new FormData(e.currentTarget);
    const data: any = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });

    setIsLoading(true);
    try {
      await service.addRow(data, selectedSheet);
      toast.success('Row added successfully');
      setIsAdding(false);
      setTimeout(fetchData, 1000);
    } catch (error) {
      toast.error('Failed to add row');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!service || !isEditing) return;
    const formData = new FormData(e.currentTarget);
    const data: any = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });

    setIsLoading(true);
    try {
      await service.updateRow(isEditing.__rowId__, data, selectedSheet);
      toast.success('Row updated successfully');
      setIsEditing(null);
      setTimeout(fetchData, 1000);
    } catch (error) {
      toast.error('Failed to update row');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!service) return;
    setIsLoading(true);
    try {
      await service.deleteRow(id, selectedSheet);
      toast.success('Row deleted successfully');
      setDeleteConfirmId(null);
      setTimeout(fetchData, 1000);
    } catch (error) {
      toast.error('Failed to delete row');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (filteredRows.length === 0) {
      toast.error('No data to export');
      return;
    }

    const csvHeaders = headers.join(',');
    const csvRows = filteredRows.map(row => 
      headers.map(header => {
        const val = row[header];
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    );
    
    const csvContent = [csvHeaders, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedSheet || 'export'}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Data exported as CSV');
  };

  const handleFilterClick = () => {
    setShowMobileSearch(!showMobileSearch);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const headers = useMemo(() => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).filter(h => h !== '__rowId__' && h !== 'Timestamp');
  }, [rows]);

  const nextId = useMemo(() => {
    if (rows.length === 0) return '1';
    const idHeader = Object.keys(rows[0]).find(h => h.toLowerCase() === 'id');
    if (!idHeader) return '';
    
    const ids = rows
      .map(row => {
        const val = row[idHeader];
        return typeof val === 'number' ? val : parseInt(val);
      })
      .filter(id => !isNaN(id));
    
    if (ids.length === 0) return '1';
    return (Math.max(...ids) + 1).toString();
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!searchTerm) return rows;
    return rows.filter(row => 
      Object.values(row).some(val => 
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [rows, searchTerm]);

  if (view === 'form') {
    const headers = rows.length > 0 ? Object.keys(rows[0]).filter(k => k !== '__rowId__') : [];
    
    return (
      <div className="min-h-screen bg-[#FDFDFD] text-[#1F2937] font-sans selection:bg-[#DBEAFE] p-4 md:p-8 flex items-center justify-center">
        <Toaster position="top-right" richColors />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 md:p-12 rounded-[2.5rem] shadow-2xl shadow-blue-50 border border-[#F3F4F6] max-w-2xl w-full"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-gradient-to-br from-[#10B981] to-[#059669] p-3 rounded-2xl shadow-lg">
              <Database className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#111827]">Data Submission</h1>
              <p className="text-sm text-[#6B7280]">Submit your data to {selectedSheet || 'the spreadsheet'}</p>
            </div>
          </div>

          <form onSubmit={handleAdd} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
              {headers.map(header => {
                const config = dropdownConfigs.find(c => 
                  normalize(c.fieldName) === normalize(header)
                );
                const options = config ? dropdownOptions[`${config.sourceSheet}_${config.fieldName}`] : null;

                return (
                  <div key={header}>
                    <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-widest mb-2 ml-1">
                      {header}
                    </label>
                    {options ? (
                      <div className="relative">
                        <select
                          name={header}
                          required
                          className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-[#3B82F6] focus:bg-white transition-all outline-none appearance-none"
                        >
                          <option value="">Select an option</option>
                          {options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
                      </div>
                    ) : (
                      <input
                        type="text"
                        name={header}
                        required
                        defaultValue={header.toLowerCase() === 'id' ? nextId : ''}
                        className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-[#3B82F6] focus:bg-white transition-all outline-none"
                        placeholder={`Enter ${header.toLowerCase()}...`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-5 rounded-2xl font-bold transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                {isLoading ? 'Submitting...' : 'Submit Data'}
              </button>
            </div>
          </form>
          
          <p className="text-center text-[10px] text-[#9CA3AF] mt-8 uppercase tracking-widest font-bold">
            Powered by SheetFlow
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#1F2937] font-sans selection:bg-[#DBEAFE]">
      <Toaster position="top-right" richColors />
      
      {/* Fixed Navigation Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-[#E5E7EB] sticky top-0 z-50 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="bg-gradient-to-br from-[#10B981] to-[#059669] p-2 md:p-2.5 rounded-xl shadow-lg shadow-emerald-100">
            <Database className="text-white w-4 h-4 md:w-5 h-5" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-base md:text-lg font-bold tracking-tight text-[#111827]">SheetFlow</h1>
            <p className="hidden md:block text-[10px] text-[#6B7280] font-medium uppercase tracking-widest">Data Management</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 md:gap-3">
          {/* Mobile Search Toggle */}
          <button 
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="md:hidden p-2 text-[#4B5563] hover:bg-[#F3F4F6] rounded-xl transition-all"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Sheet Selection Dropdown */}
          {sheets.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="appearance-none bg-[#F3F4F6] border border-[#E5E7EB] rounded-full px-3 md:px-4 py-1.5 pr-8 md:pr-10 text-xs md:text-sm font-semibold text-[#374151] focus:ring-2 focus:ring-[#3B82F6] focus:bg-white transition-all cursor-pointer outline-none"
                >
                  {sheets.map(sheet => (
                    <option key={sheet} value={sheet}>{sheet}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 w-3 h-3 md:w-4 h-4 text-[#9CA3AF] pointer-events-none" />
              </div>
              <button 
                onClick={fetchSheets}
                className="p-1.5 hover:bg-[#F3F4F6] rounded-full transition-all text-[#6B7280]"
                title="Refresh sheets"
              >
                <RefreshCw className={cn("w-3 h-3 md:w-4 h-4", isLoading && "animate-spin")} />
              </button>
            </div>
          )}

          <div className="hidden md:flex items-center bg-[#F3F4F6] border border-[#E5E7EB] rounded-full px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#3B82F6] focus-within:bg-white transition-all">
            <Search className="w-4 h-4 text-[#9CA3AF] mr-2" />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Search data..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-48 placeholder:text-[#9CA3AF]"
            />
          </div>
          
          <div className="h-6 w-[1px] bg-[#E5E7EB] mx-1 hidden md:block" />

          <button 
            onClick={fetchData}
            disabled={isLoading || !isUrlSet}
            className="p-2 md:p-2.5 text-[#4B5563] hover:bg-[#F3F4F6] rounded-xl transition-all disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={cn("w-4 h-4 md:w-5 h-5", isLoading && "animate-spin")} />
          </button>
          <button 
            onClick={handleCopyFormLink}
            disabled={!isUrlSet || !selectedSheet}
            className="p-2 md:p-2.5 text-[#4B5563] hover:bg-[#F3F4F6] rounded-xl transition-all disabled:opacity-50"
            title="Copy Public Form Link"
          >
            <Copy className="w-4 h-4 md:w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 md:p-2.5 text-[#4B5563] hover:bg-[#F3F4F6] rounded-xl transition-all"
            title="Settings"
          >
            <Settings className="w-4 h-4 md:w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            disabled={!isUrlSet}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-3 md:px-5 py-2 md:py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-blue-100 font-semibold text-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Row</span>
          </button>
        </div>
      </header>

      {/* Mobile Search Bar */}
      <AnimatePresence>
        {showMobileSearch && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-white border-b border-[#E5E7EB] px-6 py-3 overflow-hidden"
          >
            <div className="flex items-center bg-[#F3F4F6] border border-[#E5E7EB] rounded-2xl px-4 py-2 focus-within:ring-2 focus-within:ring-[#3B82F6] focus-within:bg-white transition-all">
              <Search className="w-4 h-4 text-[#9CA3AF] mr-3" />
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Search data..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-[#9CA3AF]"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="p-1 hover:bg-gray-200 rounded-full">
                  <X className="w-3 h-3 text-gray-500" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-[1400px] mx-auto p-6 md:p-8">
        {!isUrlSet ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-10 rounded-[2rem] shadow-2xl shadow-blue-50 border border-[#F3F4F6] max-w-md w-full"
            >
              <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-[#3B82F6]" />
              </div>
              <h2 className="text-2xl font-bold text-[#111827] mb-3">Connect Your Sheet</h2>
              <p className="text-[#6B7280] mb-8 leading-relaxed">
                Unlock the power of your Google Sheets. Deploy our Apps Script and paste your URL to begin managing your data.
              </p>
              <button 
                onClick={() => setShowSettings(true)}
                className="w-full bg-[#111827] text-white py-4 rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-gray-200"
              >
                Configure Connection
              </button>
            </motion.div>
          </div>
        ) : rows.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
              <Database className="w-12 h-12 text-[#D1D5DB]" />
            </div>
            <h2 className="text-2xl font-bold text-[#111827]">No data available</h2>
            <p className="text-[#6B7280] mt-2">Your sheet might be empty or headers are missing.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#111827]">Spreadsheet Data</h2>
                <p className="text-sm text-[#6B7280] mt-1">Showing {filteredRows.length} entries from your active sheet</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleFilterClick}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#4B5563] bg-white border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-all"
                >
                  <Filter className="w-4 h-4" />
                  Filter
                </button>
                <button 
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#4B5563] bg-white border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-all"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>

            <div className="relative group">
              {/* Horizontal Scroll Buttons */}
              <AnimatePresence>
                {canScrollLeft && (
                  <motion.button
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    onClick={() => scrollTable('left')}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-white border border-[#E5E7EB] rounded-full shadow-xl text-[#4B5563] hover:bg-[#F9FAFB] transition-all"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </motion.button>
                )}
                {canScrollRight && (
                  <motion.button
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    onClick={() => scrollTable('right')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-white border border-[#E5E7EB] rounded-full shadow-xl text-[#4B5563] hover:bg-[#F9FAFB] transition-all"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </motion.button>
                )}
              </AnimatePresence>

              <div 
                ref={tableContainerRef}
                onScroll={checkScroll}
                className="bg-white rounded-[1.5rem] shadow-sm border border-[#E5E7EB] overflow-auto relative scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent"
                style={{ maxHeight: 'calc(100vh - 250px)' }}
              >
                <table className="w-full text-left border-collapse min-w-full">
                  <thead className="sticky top-0 z-10 bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <tr>
                      {headers.map(header => (
                        <th key={header} className="px-6 py-4 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest whitespace-nowrap">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    <AnimatePresence mode="popLayout">
                      {filteredRows.map((row) => (
                        <motion.tr 
                          key={row.__rowId__}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setActiveRowId(activeRowId === row.__rowId__ ? null : row.__rowId__)}
                          className={cn(
                            "transition-colors group cursor-pointer",
                            activeRowId === row.__rowId__ ? "bg-blue-50/50" : "hover:bg-[#F3F4F6]/50"
                          )}
                        >
                          {headers.map(header => (
                            <td key={header} className="px-6 py-4.5 text-sm text-[#374151] whitespace-nowrap">
                              {row[header]}
                            </td>
                          ))}
                          {activeRowId === row.__rowId__ && (
                            <td className="sticky right-0 p-0 w-0 h-0 overflow-visible z-20">
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-[#E5E7EB] p-1.5 rounded-xl shadow-lg ring-1 ring-black/5">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditing(row);
                                  }}
                                  className="p-2 text-[#6B7280] hover:bg-blue-50 hover:text-[#2563EB] rounded-lg transition-all"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmId(row.__rowId__);
                                  }}
                                  className="p-2 text-[#6B7280] hover:bg-red-50 hover:text-[#DC2626] rounded-lg transition-all"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-[#111827]/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-6 md:p-8"
            >
              <div className="mb-6">
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4">
                  <Trash2 className="w-6 h-6 text-[#DC2626]" />
                </div>
                <h2 className="text-2xl font-bold text-[#111827]">Delete Row</h2>
                <p className="text-[#6B7280] mt-1">Are you sure you want to delete this row? This action cannot be undone.</p>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 px-6 py-3 rounded-xl border border-[#E5E7EB] font-bold text-[#374151] hover:bg-[#F9FAFB] transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDelete(deleteConfirmId)}
                  disabled={isLoading}
                  className="flex-1 bg-[#DC2626] text-white py-3 rounded-xl font-bold hover:bg-[#B91C1C] transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !import.meta.env.VITE_APPS_SCRIPT_URL && setShowSettings(false)}
              className="absolute inset-0 bg-[#111827]/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl p-6 md:p-10 overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6">
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-[#F3F4F6] rounded-full transition-all">
                  <X className="w-6 h-6 text-[#9CA3AF]" />
                </button>
              </div>

              <div className="mb-8">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                  <Settings className="w-7 h-7 text-[#2563EB]" />
                </div>
                <h2 className="text-3xl font-bold text-[#111827]">Connection Settings</h2>
                <p className="text-[#6B7280] mt-1">Configure your Google Apps Script bridge</p>
              </div>
              
              <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div>
                  <label className="block text-sm font-bold text-[#374151] mb-3">
                    Apps Script Web App URL
                  </label>
                  <div className="relative">
                    <input 
                      type="url"
                      value={scriptUrl}
                      onChange={(e) => setScriptUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full pl-4 pr-12 py-4 rounded-2xl border border-[#E5E7EB] focus:ring-4 focus:ring-blue-50 focus:border-[#3B82F6] outline-none transition-all text-sm font-medium"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {isUrlSet ? <Check className="w-5 h-5 text-emerald-500" /> : <ExternalLink className="w-5 h-5 text-gray-300" />}
                    </div>
                  </div>
                </div>

                {isUrlSet && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-bold text-[#374151]">
                        Dropdown Configurations
                      </label>
                      <button
                        onClick={addDropdownConfig}
                        className="text-xs font-bold text-[#2563EB] hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add Dropdown
                      </button>
                    </div>
                    
                    {dropdownConfigs.length === 0 ? (
                      <p className="text-xs text-[#9CA3AF] italic bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-200 text-center">
                        No dropdowns configured. Fields will use standard text inputs.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {dropdownConfigs.map((config, index) => (
                          <div key={index} className="flex flex-col gap-2 p-4 bg-gray-50 rounded-2xl border border-gray-100 relative group">
                            <button 
                              onClick={() => removeDropdownConfig(index)}
                              className="absolute -top-2 -right-2 bg-white border border-gray-200 p-1.5 rounded-full text-red-500 hover:bg-red-50 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">Field Name</label>
                                <input
                                  type="text"
                                  value={config.fieldName}
                                  onChange={(e) => updateDropdownConfig(index, { fieldName: e.target.value })}
                                  placeholder="e.g. Category"
                                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">Source Sheet</label>
                                <select
                                  value={config.sourceSheet}
                                  onChange={(e) => updateDropdownConfig(index, { sourceSheet: e.target.value })}
                                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                                >
                                  <option value="">Select Sheet</option>
                                  {sheets.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-[#F9FAFB] p-6 rounded-3xl border border-[#E5E7EB]">
                  <h3 className="text-sm font-bold text-[#111827] mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-[#2563EB]" />
                      Setup Instructions
                    </div>
                    <button 
                      onClick={handleCopyCode}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-[10px] font-bold text-[#4B5563] hover:bg-[#F3F4F6] transition-all shadow-sm"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied' : 'Copy Bridge Code'}
                    </button>
                  </h3>
                  <ul className="text-xs text-[#4B5563] space-y-3 list-none">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-5 h-5 bg-white border border-[#E5E7EB] rounded-full flex items-center justify-center font-bold text-[10px]">1</span>
                      <span>Open your Google Sheet and go to <strong>Extensions &gt; Apps Script</strong>.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-5 h-5 bg-white border border-[#E5E7EB] rounded-full flex items-center justify-center font-bold text-[10px]">2</span>
                      <span>Paste the provided bridge code and click <strong>Deploy &gt; New Deployment</strong>.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-5 h-5 bg-white border border-[#E5E7EB] rounded-full flex items-center justify-center font-bold text-[10px]">3</span>
                      <span>Select <strong>Web App</strong>, set 'Execute as' to <strong>Me</strong> and 'Who has access' to <strong>Anyone</strong>.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-5 h-5 bg-white border border-[#E5E7EB] rounded-full flex items-center justify-center font-bold text-[10px]">4</span>
                      <span>Click <strong>Deploy</strong>, then <strong>Authorize Access</strong>. 
                        <br />
                        <span className="text-[10px] text-blue-600 font-semibold mt-1 block">
                          CRITICAL: Make sure your Google Sheet is shared with "Anyone with the link" as Viewer, or explicitly shared with the email address of the account that deployed the script.
                        </span>
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      localStorage.removeItem('sheetflow_url');
                      setScriptUrl('');
                      setIsUrlSet(false);
                      setRows([]);
                      setSheets([]);
                      setSelectedSheet('');
                      setShowSettings(true);
                      toast.info('URL cleared successfully');
                    }}
                    className="flex-1 px-6 py-4 rounded-2xl border border-[#E5E7EB] font-bold text-[#D93025] hover:bg-[#FEECEB] transition-all"
                  >
                    Clear URL
                  </button>
                  <button 
                    onClick={() => {
                      localStorage.setItem('sheetflow_url', scriptUrl);
                      setIsUrlSet(false);
                      setTimeout(() => setIsUrlSet(true), 10);
                      setSheets([]);
                      setSelectedSheet('');
                      setShowSettings(false);
                      toast.success('Configuration updated successfully');
                    }}
                    className="flex-[2] bg-[#2563EB] text-white py-4 rounded-2xl font-bold hover:bg-[#1D4ED8] transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    Save Configuration
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(isAdding || isEditing) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsAdding(false); setIsEditing(null); }}
              className="absolute inset-0 bg-[#111827]/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-6 md:p-10"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-[#111827]">
                    {isAdding ? 'New Entry' : 'Edit Entry'}
                  </h2>
                  <p className="text-[#6B7280] mt-1">Fill in the details for your sheet row</p>
                </div>
                <button onClick={() => { setIsAdding(false); setIsEditing(null); }} className="p-2 hover:bg-[#F3F4F6] rounded-full transition-all">
                  <X className="w-6 h-6 text-[#9CA3AF]" />
                </button>
              </div>
              
              <form onSubmit={isAdding ? handleAdd : handleUpdate} className="space-y-5">
                <div className="max-h-[400px] overflow-y-auto pr-2 space-y-5 scrollbar-hide">
                  {headers.map(header => {
                    const config = dropdownConfigs.find(c => 
                      normalize(c.fieldName) === normalize(header)
                    );
                    const options = config ? dropdownOptions[`${config.sourceSheet}_${config.fieldName}`] : null;

                    return (
                      <div key={header}>
                        <label className="block text-sm font-bold text-[#374151] mb-2">
                          {header}
                        </label>
                        {options ? (
                          <div className="relative">
                            <select
                              name={header}
                              defaultValue={isEditing ? isEditing[header] : ''}
                              required
                              className="w-full px-4 py-3.5 rounded-2xl border border-[#E5E7EB] focus:ring-4 focus:ring-blue-50 focus:border-[#3B82F6] outline-none transition-all text-sm font-medium appearance-none bg-white"
                            >
                              <option value="">Select an option</option>
                              {options.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
                          </div>
                        ) : (
                          <input 
                            name={header}
                            defaultValue={isEditing ? isEditing[header] : (header.toLowerCase() === 'id' ? nextId : '')}
                            required
                            className="w-full px-4 py-3.5 rounded-2xl border border-[#E5E7EB] focus:ring-4 focus:ring-blue-50 focus:border-[#3B82F6] outline-none transition-all text-sm font-medium"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-4 pt-6">
                  <button 
                    type="button"
                    onClick={() => { setIsAdding(false); setIsEditing(null); }}
                    className="flex-1 px-6 py-4 rounded-2xl border border-[#E5E7EB] font-bold text-[#4B5563] hover:bg-[#F9FAFB] transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-[#111827] text-white py-4 rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                    {isAdding ? 'Create Entry' : 'Update Entry'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto p-12 text-center">
        <div className="h-[1px] bg-gradient-to-r from-transparent via-[#E5E7EB] to-transparent mb-8" />
        <p className="text-xs font-bold text-[#9CA3AF] uppercase tracking-[0.2em]">© 2026 SheetFlow • Powered by Google AI Studio</p>
      </footer>
    </div>
  );
}
