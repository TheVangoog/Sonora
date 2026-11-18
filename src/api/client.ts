// Calls to the Sonora API. It lives under /api on the same origin (Vercel
// rewrites it to the server; `npm run dev` proxies it), so the cookie just works.

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  { keepalive = false } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      keepalive, // lets a request finish while the tab closes
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "The server cannot be reached.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.error ?? `Server error (${response.status}).`);
  return data as T;
}
