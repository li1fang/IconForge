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
});
