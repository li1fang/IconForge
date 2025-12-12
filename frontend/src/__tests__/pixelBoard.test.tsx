import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PixelBoard } from "@/components/PixelBoard";
import { pixelsToPngBlob } from "@/lib/pixel-export";

describe("PixelBoard interactions", () => {
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalGetBoundingClientRect = HTMLCanvasElement.prototype.getBoundingClientRect;
  const mockRect: DOMRect = {
    width: 256,
    height: 256,
    top: 0,
    left: 0,
    bottom: 256,
    right: 256,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;

  beforeEach(() => {
    HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => {
      callback(new Blob(["png"], { type: "image/png" }));
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      fillStyle: "",
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue(
      mockRect
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it("exports pixels to png blob", async () => {
    const pixels = Array(16 * 16).fill("");
    pixels[0] = "#ffffff";
    const blob = await pixelsToPngBlob(pixels);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
  });

  it("paints pixels with drag", async () => {
    render(<PixelBoard />);
    const canvas = screen.getByTestId("pixel-canvas") as HTMLCanvasElement;

    await userEvent.pointer([
      { target: canvas, coords: { x: 10, y: 10 }, pointerName: "mouse", keys: "[MouseLeft]" },
      { target: canvas, coords: { x: 20, y: 10 }, pointerName: "mouse", keys: "[MouseLeft]" },
      { target: canvas, coords: { x: 20, y: 10 }, pointerName: "mouse" },
    ]);

    await waitFor(() =>
      expect(screen.getByText(/最后上色/).textContent).toContain("#ff4d4f")
    );
  });

  it("erases after painting", async () => {
    render(<PixelBoard />);
    const canvas = screen.getByTestId("pixel-canvas") as HTMLCanvasElement;

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(canvas);

    fireEvent.click(screen.getByText("橡皮擦"));
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(canvas);

    await waitFor(() =>
      expect(screen.getByText(/最后上色/).textContent).toContain("blank")
    );
  });

  it("updates colored count when painting multiple pixels", async () => {
    render(<PixelBoard />);
    const canvas = screen.getByTestId("pixel-canvas") as HTMLCanvasElement;

    await userEvent.pointer([
      { target: canvas, coords: { x: 10, y: 10 }, pointerName: "mouse", keys: "[MouseLeft]" },
      { target: canvas, coords: { x: 20, y: 10 }, pointerName: "mouse", keys: "[MouseLeft]" },
      { target: canvas, coords: { x: 20, y: 10 }, pointerName: "mouse" },
    ]);

    await waitFor(() =>
      expect(screen.getByText(/最后上色/).textContent).toContain("#ff4d4f")
    );
    await waitFor(() => {
      const colored = Number(screen.getByTestId("pixel-state").textContent ?? "0");
      expect(colored).toBeGreaterThan(0);
    });
  });

  it("picks color from reference canvas and switches back to brush", async () => {
    render(<PixelBoard />);

    const referenceCanvas = screen.getByRole("presentation") as HTMLCanvasElement;

    await userEvent.click(screen.getByText("橡皮擦"));

    await userEvent.pointer([
      { target: referenceCanvas, coords: { x: 2, y: 2 }, pointerName: "mouse", keys: "[MouseLeft]" },
    ]);

    await waitFor(() => {
      expect(screen.getByTestId("color-picker")).toHaveValue("#0f172a");
      expect(screen.getByText(/工具：/).textContent).toContain("画笔");
    });
  });
});
