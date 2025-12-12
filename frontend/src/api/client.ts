const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.toString().replace(/\/$/, "") || "/api/v1";

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type");
  const payload = contentType?.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail =
      typeof payload === "string" ? payload : payload?.detail || payload?.title;
    throw new ApiError(
      detail || `Request failed with status ${response.status}`,
      response.status
    );
  }

  return payload as T;
}

export interface MaterialResponse {
  material_id: string;
  image_base64: string;
  meta?: Record<string, unknown>;
}

export interface PreviewResponse {
  image_base64: string;
}

export async function uploadMaterial(file: File): Promise<MaterialResponse> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE_URL}/materials/upload`, {
    method: "POST",
    body: form,
  });
  return handleResponse<MaterialResponse>(response);
}

export async function fetchMaterial(id: string): Promise<MaterialResponse> {
  const response = await fetch(`${API_BASE_URL}/materials/${id}`);
  return handleResponse<MaterialResponse>(response);
}

export interface PreviewParams {
  algo?: string;
  size?: number;
}

export async function fetchPreview(id: string, params: PreviewParams = {}): Promise<PreviewResponse> {
  const url = new URL(`${API_BASE_URL}/materials/${id}/preview`, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString());
  return handleResponse<PreviewResponse>(response);
}

async function parseErrorResponse(response: Response) {
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    const payload = await response.json();
    return payload?.detail || payload?.title;
  }
  return response.text();
}

export async function forgeIcon(
  sourceId: string,
  midAlgo: string,
  tinyIcon: Blob
): Promise<Blob> {
  const form = new FormData();
  form.append("source_id", sourceId);
  form.append("mid_algo", midAlgo);
  form.append("tiny_icon", new File([tinyIcon], "tiny-icon.png", { type: "image/png" }));

  const response = await fetch(`${API_BASE_URL}/forge`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const detail = await parseErrorResponse(response);
    throw new ApiError(detail || `Request failed with status ${response.status}`, response.status);
  }

  return response.blob();
}
