import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/components/PixelBoard", async () => {
  const React = await import("react");
  const mockExportPngBlob = vi.fn(async () => new Blob(["tiny"], { type: "image/png" }));
  const PixelBoard = React.forwardRef((_, ref) => {
    React.useImperativeHandle(ref, () => ({
      exportPngBlob: mockExportPngBlob,
      getPixels: () => [],
    }));
    return <div data-testid="mock-pixel-board">pixel-board</div>;
  });

  return {
    __esModule: true,
    PixelBoard,
    mockExportPngBlob,
  };
});

import { EditorPage } from "@/pages/EditorPage";
import { mockExportPngBlob } from "@/components/PixelBoard";

const API_BASE = "/api/v1";
const base64Image = "YmFzZTY0LWRhdGE=";
let lastPreviewAlgo = "";
let lastForgeAlgo = "";
let forgeCalled = false;

const server = setupServer(
  http.post(`${API_BASE}/materials/upload`, async () =>
    HttpResponse.json({ material_id: "material-123", image_base64: base64Image })
  ),
  http.get(`${API_BASE}/materials/:id`, async () =>
    HttpResponse.json({ material_id: "material-123", image_base64: base64Image })
  ),
  http.get(`${API_BASE}/materials/:id/preview`, async ({ request }) => {
    const url = new URL(request.url);
    lastPreviewAlgo = url.searchParams.get("algo") ?? "";
    const size = url.searchParams.get("size") ?? "unknown";
    return HttpResponse.json({ image_base64: `${size}-preview` });
  }),
  http.post(`${API_BASE}/forge`, async ({ request }) => {
    forgeCalled = true;
    const formData = await request.formData();
    lastForgeAlgo = (formData.get("mid_algo") as string) ?? "";
    return HttpResponse.text("ico-binary");
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  lastPreviewAlgo = "";
  lastForgeAlgo = "";
  forgeCalled = false;
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe("EditorPage API flows", () => {
  it("uploads material via drag and shows success message", async () => {
    render(<EditorPage />);

    const dropZone = screen.getByText(/拖拽 PNG\/ICO 到此处/).closest("label");
    const file = new File(["image"], "demo.png", { type: "image/png" });
    fireEvent.drop(dropZone as HTMLElement, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(await screen.findByTestId("api-success")).toHaveTextContent(
      /素材上传成功，ID: material-123/
    );
    expect(screen.getByAltText("已上传素材")).toBeInTheDocument();
  });

  it("shows upload error when server fails", async () => {
    server.use(
      http.post(`${API_BASE}/materials/upload`, () =>
        HttpResponse.json({ detail: "upload failed" }, { status: 500 })
      )
    );
    render(<EditorPage />);

    const dropZone = screen.getByText(/拖拽 PNG\/ICO 到此处/).closest("label");
    const file = new File(["image"], "demo.png", { type: "image/png" });
    fireEvent.drop(dropZone as HTMLElement, {
      dataTransfer: {
        files: [file],
      },
    });

    const alert = await screen.findByTestId("api-error");
    expect(alert).toHaveTextContent("upload failed");
  });

  it("requests previews with selected algorithm and renders images", async () => {
    render(<EditorPage />);

    await userEvent.selectOptions(screen.getByLabelText("算法选择"), "NEAREST");
    await userEvent.click(screen.getByText("请求预览"));

    expect(await screen.findByAltText("256px preview")).toBeInTheDocument();
    expect(screen.getByAltText("48px preview")).toBeInTheDocument();
    expect(screen.getByAltText("32px preview")).toBeInTheDocument();
    expect(lastPreviewAlgo).toBe("NEAREST");
    expect(screen.getByTestId("api-success")).toHaveTextContent("算法 NEAREST");
  });

  it("surfaces preview errors", async () => {
    server.use(
      http.get(`${API_BASE}/materials/:id/preview`, () =>
        HttpResponse.json({ detail: "preview failed" }, { status: 404 })
      )
    );
    render(<EditorPage />);

    await userEvent.click(screen.getByText("请求预览"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("preview failed");
  });

  it("calls export and downloads when forge succeeds", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectUrlSpy = vi.fn(() => "blob:ico");
    const revokeSpy = vi.fn();
    URL.createObjectURL = createObjectUrlSpy;
    URL.revokeObjectURL = revokeSpy;

    const requestUrls: string[] = [];
    const requestListener = ({ request }: { request: Request }) => {
      requestUrls.push(request.url);
    };
    server.events.on("request:start", requestListener);

    render(<EditorPage />);

    await userEvent.selectOptions(screen.getByLabelText("算法选择"), "BILINEAR");
    expect((screen.getByLabelText("算法选择") as HTMLSelectElement).value).toBe(
      "BILINEAR"
    );
    await userEvent.click(screen.getByText("Forge"));

    await waitFor(() => expect(mockExportPngBlob).toHaveBeenCalled(), { timeout: 2000 });
    await waitFor(() => expect(forgeCalled).toBe(true), { timeout: 2000 });
    expect(requestUrls.some((url) => url.endsWith("/api/v1/forge"))).toBe(true);
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    server.events.removeListener("request:start", requestListener);
  });

  it("shows forge error with api details", async () => {
    server.use(
      http.post(`${API_BASE}/forge`, () =>
        HttpResponse.json({ detail: "material expired" }, { status: 404 })
      )
    );
    render(<EditorPage />);

    await userEvent.click(screen.getByText("Forge"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("material expired");
    expect(alert).toHaveTextContent("素材可能已过期");
  });
});
