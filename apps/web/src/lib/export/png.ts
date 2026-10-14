/* PNG export: rasterise a serialised SVG through a canvas at 2x. */

import { svgBlob, type SerializedSvg } from "./svg";

export async function svgToPngBlob(s: SerializedSvg, scale = 2, background = "#ffffff"): Promise<Blob> {
  const url = URL.createObjectURL(svgBlob(s));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not load the SVG for PNG export"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(s.width * scale));
    canvas.height = Math.max(1, Math.round(s.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
