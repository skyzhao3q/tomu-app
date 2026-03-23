import { ApiError, ConnectionError } from "./lib/errors.js";

export function getBaseUrl(): string {
  return process.env.TOMU_API_URL || "http://localhost:33001";
}

export async function apiFetch<T = unknown>(
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getBaseUrl()}/api${endpoint}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ConnectionError();
  }

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new ApiError(response.status, text);
  }

  if (response.status === 204 || response.status === 201) {
    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }
  return response.json() as Promise<T>;
}

export async function apiFetchRaw(
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<Response> {
  try {
    return await fetch(`${getBaseUrl()}/api${endpoint}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ConnectionError();
  }
}
