
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
}

export enum AuthMethod {
  NONE = 'none',
  BEARER = 'bearer',
  BASIC = 'basic',
  API_KEY = 'api_key',
}

export interface KeyValueItem {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

// Used specifically for multipart/form-data where each field can be text or file
export type MultipartValueType = 'text' | 'file';

export interface MultipartField extends KeyValueItem {
  valueType: MultipartValueType;
  // When valueType === 'file', value can be used for a display name, while
  // the actual File object is stored separately
  file?: File | null;
}

export interface RequestAuth {
  type: AuthMethod;
  token?: string;
  username?: string;
  password?: string;
  apiKeyKey?: string;
  apiKeyValue?: string;
  apiKeyLocation?: 'header' | 'query';
}

export type BodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'graphql';

export interface ExpectedResponse {
  id: string;
  statusCode: string;
  description: string;
  bodyContent?: string; // Sample response body
}

export type AssertionType = 'status_code' | 'response_time' | 'json_body' | 'header' | 'text_body';
export type AssertionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';

export interface TestCase {
  id: string;
  name: string;
  type: AssertionType;
  property?: string; // e.g., "Content-Type" for headers or "$.data.id" for JSON
  operator: AssertionOperator;
  value?: string;
  enabled: boolean;
}

export interface TestResult {
  testCaseId: string;
  testCaseName: string;
  passed: boolean;
  message: string;
  actualValue?: any;
}

export interface ApiRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValueItem[];
  headers: KeyValueItem[];

  // Body Config
  bodyType: BodyType;
  bodyContent: string; // Used for JSON
  multipartParams: MultipartField[];
  formEncodedParams: KeyValueItem[];
  graphqlQuery: string;
  graphqlVariables: string;

  auth: RequestAuth;
  useProxy: boolean;
  summary?: string;
  description?: string;
  expectedResponses?: ExpectedResponse[];
  testCases?: TestCase[];
}

// Extends ApiRequest to include organization data
export interface SavedRequest extends ApiRequest {
  collectionId: string;
  workspaceId: string;
  updatedAt: number;
}

export interface ApiResponse {
  statusCode: number;
  statusText: string;
  time: number; // ms
  size: number; // bytes
  headers: Record<string, string>;
  data: any;
  error?: string;
  testResults?: TestResult[];
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  // Optional backend workspace id when synced with the Node server
  backendId?: number | null;
}

export interface Collection {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: number;
}

export interface Environment {
  id: string;
  name: string;
  variables: KeyValueItem[];
}

export interface HistoryItem {
  id: string;
  workspaceId: string;
  timestamp: number;
  request: ApiRequest;
  responseStatus?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  // Backend user id from SQLite
  backendId?: number | null;
}

export interface Invitation {
  id: number;
  workspaceId: number;
  inviterId: number;
  inviteeEmail: string;
  role: string;
  status: string;
  createdAt: number;
  workspaceName: string;
  inviterName: string;
  inviterEmail: string;
}

// Mock User for Auth simulation
export const MOCK_USER: User = {
  id: 'u_123',
  email: 'demo@communicatex.dev',
  name: 'CommunicateX Developer',
};

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}