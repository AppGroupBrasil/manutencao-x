import { Router, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AuthRequest } from '../middleware/auth.js';
import { query, queryOne } from '../db/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOCUMENT_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;       // 5MB
const MAX_DOC_BYTES = 10 * 1024 * 1024;        // 10MB
const QUOTA_MAX_FILES_PER_DAY = Number.parseInt(process.env.UPLOAD_MAX_FILES_DAY || '200', 10);
const QUOTA_MAX_BYTES_PER_DAY = Number.parseInt(process.env.UPLOAD_MAX_BYTES_DAY || '524288000', 10); // 500MB

async function enforceQuota(userId: string, bytes: number): Promise<{ ok: boolean; reason?: string }> {
  await query(
    `INSERT INTO upload_quotas (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  await query(
    `UPDATE upload_quotas
        SET arquivos_dia = 0, bytes_dia = 0, janela_inicio = NOW()
      WHERE user_id = $1 AND janela_inicio < NOW() - INTERVAL '1 day'`,
    [userId]
  );
  const row = await queryOne<{ arquivos_dia: number; bytes_dia: string }>(
    `SELECT arquivos_dia, bytes_dia FROM upload_quotas WHERE user_id = $1`,
    [userId]
  );
  const arquivos = row?.arquivos_dia ?? 0;
  const usados = Number(row?.bytes_dia ?? 0);
  if (arquivos >= QUOTA_MAX_FILES_PER_DAY) return { ok: false, reason: 'Quota diária de arquivos excedida' };
  if (usados + bytes > QUOTA_MAX_BYTES_PER_DAY) return { ok: false, reason: 'Quota diária de bytes excedida' };
  await query(
    `UPDATE upload_quotas
        SET arquivos_dia = arquivos_dia + 1, bytes_dia = bytes_dia + $2
      WHERE user_id = $1`,
    [userId, bytes]
  );
  return { ok: true };
}

// Garantir que diretórios existam
['avatars', 'documentos', 'fotos', 'qrcodes'].forEach(dir => {
  const p = path.join(UPLOADS_DIR, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const storage = multer.memoryStorage();

const imageFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (IMAGE_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de imagem não permitido'));
  }
};

const documentFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (DOCUMENT_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de documento não permitido'));
  }
};

const imageUpload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

const documentUpload = multer({
  storage,
  fileFilter: documentFileFilter,
  limits: { fileSize: MAX_DOC_BYTES, files: 1 },
});

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

function bufferMatchesMimeType(buffer: Buffer, mimeType: string) {
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

const router = Router();

// POST /api/upload/image
router.post('/image', imageUpload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'Nenhum arquivo enviado' });
    return;
  }

  if (!bufferMatchesMimeType(req.file.buffer, req.file.mimetype)) {
    res.status(400).json({ error: 'Conteúdo do arquivo inválido para o tipo informado' });
    return;
  }

  const quota = await enforceQuota(req.user!.id, req.file.size);
  if (!quota.ok) { res.status(429).json({ error: quota.reason }); return; }

  const ALLOWED_FOLDERS = ['fotos', 'avatars', 'documentos', 'qrcodes'];
  let subfolder = (req.body.folder as string) || 'fotos';
  if (!ALLOWED_FOLDERS.includes(subfolder)) subfolder = 'fotos';
  const dir = path.join(UPLOADS_DIR, subfolder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const filepath = path.join(dir, filename);

  await sharp(req.file.buffer, { failOn: 'error', limitInputPixels: 24_000_000 })
    .rotate()
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(filepath);

  const url = `/uploads/${subfolder}/${filename}`;
  res.json({ url });
});

// POST /api/upload/avatar
router.post('/avatar', imageUpload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'Nenhum arquivo enviado' });
    return;
  }

  if (!bufferMatchesMimeType(req.file.buffer, req.file.mimetype)) {
    res.status(400).json({ error: 'Conteúdo do arquivo inválido para o tipo informado' });
    return;
  }

  const quota = await enforceQuota(req.user!.id, req.file.size);
  if (!quota.ok) { res.status(429).json({ error: quota.reason }); return; }

  const filename = `${req.user!.id}.webp`;
  const filepath = path.join(UPLOADS_DIR, 'avatars', filename);

  await sharp(req.file.buffer, { failOn: 'error', limitInputPixels: 24_000_000 })
    .rotate()
    .resize(200, 200, { fit: 'cover' })
    .webp({ quality: 80 })
    .toFile(filepath);

  const url = `/uploads/avatars/${filename}`;
  res.json({ url });
});

// POST /api/upload/document
router.post('/document', documentUpload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'Nenhum arquivo enviado' });
    return;
  }

  if (!bufferMatchesMimeType(req.file.buffer, req.file.mimetype)) {
    res.status(400).json({ error: 'Conteúdo do arquivo inválido para o tipo informado' });
    return;
  }

  const quota = await enforceQuota(req.user!.id, req.file.size);
  if (!quota.ok) { res.status(429).json({ error: quota.reason }); return; }

  const ALLOWED_EXTS: Record<string, string> = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
  const ext = ALLOWED_EXTS[req.file.mimetype] || '.pdf';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const filepath = path.join(UPLOADS_DIR, 'documentos', filename);

  await fs.promises.writeFile(filepath, req.file.buffer);

  const url = `/uploads/documentos/${filename}`;
  res.json({ url });
});

export default router;
