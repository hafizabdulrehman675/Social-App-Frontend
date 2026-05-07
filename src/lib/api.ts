const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const DEFAULT_AVATAR_URL = "https://i.pravatar.cc/100?u=default-avatar";

export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

function normalizeMediaUrl(value: string): string {
  if (!value.startsWith("/uploads/")) return value;
  return `${API_BASE_URL}${value}`;
}

function normalizeResponseData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeResponseData(item));
  }

  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(input)) {
      if (key === "avatarUrl") {
        if (typeof v === "string") {
          output[key] = normalizeMediaUrl(v);
        } else {
          output[key] = DEFAULT_AVATAR_URL;
        }
      } else if (key === "imageUrl" && typeof v === "string") {
        output[key] = normalizeMediaUrl(v);
      } else if (key === "imageUrl" && v == null) {
        output[key] = "";
      } else {
        output[key] = normalizeResponseData(v);
      }
    }
    return output;
  }

  return value;
}

export function ensureAvatarUrl(avatarUrl?: string | null): string {
  if (!avatarUrl) return DEFAULT_AVATAR_URL;
  return avatarUrl.startsWith("/uploads/")
    ? `${API_BASE_URL}${avatarUrl}`
    : avatarUrl;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const rawJson = await response.json().catch(() => null);
  const json = normalizeResponseData(rawJson) as T | null;
  const jsonAny = json as
    | {
        message?: string;
        error?: { message?: string };
      }
    | null;

  if (!response.ok) {
    const message =
      jsonAny?.message || jsonAny?.error?.message || "Request failed";
    throw new ApiError(message, response.status);
  }

  return json as T;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const baseHeaders: Record<string, string> = {
    "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
  const isFormDataBody =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const providedHeaders = (options.headers || {}) as Record<string, string>;
  const headers = {
    ...baseHeaders,
    ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
    ...providedHeaders,
  };

  if (isFormDataBody && "Content-Type" in headers) {
    delete headers["Content-Type"];
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...options,
    headers,
  });

  return parseResponse<T>(response);
}

export { API_BASE_URL, DEFAULT_AVATAR_URL };

