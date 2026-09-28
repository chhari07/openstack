"use client";

// Lets the user pick a photo and turns it into a small square JPEG data URL
// (profile photo, playlist cover). Small enough to store and sync as text.
export function pickImage(size = 512): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await squareJpeg(file, size).catch(() => null) : null);
    };
    // Picker closed without a choice.
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

export async function squareJpeg(file: Blob, size = 512): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(size, side);
  const ctx = canvas.getContext("2d")!;
  // Centre crop to a square.
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}
