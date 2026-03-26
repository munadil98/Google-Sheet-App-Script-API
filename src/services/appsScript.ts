/**
 * Google Apps Script Code (Copy this to your Apps Script project)
 * 
 * function doGet(e) {
 *   try {
 *     const action = e.parameter.action;
 *     const ss = SpreadsheetApp.getActiveSpreadsheet();
 *     const sheet = ss.getActiveSheet();
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
 *         const obj = { id: (index + 2).toString() };
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
 *     const sheet = ss.getActiveSheet();
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
 * 
 * // IMPORTANT: When deploying, ensure "Who has access" is set to "Anyone"
 */

import { AppsScriptResponse, SheetRow } from "../types";

export class AppsScriptService {
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async getAll(): Promise<SheetRow[]> {
    const response = await fetch(`${this.url}?action=GET_ALL`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result: AppsScriptResponse<SheetRow[]> = await response.json();
    if (result.status === 'error') throw new Error(result.message);
    return result.data || [];
  }

  async addRow(data: any): Promise<void> {
    await fetch(this.url, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ action: 'ADD_ROW', data }),
    });
  }

  async updateRow(id: string, data: any): Promise<void> {
    await fetch(this.url, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ action: 'UPDATE_ROW', id, data }),
    });
  }

  async deleteRow(id: string): Promise<void> {
    await fetch(this.url, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ action: 'DELETE_ROW', id }),
    });
  }
}
