import type { ApiClient, ApiRequest } from "./types";

export const API_BASE_URL = import.meta.env["VITE_API_URL"] ?? "";

/**
 * AWS INTEGRATION BOUNDARY — Amazon API Gateway
 * The frontend never speaks to AWS SDKs directly. It speaks HTTP to this
 * client, which will speak to API Gateway, which invokes Lambda.
 *
 *   UI -> Service -> apiClient -> API Gateway -> Lambda -> DynamoDB
 */
export const apiClient: ApiClient = {
  async request<T>({ path, method = "GET", body, query, authToken }: ApiRequest): Promise<T> {
    if (!API_BASE_URL) {
      throw new Error(
        `[AWS INTEGRATION PENDING] No VITE_API_URL configured. ${method} ${path} was not sent. ` +
          `Deploy API Gateway and set VITE_API_URL to enable real requests.`,
      );
    }
    const url = new URL(path.replace(/^\//, ""), API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`);
    Object.entries(query ?? {}).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, String(v)));

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) throw new Error(`API ${method} ${path} failed with ${res.status}`);
    return (await res.json()) as T;
  },
};
