/**
 * Google Apps Script Code (Copy this to your Apps Script project)
 * 
 * function doGet(e) {
 *   try {
 *     const action = e.parameter.action;
 *     const ss = SpreadsheetApp.getActiveSpreadsheet();
 *     
 *     if (action === 'GET_SHEETS') {
 *       const sheets = ss.getSheets().map(s => s.getName());
 *       return createResponse({ status: 'success', data: sheets });
 *     }
 * 
 *     const sheetName = e.parameter.sheet || ss.getSheets()[0].getName();
 *     const sheet = ss.getSheetByName(sheetName);
 *     
 *     if (sheet.getLastRow() === 0) {
 *       return createResponse({ status: 'success', data: [], message: 'Sheet is empty' });
 *     }
 * 
 *     const data = sheet.getDataRange().getValues();
 *     const headers = data[0];
 *     
 *     if (action === 'GET_ALL') {
 *       const rows = data.slice(1).map((row, index) => {
 *         const obj = { __rowId__: (index + 2).toString() };
 *         headers.forEach((header, i) => {
 *           obj[header] = row[i];
 *         });
 *         return obj;
 *       });
 *       return createResponse({ status: 'success', data: rows });
 *     }
 *     
 *     return createResponse({ status: 'error', message: 'Invalid action: ' + action });
 *   } catch (error) {
 *     return createResponse({ status: 'error', message: error.toString() });
 *   }
 * }
 * 
 * function doPost(e) {
 *   try {
 *     const payload = JSON.parse(e.postData.contents);
 *     const action = payload.action;
 *     const ss = SpreadsheetApp.getActiveSpreadsheet();
 *     const sheetName = payload.sheet || ss.getSheets()[0].getName();
 *     const sheet = ss.getSheetByName(sheetName);
 *     
 *     if (action === 'ADD_ROW') {
 *       const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
 *       const newRow = headers.map(header => payload.data[header] || "");
 *       sheet.appendRow(newRow);
 *       return createResponse({ status: 'success', message: 'Row added' });
 *     }
 * 
 *     if (action === 'UPDATE_ROW') {
 *       const rowId = parseInt(payload.id);
 *       const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
 *       headers.forEach((header, i) => {
 *         if (payload.data[header] !== undefined) {
 *           sheet.getRange(rowId, i + 1).setValue(payload.data[header]);
 *         }
 *       });
 *       return createResponse({ status: 'success', message: 'Row updated' });
 *     }
 * 
 *     if (action === 'DELETE_ROW') {
 *       const rowId = parseInt(payload.id);
 *       sheet.deleteRow(rowId);
 *       return createResponse({ status: 'success', message: 'Row deleted' });
 *     }
 *     
 *     return createResponse({ status: 'error', message: 'Invalid action: ' + action });
 *   } catch (error) {
 *     return createResponse({ status: 'error', message: error.toString() });
 *   }
 * }
 * 
 * function createResponse(obj) {
 *   return ContentService.createTextOutput(JSON.stringify(obj))
 *     .setMimeType(ContentService.MimeType.JSON);
 * }
 */

import { AppsScriptResponse, SheetRow } from "../types";

export class AppsScriptService {
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async getSheets(): Promise<string[]> {
    const response = await fetch(`${this.url}?action=GET_SHEETS`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result: AppsScriptResponse<string[]> = await response.json();
    if (result.status === 'error') throw new Error(result.message);
    return result.data || [];
  }

  async getAll(sheetName?: string): Promise<SheetRow[]> {
    const url = new URL(this.url);
    url.searchParams.append('action', 'GET_ALL');
    if (sheetName) url.searchParams.append('sheet', sheetName);
    
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result: AppsScriptResponse<SheetRow[]> = await response.json();
    if (result.status === 'error') throw new Error(result.message);
    return result.data || [];
  }

  async addRow(data: any, sheetName?: string): Promise<void> {
    await fetch(this.url, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ action: 'ADD_ROW', data, sheet: sheetName }),
    });
  }

  async updateRow(rowId: string, data: any, sheetName?: string): Promise<void> {
    await fetch(this.url, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ action: 'UPDATE_ROW', id: rowId, data, sheet: sheetName }),
    });
  }

  async deleteRow(rowId: string, sheetName?: string): Promise<void> {
    await fetch(this.url, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ action: 'DELETE_ROW', id: rowId, sheet: sheetName }),
    });
  }
}
