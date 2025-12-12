import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Eraser, Paintbrush2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pixelsToPngBlob } from "@/lib/pixel-export";
import { useEditorStore } from "@/lib/use-editor-store";

const BOARD_SIZE = 16;
const DISPLAY_SCALE = 16;
const PREVIEW_SCALE = 8;

function drawPixels(
  canvas: HTMLCanvasElement | null,
  pixels: string[],
  scale: number
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = BOARD_SIZE;
  canvas.height = BOARD_SIZE;
  ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);

  pixels.forEach((color, index) => {
    if (!color) return;
    const x = index % BOARD_SIZE;
    const y = Math.floor(index / BOARD_SIZE);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  });

  canvas.style.width = `${BOARD_SIZE * scale}px`;
  canvas.style.height = `${BOARD_SIZE * scale}px`;
  canvas.style.imageRendering = "pixelated";
  canvas.style.border = "1px solid hsl(var(--border))";
}

function createReferencePixels() {
  const palette = ["#0f172a", "#1e293b", "#334155", "#475569", "#eab308", "#f97316"];
  const pixels: string[] = Array(BOARD_SIZE * BOARD_SIZE).fill("");
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const idx = y * BOARD_SIZE + x;
      const stripe = Math.floor((x + y) % palette.length);
      pixels[idx] = palette[stripe];
    }
  }
  return pixels;
}

interface PixelBoardProps {
  onPixelsChange?: (pixels: string[]) => void;
}

export interface PixelBoardHandle {
  exportPngBlob: () => Promise<Blob>;
  getPixels: () => string[];
}

export const PixelBoard = forwardRef<PixelBoardHandle, PixelBoardProps>(function PixelBoard(
  { onPixelsChange }: PixelBoardProps,
  ref
) {
  const pixelData = useEditorStore((state) => state.pixelData);
  const setPixelData = useEditorStore((state) => state.setPixelData);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [brushColor, setBrushColor] = useState("#ff4d4f");
  const [activePixel, setActivePixel] = useState<string>("blank");
  const [coloredCount, setColoredCount] = useState(0);
  const drawing = useRef(false);

  const boardCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const referenceCanvasRef = useRef<HTMLCanvasElement>(null);

  const referencePixels = useMemo(createReferencePixels, []);

  const renderAll = useMemo(
    () =>
      (nextPixels: string[]) => {
        drawPixels(boardCanvasRef.current, nextPixels, DISPLAY_SCALE);
        drawPixels(previewCanvasRef.current, nextPixels, PREVIEW_SCALE);
        drawPixels(referenceCanvasRef.current, referencePixels, PREVIEW_SCALE);
      },
    [referencePixels]
  );

  useEffect(() => {
    renderAll(pixelData);
    onPixelsChange?.(pixelData);
  }, [pixelData, onPixelsChange, renderAll]);

  useEffect(() => {
    setColoredCount(pixelData.filter(Boolean).length);
  }, [pixelData]);

  useImperativeHandle(
    ref,
    () => ({
      exportPngBlob: () => pixelsToPngBlob(pixelData),
      getPixels: () => [...pixelData],
    }),
    [pixelData]
  );

  const updatePixel = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / BOARD_SIZE;
    const scaleY = rect.height / BOARD_SIZE;
    const x = Math.floor((clientX - rect.left) / scaleX);
    const y = Math.floor((clientY - rect.top) / scaleY);
    if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) return;

    setPixelData((prev) => {
      const next = [...prev];
      const idx = y * BOARD_SIZE + x;
      next[idx] = tool === "brush" ? brushColor : "";
      setActivePixel(next[idx] || "blank");
      return next;
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = boardCanvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    updatePixel(event.clientX, event.clientY, canvas);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = boardCanvasRef.current;
    if (!canvas) return;
    updatePixel(event.clientX, event.clientY, canvas);
  };

  const stopDrawing = () => {
    drawing.current = false;
  };

  const handlePickFromReference = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = referenceCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / BOARD_SIZE;
    const scaleY = rect.height / BOARD_SIZE;
    const x = Math.floor((event.clientX - rect.left) / scaleX);
    const y = Math.floor((event.clientY - rect.top) / scaleY);
    const idx = y * BOARD_SIZE + x;
    const picked = referencePixels[idx];
    setBrushColor(picked);
    setTool("brush");
  };

  return (
    <div className="grid gap-6 md:grid-cols-[160px_minmax(0,1fr)_200px]">
      <section className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-muted-foreground">参考预览</h3>
        <canvas
          ref={referenceCanvasRef}
          className="canvas-outline"
          onPointerDown={handlePickFromReference}
          role="presentation"
        />
        <p className="text-xs text-muted-foreground">
          点击拾色器，自动切换为画笔。
        </p>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant={tool === "brush" ? "default" : "secondary"}
              size="sm"
              onClick={() => setTool("brush")}
            >
              <Paintbrush2 className="mr-2 h-4 w-4" /> 画笔
            </Button>
            <Button
              variant={tool === "eraser" ? "default" : "secondary"}
              size="sm"
              onClick={() => setTool("eraser")}
            >
              <Eraser className="mr-2 h-4 w-4" /> 橡皮擦
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Input
              data-testid="color-picker"
              type="color"
              value={brushColor}
              onChange={(e) => {
                setBrushColor(e.target.value);
                setTool("brush");
              }}
              className="h-10 w-16 cursor-pointer border"
              title="选择画笔颜色"
            />
            <span className="text-xs text-muted-foreground">当前颜色</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setPixelData(() => {
                const empty = Array(BOARD_SIZE * BOARD_SIZE).fill("");
                setColoredCount(0);
                return empty;
              })
            }
          >
            清空
          </Button>
        </div>

        <div className="flex justify-center">
          <canvas
            data-testid="pixel-canvas"
            ref={boardCanvasRef}
            className="canvas-outline bg-white"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrawing}
            onPointerLeave={stopDrawing}
            role="img"
            aria-label="16x16 画板"
          />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-muted-foreground">1:1 预览</h3>
        <canvas ref={previewCanvasRef} className="canvas-outline bg-white" />
        <div className="text-xs text-muted-foreground">
          <div>工具：{tool === "brush" ? "画笔" : "橡皮擦"}</div>
          <div>最后上色：{activePixel}</div>
        </div>
      </section>
      <div data-testid="pixel-state" className="sr-only">
        {coloredCount}
      </div>
    </div>
  );
}

);
