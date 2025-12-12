import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PixelBoard, pixelsToPngBlob } from "@/components/PixelBoard";

describe("PixelBoard interactions", () => {
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => {
      callback(new Blob(["png"], { type: "image/png" }));
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      fillStyle: "",
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
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
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      width: 256,
      height: 256,
      top: 0,
      left: 0,
      bottom: 256,
      right: 256,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 10 });
    fireEvent.pointerUp(canvas);

    await waitFor(() =>
      expect(screen.getByText(/最后上色/).textContent).toContain("#ff4d4f")
    );
  });

  it("erases after painting", async () => {
    render(<PixelBoard />);
    const canvas = screen.getByTestId("pixel-canvas") as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      width: 256,
      height: 256,
      top: 0,
      left: 0,
      bottom: 256,
      right: 256,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(canvas);

    fireEvent.click(screen.getByText("橡皮擦"));
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(canvas);

    await waitFor(() =>
      expect(screen.getByText(/最后上色/).textContent).toContain("blank")
    );
  });
});
