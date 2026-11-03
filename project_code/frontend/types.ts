export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface DatabaseStatus {
  isConnected: boolean;
  database?: string;
  version?: string;
  rowCount?: number;
}
