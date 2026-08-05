import { upload as uploadApi, publico as publicoApi } from '../services/api';

export interface AnexoEnviado {
  url: string;
  nome: string;
  tipo: 'arquivo' | 'imagem';
}

export const ACCEPT_ANEXOS = 'image/png,image/jpeg,image/webp,application/pdf';
export const ACCEPT_CAMERA = 'image/*';

const EXT_PDF = /\.pdf$/i;
const MAX_DIMENSAO = 1600;
const LIMITE_SEM_COMPRESSAO = 1.5 * 1024 * 1024;

const TIPOS_ACEITOS_UPLOAD = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function prepararImagem(file: File, forcarConversao = false): Promise<File> {
  if (!forcarConversao && file.size <= LIMITE_SEM_COMPRESSAO) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const escala = Math.min(1, MAX_DIMENSAO / Math.max(bitmap.width, bitmap.height));
    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || (!forcarConversao && blob.size >= file.size)) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/**
 * Envia uma imagem para o servidor e devolve a URL. Substitui o antigo
 * `lerImagemComoBase64` — nada de data URL indo para o banco.
 */
export async function enviarImagem(file: File, pasta = 'fotos'): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Envie uma imagem (JPG, PNG ou WebP).');
  }
  const precisaConverter = !TIPOS_ACEITOS_UPLOAD.has(file.type);
  const imagem = await prepararImagem(file, precisaConverter);
  if (precisaConverter && !TIPOS_ACEITOS_UPLOAD.has(imagem.type)) {
    throw new Error('Formato não suportado. Use JPG, PNG ou WebP.');
  }
  const url = await uploadApi.image(imagem, pasta);
  if (!url) throw new Error(`Falha ao enviar "${file.name}"`);
  return url;
}

/** Mesma coisa, porém pelo endpoint público (links sem login). */
export async function enviarImagemPublica(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Envie uma imagem (JPG, PNG ou WebP).');
  }
  const precisaConverter = !TIPOS_ACEITOS_UPLOAD.has(file.type);
  const imagem = await prepararImagem(file, precisaConverter);
  if (precisaConverter && !TIPOS_ACEITOS_UPLOAD.has(imagem.type)) {
    throw new Error('Formato não suportado. Use JPG, PNG ou WebP.');
  }
  return publicoApi.uploadImagem(imagem);
}

export async function enviarAnexo(file: File): Promise<AnexoEnviado> {
  const arquivo = file.type === 'application/pdf' || EXT_PDF.test(file.name);
  if (arquivo) {
    const url = await uploadApi.document(file);
    if (!url) throw new Error(`Falha ao enviar "${file.name}"`);
    return { url, nome: file.name, tipo: 'arquivo' };
  }
  const imagem = await prepararImagem(file);
  const url = await uploadApi.image(imagem, 'fotos');
  if (!url) throw new Error(`Falha ao enviar "${file.name}"`);
  return { url, nome: file.name, tipo: 'imagem' };
}

export function ehAnexoArquivo(a: { tipo?: string | null; url: string }): boolean {
  return a.tipo === 'arquivo' || EXT_PDF.test(a.url);
}

export function urlAnexoSegura(url?: string | null): string {
  if (!url) return '#';
  return /^https?:\/\//i.test(url) || url.startsWith('/uploads/') ? url : '#';
}
