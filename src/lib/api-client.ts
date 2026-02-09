export type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  message?: string;
  errors?: Array<{ field?: string; message: string }>;
};

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
    return {
      ok: response.ok,
      message: "Non-JSON response from server"
    } as ApiResponse<T>;
  }
}

function getActivityHeaders() {
  if (typeof window === "undefined") return {};
  const actorName = window.localStorage.getItem("activeUserName");
  const actorId = window.localStorage.getItem("activeUserId");
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

  const payload = await parseApiResponse<T>(response);

  if (!response.ok || !payload.ok) {
    throw new Error(payload.message ?? "Request failed");
  }

  return payload.data as T;
}
