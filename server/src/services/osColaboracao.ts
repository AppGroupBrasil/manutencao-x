import { query, queryOne, execute, transaction } from '../db/database.js';
import { createNotification } from '../middleware/helpers.js';
import { sendPush } from './push.js';

export interface AutorOS {
  id?: string | null;
  nome: string;
  origem: 'painel' | 'publico';
}

export interface ResponsavelEntrada {
  usuarioId?: string | null;
  nome?: string | null;
}

export type TipoHistorico = 'descricao' | 'edicao' | 'responsaveis' | 'fotos' | 'status';

export async function registrarHistorico(
  osId: string,
  tipo: TipoHistorico,
  texto: string | null,
  dados: Record<string, unknown>,
  autor: AutorOS
): Promise<void> {
  await execute(
    `INSERT INTO os_historico (os_id, tipo, texto, dados, autor_id, autor_nome, origem)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)`,
    [osId, tipo, texto, JSON.stringify(dados ?? {}), autor.id ?? null, autor.nome, autor.origem]
  );
}

export async function listarResponsaveis(osId: string) {
  return query(
    `SELECT r.id, r.usuario_id, r.nome, r.papel, r.definido_por_nome, r.criado_em, u.role, u.avatar_url
       FROM os_responsaveis r
       LEFT JOIN usuarios u ON u.id = r.usuario_id
      WHERE r.os_id = $1
      ORDER BY r.criado_em`,
    [osId]
  );
}

export async function listarFotos(osId: string) {
  return query(
    `SELECT id, url, legenda, nome, tipo, fase, autor_id, autor_nome, origem, criado_em
       FROM os_fotos WHERE os_id = $1 ORDER BY criado_em`,
    [osId]
  );
}

export async function listarHistorico(osId: string, limite = 200) {
  return query(
    `SELECT id, tipo, texto, dados, autor_id, autor_nome, origem, criado_em
       FROM os_historico WHERE os_id = $1 ORDER BY criado_em DESC LIMIT $2`,
    [osId, limite]
  );
}

export async function listarCandidatos(condominioId: string) {
  const usuarios = await query(
    `SELECT u.id, u.nome, u.role, u.cargo, 'usuario' AS tipo
       FROM usuarios u
      WHERE u.ativo = true AND u.bloqueado = false AND u.role <> 'master'
        AND (
          u.condominio_id = $1
          OR u.id = (SELECT criado_por FROM condominios WHERE id = $1)
          OR u.administrador_id = (SELECT criado_por FROM condominios WHERE id = $1)
          OR (u.condominio_id IS NULL AND u.administrador_id IS NULL AND u.role = 'funcionario'
              AND u.criado_por = (SELECT criado_por FROM condominios WHERE id = $1))
        )
      ORDER BY CASE u.role WHEN 'administrador' THEN 1 WHEN 'supervisor' THEN 2 ELSE 3 END, u.nome`,
    [condominioId]
  );
  const cond = await queryOne<{ sindico: string | null }>(
    'SELECT sindico FROM condominios WHERE id = $1',
    [condominioId]
  );
  const sindico = (cond?.sindico || '').trim();
  const jaListado = sindico
    ? usuarios.some((u: any) => String(u.nome).trim().toLowerCase() === sindico.toLowerCase())
    : true;
  if (sindico && !jaListado) {
    usuarios.unshift({ id: null, nome: sindico, role: 'sindico', cargo: 'Síndico', tipo: 'sindico' });
  }
  return usuarios;
}

export async function definirResponsaveis(
  osId: string,
  condominioId: string,
  entradas: ResponsavelEntrada[],
  autor: AutorOS
) {
  const candidatos = await listarCandidatos(condominioId);
  const porId = new Map(candidatos.filter((c: any) => c.id).map((c: any) => [String(c.id), c]));
  const nomesLivres = new Set(
    candidatos.filter((c: any) => !c.id).map((c: any) => String(c.nome).trim().toLowerCase())
  );

  const validos: Array<{ usuarioId: string | null; nome: string; papel: string }> = [];
  const vistos = new Set<string>();
  for (const entrada of entradas.slice(0, 20)) {
    if (entrada.usuarioId) {
      const cand: any = porId.get(String(entrada.usuarioId));
      if (!cand) return { erro: 'Responsável fora do escopo deste condomínio' as const };
      if (vistos.has(String(cand.id))) continue;
      vistos.add(String(cand.id));
      validos.push({ usuarioId: String(cand.id), nome: cand.nome, papel: cand.role || 'usuario' });
    } else {
      const nome = String(entrada.nome || '').trim();
      if (nome.length < 3) return { erro: 'Nome de responsável inválido' as const };
      if (!nomesLivres.has(nome.toLowerCase())) return { erro: 'Responsável fora do escopo deste condomínio' as const };
      const chave = `nome:${nome.toLowerCase()}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      validos.push({ usuarioId: null, nome, papel: 'sindico' });
    }
  }

  const anteriores = await query<{ usuario_id: string | null }>(
    'SELECT usuario_id FROM os_responsaveis WHERE os_id = $1', [osId]
  );
  const idsAnteriores = new Set(anteriores.map(r => r.usuario_id).filter(Boolean) as string[]);

  await transaction(async client => {
    await client.query('DELETE FROM os_responsaveis WHERE os_id = $1', [osId]);
    for (const r of validos) {
      await client.query(
        `INSERT INTO os_responsaveis (os_id, usuario_id, nome, papel, definido_por_nome)
         VALUES ($1,$2,$3,$4,$5)`,
        [osId, r.usuarioId, r.nome, r.papel, autor.nome]
      );
    }
    const principal = validos.find(r => r.usuarioId)?.usuarioId ?? null;
    await client.query('UPDATE ordens_servico SET responsavel_id = $1 WHERE id = $2', [principal, osId]);
  });

  await registrarHistorico(
    osId,
    'responsaveis',
    validos.length ? validos.map(r => r.nome).join(', ') : 'Nenhum responsável definido',
    { responsaveis: validos.map(r => ({ id: r.usuarioId, nome: r.nome })) },
    autor
  ).catch(() => {});

  const os = await queryOne<{ protocolo: string; titulo: string }>(
    'SELECT protocolo, titulo FROM ordens_servico WHERE id = $1', [osId]
  );
  for (const r of validos) {
    if (!r.usuarioId || idsAnteriores.has(r.usuarioId) || r.usuarioId === autor.id) continue;
    const msg = `${os?.protocolo || ''} — ${os?.titulo || ''}`.trim();
    createNotification(r.usuarioId, 'Você é responsável por uma O.S.', msg, 'info', `/x/os/${osId}`).catch(() => {});
    sendPush(r.usuarioId, { title: 'Você é responsável por uma O.S.', body: msg, url: `/x/os/${osId}` }).catch(() => {});
  }

  return { responsaveis: await listarResponsaveis(osId) };
}

export async function sincronizarFotosLegado(osId: string): Promise<void> {
  await execute(
    `UPDATE ordens_servico
        SET fotos = COALESCE((SELECT array_agg(url ORDER BY criado_em) FROM os_fotos WHERE os_id = $1 AND tipo = 'imagem'), '{}')
      WHERE id = $1`,
    [osId]
  );
}

export async function adicionarFotos(
  osId: string,
  urls: Array<{ url: string; legenda?: string | null; nome?: string | null; tipo?: 'imagem' | 'arquivo'; fase?: 'antes' | 'depois' }>,
  autor: AutorOS
) {
  const total = await queryOne<{ total: string }>('SELECT COUNT(*) as total FROM os_fotos WHERE os_id = $1', [osId]);
  if (Number(total?.total ?? 0) + urls.length > 30) {
    return { erro: 'Limite de 30 anexos por ordem de serviço' as const };
  }
  for (const item of urls) {
    const tipo = item.tipo ?? (/\.pdf$/i.test(item.url) ? 'arquivo' : 'imagem');
    const fase = item.fase === 'depois' ? 'depois' : 'antes';
    await execute(
      `INSERT INTO os_fotos (os_id, url, legenda, nome, tipo, fase, autor_id, autor_nome, origem)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [osId, item.url, item.legenda?.slice(0, 255) ?? null, item.nome?.slice(0, 255) ?? null, tipo, fase, autor.id ?? null, autor.nome, autor.origem]
    );
  }
  await sincronizarFotosLegado(osId);
  const fases = [...new Set(urls.map(u => (u.fase === 'depois' ? 'depois' : 'antes')))].join(' e ');
  await registrarHistorico(osId, 'fotos', `${urls.length} anexo(s) adicionado(s) — ${fases}`, { urls: urls.map(u => u.url), fases }, autor).catch(() => {});
  return { fotos: await listarFotos(osId) };
}

export async function removerFoto(osId: string, fotoId: string, autor: AutorOS) {
  const row = await queryOne<{ url: string }>(
    'DELETE FROM os_fotos WHERE id = $1 AND os_id = $2 RETURNING url',
    [fotoId, osId]
  );
  if (!row) return { erro: 'Anexo não encontrado' as const };
  await sincronizarFotosLegado(osId);
  await registrarHistorico(osId, 'fotos', 'Anexo removido', { url: row.url, removida: true }, autor).catch(() => {});
  return { fotos: await listarFotos(osId) };
}

export async function adicionarDescricao(osId: string, texto: string, autor: AutorOS) {
  const limpo = texto.trim().slice(0, 5000);
  if (limpo.length < 2) return { erro: 'Descrição muito curta' as const };
  await registrarHistorico(osId, 'descricao', limpo, {}, autor);
  return { historico: await listarHistorico(osId) };
}

export async function detalhesColaboracao(osId: string) {
  const [responsaveis, fotos, historico] = await Promise.all([
    listarResponsaveis(osId),
    listarFotos(osId),
    listarHistorico(osId),
  ]);
  return { responsaveis, fotos, historico };
}
