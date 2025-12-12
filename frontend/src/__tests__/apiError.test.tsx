import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorPage } from "@/pages/EditorPage";

const originalFetch = globalThis.fetch;

describe("API error handling", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("shows error message when request fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network crash"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

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

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(materialResponse)
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ image_base64: "preview-data" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        )
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<EditorPage />);

    await userEvent.click(screen.getByText("请求预览"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(await screen.findByTestId("api-success"))
      .toHaveTextContent("已获取素材 abc，算法 LANCZOS");

    const previewUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(
      previewUrls.some((url) =>
        url.includes("/materials/abc/preview?size=256&algo=LANCZOS")
      )
    ).toBe(true);
  });

  it("renders guidance text when validation fails before forge", async () => {
    render(<EditorPage />);

    const input = screen.getByLabelText("素材 ID") as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "   ");

    await userEvent.click(screen.getByText("Forge"));

    const errorBlock = await screen.findByTestId("api-error");
    expect(errorBlock).toHaveTextContent("请输入有效的素材 ID");
    expect(errorBlock).toHaveTextContent("请检查文件大小、格式或稍后重试");
  });
});
