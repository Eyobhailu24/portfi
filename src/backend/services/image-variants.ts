import sharp from "sharp";
import { HTTPException } from "hono/http-exception";

export async function imageVariants(buffer: Buffer) {
  try {
    return await Promise.all([640, 960].map(async (width) => ({ width, buffer: await sharp(buffer, { limitInputPixels: 20_000_000, failOn: "error" }).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer() })));
  } catch { throw new HTTPException(400, { message: "This image could not be decoded safely. Choose another JPG, PNG, or WebP image." }); }
}
