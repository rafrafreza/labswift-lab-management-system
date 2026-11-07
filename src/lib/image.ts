/**
 * Re-encodes an uploaded logo / signature as a plain 8-bit PNG or JPEG, at most `maxSide` pixels on the longest side.
 *
 * The PDF engine only understands the simple variants of PNG/JPEG: 16-bit, interlaced, palette-with-alpha, CMYK or
 * oddly-profiled files can make an image silently vanish from the PDF (or fail the whole download). Passing every upload
 * through a canvas guarantees a format it can read, and keeps the file small.
 */
export async function normalizeImageForPdf(file: File, maxSide = 800): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file couldn't be read as an image. Please upload a PNG or JPG.");
  }

  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image processing isn't available in this browser.");

    const isPng = file.type === "image/png";
    if (!isPng) {
      ctx.fillStyle = "#ffffff"; // JPEG has no transparency
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    const type = isPng ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
    if (!blob) throw new Error("Couldn't process the image. Try a different file.");
    return new File([blob], file.name, { type });
  } finally {
    bitmap.close();
  }
}
