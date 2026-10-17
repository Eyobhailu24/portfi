export async function optimizeUpload(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG, or WebP image.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Choose an image smaller than 12 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing isn't available in this browser.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const data = canvas.toDataURL("image/webp", 0.82);
  if (data.length > 1_500_000) throw new Error("This image is still too large. Try a smaller image.");
  return data;
}

export function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("The file could not be read.")); reader.readAsDataURL(file); });
}
