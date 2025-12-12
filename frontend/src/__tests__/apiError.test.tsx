import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorPage } from "@/pages/EditorPage";

const originalFetch = global.fetch;

describe("API error handling", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("shows error message when request fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network crash"));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<EditorPage />);

    await userEvent.click(screen.getByText("请求预览"));

    expect(await screen.findByTestId("api-error")).toHaveTextContent("Network crash");
  });

  it("uses backend field names for preview flow", async () => {
    const materialResponse = new Response(
      JSON.stringify({ material_id: "abc", image_base64: "data-material" }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
    const previewResponse = new Response(JSON.stringify({ image_base64: "preview-data" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(materialResponse)
      .mockResolvedValueOnce(previewResponse);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<EditorPage />);

    await userEvent.click(screen.getByText("请求预览"));

    expect(await screen.findByTestId("api-success"))
      .toHaveTextContent(`已获取素材 abc, 预览长度 ${"preview-data".length}`);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/materials/abc/preview")
    );
  });
});
