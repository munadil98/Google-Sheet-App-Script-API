export interface SheetRow {
  id: string;
  [key: string]: any;
}

export interface AppsScriptResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}

export type ActionType = 'GET_ALL' | 'ADD_ROW' | 'UPDATE_ROW' | 'DELETE_ROW';
