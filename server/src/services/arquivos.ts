import path from 'node:path';
import fs from 'node:fs/promises';
import { UPLOADS_DIR } from './imagens.js';

const CAMINHO_UPLOAD = /^\/uploads\/([a-z]+)\/([\w.-]+)$/;

/**
 * Apaga o arquivo físico de um anexo. Só aceita caminhos servidos pela própria
 * aplicação (`/uploads/<pasta>/<arquivo>`); URL externa, data URL ou caminho
 * fora da pasta de uploads é ignorado em silêncio.
 */
export async function removerArquivoUpload(url?: string | null): Promise<void> {
  if (!url) return;
  const match = CAMINHO_UPLOAD.exec(url);
  if (!match) return;
  const [, pasta, arquivo] = match;
  if (arquivo === '.' || arquivo === '..') return;

  const destino = path.resolve(UPLOADS_DIR, pasta, arquivo);
  const raiz = path.resolve(UPLOADS_DIR) + path.sep;
  if (!destino.startsWith(raiz)) return;

  try {
    await fs.unlink(destino);
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      console.warn(`[Arquivos] Não foi possível apagar ${url}: ${err?.message}`);
    }
  }
}

export async function removerArquivosUpload(urls: Array<string | null | undefined>): Promise<void> {
  for (const url of urls) await removerArquivoUpload(url);
}

/** Extrai as URLs de anexos guardadas dentro dos itens de um checklist (JSONB). */
export function urlsDosItensChecklist(itens: unknown): string[] {
  if (!Array.isArray(itens)) return [];
  const urls: string[] = [];
  for (const item of itens) {
    const foto = (item as any)?.foto;
    if (typeof foto === 'string') urls.push(foto);
    const anexos = (item as any)?.anexos;
    if (Array.isArray(anexos)) {
      for (const anexo of anexos) {
        const url = typeof anexo === 'string' ? anexo : (anexo as any)?.url;
        if (typeof url === 'string') urls.push(url);
      }
    }
  }
  return urls;
}
