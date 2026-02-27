export type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  message?: string;
  errors?: Array<{ field?: string; message: string }>;
};

const STORAGE_NAME = "activeUserName";
const STORAGE_ID = "activeUserId";

async function parseApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const text = await response.text();
  if (!text) {
    return {
      ok: response.ok,
      message: response.ok ? undefined : "Empty response"
    } as ApiResponse<T>;
  }
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    console.error("Non-JSON response from server. Status:", response.status, "Body preview:", text.slice(0, 500));
    return {
      ok: false,
      message: `Non-JSON response (Status ${response.status}): ${text.slice(0, 100)}...`
    } as ApiResponse<T>;
  }
}

function getActivityHeaders() {
  if (typeof window === "undefined") return {};
  const actorName = window.localStorage.getItem(STORAGE_NAME);
  const actorId = window.localStorage.getItem(STORAGE_ID);
  const headers: Record<string, string> = {};
  if (actorName) headers["x-activity-user"] = actorName;
  if (actorId) headers["x-activity-user-id"] = actorId;
  return headers;
}

export async function apiGet<T>(path: string) {
  const response = await fetch(path, {
    cache: "no-store",
    headers: getActivityHeaders()
  });
  if (response.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new Error("Authentication required");
  }
  const payload = await parseApiResponse<T>(response);

  if (!response.ok || !payload.ok) {
    throw new Error(payload.message ?? "Request failed");
  }

  return payload.data as T;
}

export async function apiSend<T>(path: string, method: "POST" | "PUT" | "DELETE", body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...getActivityHeaders()
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (response.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new Error("Authentication required");
  }

  const payload = await parseApiResponse<T>(response);

  if (!response.ok || !payload.ok) {
    throw new Error(payload.message ?? "Request failed");
  }

  return payload.data as T;
}
