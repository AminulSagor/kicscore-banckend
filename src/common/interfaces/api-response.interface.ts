export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  timestamp: string;
  path: string;
}

export interface ControllerResponse<T> {
  message: string;
  data: T;
}
