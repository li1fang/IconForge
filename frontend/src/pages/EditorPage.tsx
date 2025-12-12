import { useCallback, useState } from "react";
import { AlertTriangle, Upload } from "lucide-react";

import { PixelBoard } from "@/components/PixelBoard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchMaterial, fetchPreview } from "@/api/client";

export function EditorPage() {
  const [materialId, setMaterialId] = useState("demo-id");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = useCallback(async () => {
    setError(null);
    setMessage(null);
    try {
      const material = await fetchMaterial(materialId);
      const preview = await fetchPreview(material.material_id, { size: 32, algo: "LANCZOS" });
      setMessage(`已获取素材 ${material.material_id}, 预览长度 ${preview.image_base64.length}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "未知错误";
      setError(reason);
    }
  }, [materialId]);

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
          <div className="flex items-center gap-2">
            <Button onClick={handlePreview} className="gap-2">
              <Upload className="h-4 w-4" />
              请求预览
            </Button>
            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                data-testid="api-error"
              >
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary" data-testid="api-success">
                {message}
              </div>
            )}
          </div>
        </div>
      </section>

      <PixelBoard />
    </div>
  );
}
