const DEFAULT_BOARD_SIZE = 16;

export async function pixelsToPngBlob(
  pixels: string[],
  size: number = DEFAULT_BOARD_SIZE
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法创建画布上下文，导出 PNG 失败");
  }

  pixels.forEach((color, index) => {
    if (!color) return;
    const x = index % size;
    const y = Math.floor(index / size);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("无法生成 PNG Blob"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

