export interface SheetRow {
  __rowId__: string;
  [key: string]: any;
}

export interface AppsScriptResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}

export interface DropdownConfig {
  fieldName: string;
  sourceSheet: string;
}

export type ActionType = 'GET_ALL' | 'ADD_ROW' | 'UPDATE_ROW' | 'DELETE_ROW' | 'GET_SHEETS';
