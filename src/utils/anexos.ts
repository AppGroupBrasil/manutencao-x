import { upload as uploadApi } from '../services/api';

export interface AnexoEnviado {
  url: string;
  nome: string;
  tipo: 'arquivo' | 'imagem';
}

export const ACCEPT_ANEXOS = 'image/png,image/jpeg,image/webp,application/pdf';

const EXT_PDF = /\.pdf$/i;

export async function enviarAnexo(file: File): Promise<AnexoEnviado> {
  const arquivo = file.type === 'application/pdf' || EXT_PDF.test(file.name);
  const url = arquivo ? await uploadApi.document(file) : await uploadApi.image(file, 'fotos');
  if (!url) throw new Error(`Falha ao enviar "${file.name}"`);
  return { url, nome: file.name, tipo: arquivo ? 'arquivo' : 'imagem' };
}

export function ehAnexoArquivo(a: { tipo?: string | null; url: string }): boolean {
  return a.tipo === 'arquivo' || EXT_PDF.test(a.url);
}

export function urlAnexoSegura(url?: string | null): string {
  if (!url) return '#';
  return /^https?:\/\//i.test(url) || url.startsWith('/uploads/') ? url : '#';
}
