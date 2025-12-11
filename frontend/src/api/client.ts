const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.toString().replace(/\/$/, "") || "/api/v1";

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type");
  const payload = contentType?.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail =
      typeof payload === "string" ? payload : payload?.detail || payload?.title;
    throw new Error(detail || `Request failed with status ${response.status}`);
  }

  return payload as T;
}

export async function uploadMaterial(file: File) {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE_URL}/materials/upload`, {
    method: "POST",
    body: form,
  });
  return handleResponse<{ id: string; preview: string }>(response);
}

export async function fetchMaterial(id: string) {
  const response = await fetch(`${API_BASE_URL}/materials/${id}`);
  return handleResponse<{ id: string; preview: string; meta?: Record<string, unknown> }>(
    response
  );
}

export interface PreviewParams {
  algo?: string;
  size?: number;
}

export async function fetchPreview(id: string, params: PreviewParams = {}) {
  const url = new URL(`${API_BASE_URL}/materials/${id}/preview`, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString());
  return handleResponse<{ preview: string }>(response);
}
