/**
 * AWS LEARNING ZONE — Amazon API Gateway
 * ------------------------------------------------------------------
 * Every service in `src/services/*` should eventually route its network
 * calls through this thin API client. Today it is unused by the mock
 * implementations; when you stand up API Gateway + Lambda, point
 * `VITE_API_URL` at your stage URL and swap the Mock* services for Aws*
 * services that call `apiClient`.
 */
export interface ApiRequest {
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  authToken?: string;
}

export interface ApiClient {
  request<T>(req: ApiRequest): Promise<T>;
}
