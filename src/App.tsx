/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
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
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppsScriptService } from './services/appsScript';
import { SheetRow } from './types';
import { cn } from './lib/utils';

export default function App() {
  const [scriptUrl, setScriptUrl] = useState<string>(import.meta.env.VITE_APPS_SCRIPT_URL || '');
  const [isUrlSet, setIsUrlSet] = useState<boolean>(!!import.meta.env.VITE_APPS_SCRIPT_URL);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<SheetRow | null>(null);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(!import.meta.env.VITE_APPS_SCRIPT_URL);

  const service = useMemo(() => scriptUrl ? new AppsScriptService(scriptUrl) : null, [scriptUrl]);

  const fetchData = async () => {
    if (!service) return;
    setIsLoading(true);
    try {
      const data = await service.getAll();
      setRows(data);
    } catch (error) {
      toast.error('Failed to fetch data. Check your Apps Script URL and permissions.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isUrlSet) {
      fetchData();
    }
  }, [isUrlSet]);

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
      await service.addRow(data);
      toast.success('Row added successfully');
      setIsAdding(false);
      // Small delay to allow Apps Script to finish processing
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
      await service.updateRow(isEditing.id, data);
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
    if (!service || !confirm('Are you sure you want to delete this row?')) return;
    setIsLoading(true);
    try {
      await service.deleteRow(id);
      toast.success('Row deleted successfully');
      setTimeout(fetchData, 1000);
    } catch (error) {
      toast.error('Failed to delete row');
    } finally {
      setIsLoading(false);
    }
  };

  const headers = useMemo(() => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).filter(h => h !== 'id');
  }, [rows]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#202124] font-sans selection:bg-[#E8F0FE]">
      <Toaster position="top-right" richColors />
      
      {/* Header */}
      <header className="bg-white border-b border-[#DADCE0] sticky top-0 z-10 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-[#0F9D58] p-2 rounded-lg">
            <Database className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-medium tracking-tight">SheetFlow</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchData}
            disabled={isLoading || !isUrlSet}
            className="p-2 hover:bg-[#F1F3F4] rounded-full transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-[#F1F3F4] rounded-full transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            disabled={!isUrlSet}
            className="bg-[#1A73E8] hover:bg-[#1765CC] text-white px-4 py-2 rounded-md flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Add Row</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {!isUrlSet ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-[#DADCE0] max-w-md w-full">
              <AlertCircle className="w-12 h-12 text-[#FBBC04] mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Setup Required</h2>
              <p className="text-[#5F6368] mb-6">
                To get started, you need to deploy a Google Apps Script as a web app and provide the URL here.
              </p>
              <button 
                onClick={() => setShowSettings(true)}
                className="w-full bg-[#1A73E8] text-white py-3 rounded-xl font-medium hover:bg-[#1765CC] transition-colors"
              >
                Configure Connection
              </button>
            </div>
          </div>
        ) : rows.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
            <Database className="w-16 h-16 mb-4" />
            <h2 className="text-xl font-medium">No data found</h2>
            <p>Your sheet might be empty or the headers are missing.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-[#DADCE0] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b border-[#DADCE0]">
                    {headers.map(header => (
                      <th key={header} className="px-6 py-4 text-xs font-semibold text-[#5F6368] uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                    <th className="px-6 py-4 text-xs font-semibold text-[#5F6368] uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DADCE0]">
                  <AnimatePresence mode="popLayout">
                    {rows.map((row) => (
                      <motion.tr 
                        key={row.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-[#F8F9FA] transition-colors group"
                      >
                        {headers.map(header => (
                          <td key={header} className="px-6 py-4 text-sm text-[#3C4043]">
                            {row[header]}
                          </td>
                        ))}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setIsEditing(row)}
                              className="p-2 text-[#5F6368] hover:bg-[#E8F0FE] hover:text-[#1A73E8] rounded-full transition-all"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(row.id)}
                              className="p-2 text-[#5F6368] hover:bg-[#FEECEB] hover:text-[#D93025] rounded-full transition-all"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !import.meta.env.VITE_APPS_SCRIPT_URL && setShowSettings(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Connection Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-[#F1F3F4] rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[#3C4043] mb-2">
                    Apps Script Web App URL
                  </label>
                  <input 
                    type="url"
                    value={scriptUrl}
                    onChange={(e) => setScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full px-4 py-3 rounded-xl border border-[#DADCE0] focus:ring-2 focus:ring-[#1A73E8] focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div className="bg-[#F8F9FA] p-4 rounded-xl border border-[#DADCE0]">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-[#1A73E8]" />
                    How to get this URL?
                  </h3>
                  <ol className="text-sm text-[#5F6368] space-y-2 list-decimal ml-4">
                    <li>Create a Google Apps Script project.</li>
                    <li>Copy the code provided in the documentation.</li>
                    <li>Click <strong>Deploy</strong> &gt; <strong>New Deployment</strong>.</li>
                    <li>Select <strong>Web App</strong>.</li>
                    <li>Set <strong>Execute as:</strong> Me.</li>
                    <li>Set <strong>Who has access:</strong> Anyone.</li>
                    <li>Deploy and copy the Web App URL.</li>
                  </ol>
                </div>

                <button 
                  onClick={() => {
                    setIsUrlSet(!!scriptUrl);
                    setShowSettings(false);
                    toast.success('Settings saved');
                  }}
                  className="w-full bg-[#1A73E8] text-white py-3 rounded-xl font-medium hover:bg-[#1765CC] transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Save Configuration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(isAdding || isEditing) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsAdding(false); setIsEditing(null); }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">
                  {isAdding ? 'Add New Row' : 'Edit Row'}
                </h2>
                <button onClick={() => { setIsAdding(false); setIsEditing(null); }} className="p-2 hover:bg-[#F1F3F4] rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={isAdding ? handleAdd : handleUpdate} className="space-y-4">
                {headers.map(header => (
                  <div key={header}>
                    <label className="block text-sm font-medium text-[#3C4043] mb-1">
                      {header}
                    </label>
                    <input 
                      name={header}
                      defaultValue={isEditing ? isEditing[header] : ''}
                      required
                      className="w-full px-4 py-2 rounded-lg border border-[#DADCE0] focus:ring-2 focus:ring-[#1A73E8] focus:border-transparent outline-none transition-all"
                    />
                  </div>
                ))}

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => { setIsAdding(false); setIsEditing(null); }}
                    className="flex-1 px-4 py-3 rounded-xl border border-[#DADCE0] font-medium hover:bg-[#F8F9FA] transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-[#1A73E8] text-white py-3 rounded-xl font-medium hover:bg-[#1765CC] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                    {isAdding ? 'Create' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto p-6 text-center text-[#5F6368] text-sm">
        <p>© 2026 SheetFlow • Built for Google AI Studio</p>
      </footer>
    </div>
  );
}
