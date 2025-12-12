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
  targetSize?: number;
  fallbackSizes?: number[];
}

async function scalePreviewToSize(imageBase64: string, targetSize: number) {
  const image = new Image();
  image.src = `data:image/png;base64,${imageBase64}`;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to load preview image"));
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not supported in this environment");
  }

  canvas.width = targetSize;
  canvas.height = targetSize;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, targetSize, targetSize);

  return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
}

export async function fetchPreview(id: string, params: PreviewParams = {}): Promise<PreviewResponse> {
  const { targetSize, fallbackSizes = [], ...query } = params;
  const preferredSize = query.size ?? targetSize;
  const candidates = preferredSize !== undefined ? [preferredSize, ...fallbackSizes] : fallbackSizes;

  if (!candidates.length) {
    throw new Error("Preview size is required when no fallback sizes are provided");
  }

  let lastError: unknown;
  for (const requestedSize of candidates) {
    const url = new URL(`${API_BASE_URL}/materials/${id}/preview`, window.location.origin);
    const searchParams = { ...query, size: requestedSize } satisfies PreviewParams;

    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });

    try {
      const response = await fetch(url.toString());
      const preview = await handleResponse<PreviewResponse>(response);

      if (targetSize && targetSize !== requestedSize) {
        const scaled = await scalePreviewToSize(preview.image_base64, targetSize);
        return { image_base64: scaled };
      }
      return preview;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Failed to fetch preview");
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
  const url = new URL(`${API_BASE_URL}/forge`, window.location.origin);
  url.searchParams.set("mid_algo", midAlgo);

  const form = new FormData();
  form.append("source_id", sourceId);
  form.append("mid_algo", midAlgo);
  form.append("tiny_icon", new File([tinyIcon], "tiny-icon.png", { type: "image/png" }));

  const response = await fetch(url.toString(), {
    method: "POST",
    body: form,
    headers: { "x-mid-algo": midAlgo },
  });

  if (!response.ok) {
    const detail = await parseErrorResponse(response);
    throw new ApiError(detail || `Request failed with status ${response.status}`, response.status);
  }

  return response.blob();
}
