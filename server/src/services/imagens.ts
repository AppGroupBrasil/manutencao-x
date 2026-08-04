import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
export const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const DOCUMENT_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

function hasPdfSignature(buffer: Buffer) {
  return buffer.subarray(0, 5).toString() === '%PDF-';
}

function hasJpegSignature(buffer: Buffer) {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function hasPngSignature(buffer: Buffer) {
  return buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a;
}

function hasWebpSignature(buffer: Buffer) {
  return buffer.length >= 12
    && buffer.subarray(0, 4).toString() === 'RIFF'
    && buffer.subarray(8, 12).toString() === 'WEBP';
}

export function detectarTipoReal(buffer: Buffer): string | null {
  if (hasPdfSignature(buffer)) return 'application/pdf';
  if (hasJpegSignature(buffer)) return 'image/jpeg';
  if (hasPngSignature(buffer)) return 'image/png';
  if (hasWebpSignature(buffer)) return 'image/webp';
  return null;
}

export function bufferMatchesMimeType(buffer: Buffer, mimeType: string) {
  switch (mimeType) {
    case 'application/pdf':
      return hasPdfSignature(buffer);
    case 'image/jpeg':
      return hasJpegSignature(buffer);
    case 'image/png':
      return hasPngSignature(buffer);
    case 'image/webp':
      return hasWebpSignature(buffer);
    default:
      return false;
  }
}

export async function salvarImagemWebp(
  buffer: Buffer,
  subfolder = 'fotos',
  dimensao = 1200
): Promise<string> {
  const dir = path.join(UPLOADS_DIR, subfolder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  await sharp(buffer, { failOn: 'error', limitInputPixels: 24_000_000 })
    .rotate()
    .resize(dimensao, dimensao, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(dir, filename));
  return `/uploads/${subfolder}/${filename}`;
}
