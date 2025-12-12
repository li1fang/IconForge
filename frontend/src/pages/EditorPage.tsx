import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { AlertTriangle, Images, Upload } from "lucide-react";

import { PixelBoard, type PixelBoardHandle } from "@/components/PixelBoard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ApiError,
  fetchMaterial,
  fetchPreview,
  forgeIcon,
  uploadMaterial,
} from "@/api/client";
import { useEditorStore } from "@/lib/use-editor-store";

export function EditorPage() {
  const { materialId, setMaterialId, algo, setAlgo, previews, setPreviews } = useEditorStore();
  const [materialImage, setMaterialImage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [forging, setForging] = useState(false);
  const [referencePreview, setReferencePreview] = useState<string | null>(() =>
    previews[16] ? `data:image/png;base64,${previews[16]}` : null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pixelBoardRef = useRef<PixelBoardHandle | null>(null);

  useEffect(() => {
    if (previews[16]) {
      setReferencePreview(`data:image/png;base64,${previews[16]}`);
    }
  }, [previews]);

  const handleUpload = useCallback(
    async (file?: File | null) => {
      if (!file) return;
      setUploading(true);
      setError(null);
      setMessage(null);
      setPreviews({});
      setReferencePreview(null);
      try {
        const material = await uploadMaterial(file);
        setMaterialId(material.material_id);
        setMaterialImage(material.image_base64);
        setMessage(`素材上传成功，ID: ${material.material_id}`);
      } catch (err) {
        const reason = err instanceof Error ? err.message : "未知错误";
        setError(reason);
      } finally {
        setUploading(false);
      }
    },
    [setMaterialId, setPreviews]
  );

  const handlePreview = useCallback(async () => {
    setError(null);
    setMessage(null);
    try {
      const material = await fetchMaterial(materialId.trim());
      setMaterialImage(material.image_base64);
      const sizes = [256, 48, 32];
      const previewEntries = await Promise.all(
        sizes.map(async (size) => {
          const preview = await fetchPreview(material.material_id, { size, algo });
          return [size, preview.image_base64] as const;
        })
      );
      const tinyPreview = await fetchPreview(material.material_id, {
        algo,
        size: 16,
        targetSize: 16,
        fallbackSizes: [32, 48],
      });
      previewEntries.push([16, tinyPreview.image_base64]);
      setReferencePreview(`data:image/png;base64,${tinyPreview.image_base64}`);
      setPreviews(Object.fromEntries(previewEntries));
      setMessage(`已获取素材 ${material.material_id}，算法 ${algo}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "未知错误";
      setError(reason);
    }
  }, [algo, materialId, setPreviews]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    void handleUpload(file);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    void handleUpload(file);
  };

  const onDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => {
    setDragActive(false);
  };

  const handleForge = useCallback(async () => {
    const trimmedId = materialId.trim();
    if (!trimmedId) {
      setError("请输入有效的素材 ID");
      return;
    }

    setError(null);
    setMessage(null);
    const board = pixelBoardRef.current;
    if (!board) {
      setError("画板尚未加载完成，请稍后重试。");
      return;
    }

    setForging(true);
    try {
      const tinyIcon = await board.exportPngBlob();
      const icoBlob = await forgeIcon(trimmedId, algo, tinyIcon);
      const link = document.createElement("a");
      const blobUrl = URL.createObjectURL(icoBlob);
      link.href = blobUrl;
      link.download = `${trimmedId}.ico`;
      link.click();
      URL.revokeObjectURL(blobUrl);
      setMessage("Forge 成功，已开始下载 ICO 文件。");
    } catch (err) {
      let reason = err instanceof Error ? err.message : "未知错误";
      if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
        reason = `${reason}，素材可能已过期，请重新上传或刷新后重试。`;
      }
      setError(reason);
    } finally {
      setForging(false);
    }
  }, [algo, materialId]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Label htmlFor="material-id">素材 ID</Label>
            <Input
              id="material-id"
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              placeholder="输入 /materials/{id}"
              className="w-64"
            />
          </div>
          <Button onClick={handlePreview} className="gap-2">
            <Upload className="h-4 w-4" />
            请求预览
          </Button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[2fr,1fr] md:items-center">
          <div className="space-y-2">
            <Label>上传素材</Label>
            <input
              ref={fileInputRef}
              id="material-file"
              type="file"
              accept="image/*,image/x-icon"
              className="hidden"
              onChange={onFileChange}
            />
            <label
              htmlFor="material-file"
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition hover:border-primary ${dragActive ? "border-primary/80 bg-primary/5" : "border-border"}`}
            >
              <Upload className="mb-3 h-8 w-8 text-primary" />
              <div className="text-sm text-muted-foreground">拖拽 PNG/ICO 到此处，或点击选择文件</div>
              <div className="text-xs text-muted-foreground">大小限制与格式校验将由服务端返回</div>
              <Button
                type="button"
                variant="secondary"
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "上传中..." : "选择文件"}
              </Button>
            </label>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="algo">算法选择</Label>
              <select
                id="algo"
                value={algo}
                onChange={(event) => setAlgo(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="LANCZOS">LANCZOS（高清）</option>
                <option value="BILINEAR">BILINEAR（柔和）</option>
                <option value="NEAREST">NEAREST（像素风）</option>
              </select>
            </div>
            <Button onClick={handleForge} disabled={forging} className="w-full">
              {forging ? "Forge 中..." : "Forge"}
            </Button>
            {message && (
              <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary" data-testid="api-success">
                {message}
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                data-testid="api-error"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div className="space-y-1">
                  <div>{error}</div>
                  <div className="text-xs text-muted-foreground">请检查文件大小、格式或稍后重试。</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Images className="h-4 w-4" />
          使用真实素材 ID 获取预览，支持 256px 与 32/48 像素级对比。
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>原始素材</Label>
            <div className="flex h-[280px] items-center justify-center rounded-md border bg-muted/40 p-3">
              {materialImage ? (
                <img
                  src={`data:image/png;base64,${materialImage}`}
                  alt="已上传素材"
                  className="max-h-full max-w-full rounded"
                />
              ) : (
                <div className="text-sm text-muted-foreground">等待上传或查询素材</div>
              )}
            </div>
          </div>
          {[256, 48, 32].map((size) => (
            <div key={size} className="space-y-2">
              <Label>{size}px 预览（{algo}）</Label>
              <div className="flex h-[280px] items-center justify-center rounded-md border bg-muted/40 p-3">
                {previews[size] ? (
                  <img
                    src={`data:image/png;base64,${previews[size]}`}
                    alt={`${size}px preview`}
                    style={{ width: `${size}px`, height: `${size}px`, imageRendering: size <= 48 ? "pixelated" : "auto" }}
                    className="rounded"
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">点击“请求预览”以生成 {size}px 图</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <PixelBoard ref={pixelBoardRef} referenceDataUrl={referencePreview} />
    </div>
  );
}
