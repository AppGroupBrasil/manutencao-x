/**
 * Converte imagens/PDFs gravados como data URL (base64) nas tabelas para
 * arquivos em /uploads, trocando o conteúdo pela URL.
 *
 * Uso (dentro do container da API):
 *   node dist/scripts/migrarBase64.js --dry-run   → só relata o que existe
 *   node dist/scripts/migrarBase64.js             → converte
 *
 * É idempotente: só mexe em strings que começam com "data:".
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import pool, { query, queryOne, execute } from '../db/database.js';
import { UPLOADS_DIR, salvarImagemWebp } from '../services/imagens.js';

type Tipo = 'texto' | 'array' | 'jsonb';
interface Alvo { tabela: string; coluna: string; tipo: Tipo; }

const ALVOS: Alvo[] = [
  { tabela: 'vencimentos', coluna: 'imagens', tipo: 'array' },
  { tabela: 'vencimentos', coluna: 'avisos', tipo: 'jsonb' },
  { tabela: 'checklists', coluna: 'itens', tipo: 'jsonb' },
  { tabela: 'checklists', coluna: 'assinatura', tipo: 'texto' },
  { tabela: 'vistorias', coluna: 'itens', tipo: 'jsonb' },
  { tabela: 'roteiros', coluna: 'passos', tipo: 'jsonb' },
  { tabela: 'roteiros_execucoes_log', coluna: 'passos_exec', tipo: 'jsonb' },
  { tabela: 'reportes', coluna: 'imagens', tipo: 'array' },
  { tabela: 'materiais_movimentacoes', coluna: 'fotos', tipo: 'array' },
  { tabela: 'materiais_movimentacoes', coluna: 'nota_fiscal_url', tipo: 'texto' },
  { tabela: 'tarefas_execucoes', coluna: 'fotos', tipo: 'array' },
  { tabela: 'inspecoes', coluna: 'fotos', tipo: 'array' },
  { tabela: 'inspecoes', coluna: 'itens_verificados', tipo: 'jsonb' },
  { tabela: 'planos_execucoes', coluna: 'fotos', tipo: 'array' },
  { tabela: 'equipamentos', coluna: 'foto_url', tipo: 'texto' },
  { tabela: 'equipamentos_historico', coluna: 'fotos', tipo: 'array' },
  { tabela: 'solicitacoes_morador', coluna: 'fotos', tipo: 'array' },
  { tabela: 'registros_antes_depois', coluna: 'foto_antes', tipo: 'texto' },
  { tabela: 'registros_antes_depois', coluna: 'foto_depois', tipo: 'texto' },
  { tabela: 'respostas_qrcode', coluna: 'respostas', tipo: 'jsonb' },
  { tabela: 'qrcodes', coluna: 'logo', tipo: 'texto' },
  { tabela: 'condominios', coluna: 'logo_url', tipo: 'texto' },
  { tabela: 'tema_config', coluna: 'logo_url', tipo: 'texto' },
  { tabela: 'orcamentos', coluna: 'logo_url', tipo: 'texto' },
  { tabela: 'comunicados', coluna: 'pdf_anexo', tipo: 'texto' },
  { tabela: 'ordens_servico', coluna: 'fotos', tipo: 'array' },
];

const DATA_URL = /^data:([\w/+.-]+);base64,/i;
const dryRun = process.argv.includes('--dry-run');

let convertidos = 0;
let falhas = 0;

async function colunaExiste(tabela: string, coluna: string): Promise<boolean> {
  const row = await queryOne(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tabela, coluna]
  );
  return !!row;
}

async function salvarPdf(buffer: Buffer): Promise<string> {
  const dir = path.join(UPLOADS_DIR, 'documentos');
  await fs.mkdir(dir, { recursive: true });
  const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  await fs.writeFile(path.join(dir, nome), buffer);
  return `/uploads/documentos/${nome}`;
}

/** Converte uma data URL em arquivo e devolve a URL; devolve null se não der. */
async function converterDataUrl(valor: string): Promise<string | null> {
  const match = DATA_URL.exec(valor);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const base64 = valor.slice(match[0].length);
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    return null;
  }
  if (buffer.length === 0) return null;
  if (dryRun) { convertidos++; return valor; }
  try {
    const url = mime === 'application/pdf'
      ? await salvarPdf(buffer)
      : await salvarImagemWebp(buffer);
    convertidos++;
    return url;
  } catch (err: any) {
    falhas++;
    console.warn(`  ! falha ao converter (${mime}, ${buffer.length}B): ${err?.message}`);
    return null;
  }
}

/** Percorre qualquer estrutura trocando data URLs por URLs de arquivo. */
async function converterProfundo(valor: unknown): Promise<unknown> {
  if (typeof valor === 'string') {
    if (!valor.startsWith('data:')) return valor;
    return (await converterDataUrl(valor)) ?? valor;
  }
  if (Array.isArray(valor)) {
    const saida = [];
    for (const item of valor) saida.push(await converterProfundo(item));
    return saida;
  }
  if (valor && typeof valor === 'object') {
    const saida: Record<string, unknown> = {};
    for (const [chave, item] of Object.entries(valor)) saida[chave] = await converterProfundo(item);
    return saida;
  }
  return valor;
}

async function processarAlvo(alvo: Alvo) {
  if (!(await colunaExiste(alvo.tabela, alvo.coluna))) {
    console.log(`- ${alvo.tabela}.${alvo.coluna}: coluna não existe, pulando`);
    return;
  }
  const filtro = alvo.tipo === 'array'
    ? `array_to_string(${alvo.coluna}, ',') LIKE '%data:%'`
    : `${alvo.coluna}::text LIKE '%data:%'`;

  // Só os ids primeiro: carregar todas as linhas de uma vez traria os base64
  // inteiros para a memória (pode ser GB numa base grande).
  const ids = await query<{ id: string }>(
    `SELECT id::text AS id FROM ${alvo.tabela}
      WHERE ${alvo.coluna} IS NOT NULL AND ${filtro}`
  );
  if (ids.length === 0) {
    console.log(`- ${alvo.tabela}.${alvo.coluna}: nada a converter`);
    return;
  }
  console.log(`- ${alvo.tabela}.${alvo.coluna}: ${ids.length} linha(s) com base64`);

  for (const { id } of ids) {
    try {
      const linha = await queryOne<{ valor: unknown }>(
        `SELECT ${alvo.coluna} AS valor FROM ${alvo.tabela} WHERE id::text = $1`, [id]
      );
      if (!linha) continue;
      const convertido = await converterProfundo(linha.valor);
      if (dryRun) continue;
      if (alvo.tipo === 'jsonb') {
        await execute(
          `UPDATE ${alvo.tabela} SET ${alvo.coluna} = $1::jsonb WHERE id::text = $2`,
          [JSON.stringify(convertido), id]
        );
      } else if (alvo.tipo === 'array') {
        await execute(
          `UPDATE ${alvo.tabela} SET ${alvo.coluna} = $1::text[] WHERE id::text = $2`,
          [convertido as string[], id]
        );
      } else {
        await execute(
          `UPDATE ${alvo.tabela} SET ${alvo.coluna} = $1 WHERE id::text = $2`,
          [convertido as string, id]
        );
      }
    } catch (err: any) {
      falhas++;
      console.warn(`  ! ${alvo.tabela} ${id}: ${err?.message}`);
    }
  }
}

async function main() {
  console.log(dryRun ? '[base64] Modo dry-run (nada será alterado)' : '[base64] Convertendo base64 para arquivos...');
  for (const alvo of ALVOS) {
    await processarAlvo(alvo).catch(err => console.warn(`  ! ${alvo.tabela}.${alvo.coluna}: ${err?.message}`));
  }
  console.log(`[base64] Concluído. ${convertidos} valor(es) ${dryRun ? 'encontrados' : 'convertidos'}, ${falhas} falha(s).`);
  await pool.end();
}

main().catch(err => {
  console.error('[base64] Erro fatal:', err);
  process.exit(1);
});
