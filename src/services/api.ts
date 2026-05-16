import { safeStorage } from '../utils/storage';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const API_CACHE_PREFIX = 'manutencao_api_cache';
const API_CACHE_VERSION = 'v1';
const PUBLIC_AUTH_PATHS = new Set([
  '/auth/login',
  '/auth/self-register',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

let authToken: string | null = safeStorage.getItem('manutencao_token');
let isRedirecting = false; // Previne múltiplos redirects simultâneos

function hashScope(value: string | null) {
  if (!value) return 'public';

  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = Math.trunc((((hash << 5) - hash) + (value.codePointAt(i) || 0)));
  }

  return Math.abs(hash).toString(36);
}

function buildCacheKey(scope: 'api' | 'portal', path: string, token: string | null) {
  return `${API_CACHE_PREFIX}:${API_CACHE_VERSION}:${scope}:${hashScope(token)}:${path}`;
}

function readCachedResponse<T>(cacheKey: string): T | null {
  const raw = safeStorage.getItem(cacheKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { data?: T };
    return parsed.data ?? null;
  } catch {
    safeStorage.removeItem(cacheKey);
    return null;
  }
}

function writeCachedResponse(cacheKey: string, data: unknown) {
  safeStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data }));
}

function getCachedOrThrow<T>(cacheKey: string | null, message: string): T {
  const cached = cacheKey ? readCachedResponse<T>(cacheKey) : null;
  if (cached !== null) {
    return cached;
  }

  throw new Error(message);
}

function parseJsonResponse<T>(res: Response, cacheKey: string | null): Promise<T> {
  if (res.status === 204) {
    if (cacheKey) writeCachedResponse(cacheKey, {});
    return Promise.resolve({} as T);
  }

  return res.json().then((json) => {
    const data = toCamel(json) as T;
    if (cacheKey) writeCachedResponse(cacheKey, data);
    return data;
  });
}

export function setToken(token: string | null) {
  authToken = token;
  if (token) {
    safeStorage.setItem('manutencao_token', token);
  } else {
    safeStorage.removeItem('manutencao_token');
  }
}

export function getToken(): string | null {
  return authToken;
}

async function secureDownload(url: string, defaultFilename: string) {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) throw new Error('Erro no download');
    const blob = await res.blob();
    const objectUrl = globalThis.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.target = '_blank';
    link.download = defaultFilename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    globalThis.URL.revokeObjectURL(objectUrl);
  } catch (err) {
    console.error('Download falhou:', err);
    alert('Não foi possível gerar o arquivo. Verifique sua conexão ou tente novamente.');
  }
}

function snakeToCamel(key: string) {
  const [first, ...rest] = key.split('_');
  return first + rest.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

function camelToSnake(key: string) {
  return Array.from(key).map(char => (
    char >= 'A' && char <= 'Z' ? `_${char.toLowerCase()}` : char
  )).join('');
}

/* ── snake_case → camelCase (respostas da API) ── */
function toCamel(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  const out: any = {};
  for (const key of Object.keys(obj)) {
    const camel = snakeToCamel(key);
    out[camel] = toCamel(obj[key]);
  }
  return out;
}

/* ── camelCase → snake_case (envio para API) ── */
function toSnake(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toSnake);
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  const out: any = {};
  for (const key of Object.keys(obj)) {
    const snake = camelToSnake(key);
    out[snake] = toSnake(obj[key]);
  }
  return out;
}

function withDateQuery(path: string, key: string, value?: string) {
  return value ? `${path}?${key}=${encodeURIComponent(value)}` : path;
}

async function getErrorBody(res: Response) {
  return res.json().catch(() => ({}));
}

async function handleUnauthorizedResponse(res: Response, path: string) {
  const isLoginRoute = path === '/auth/login' || path === '/auth/self-register';
  if (isLoginRoute) {
    const body = await getErrorBody(res);
    throw new Error(body.error || 'Credenciais inválidas');
  }

  if (!isRedirecting && authToken) {
    isRedirecting = true;
    const tokenAtError = authToken;
    globalThis.setTimeout(() => {
      if (authToken === tokenAtError) {
        setToken(null);
        globalThis.dispatchEvent(new Event('auth:unauthorized'));
      }
      isRedirecting = false;
    }, 300);
  }

  throw new Error('Sessão expirada');
}

async function handleFailedResponse(res: Response, path: string) {
  if (res.status === 401) {
    await handleUnauthorizedResponse(res, path);
  }

  if (res.status === 403) {
    const body = await getErrorBody(res);
    if (path === '/auth/login') {
      const details = [body.error, body.motivo].filter(Boolean).join(': ');
      throw new Error(details || 'Acesso negado');
    }
    throw new Error(body.error || body.motivo || 'Acesso negado');
  }

  if (res.status === 429) {
    const body = await getErrorBody(res);
    throw new Error(body.error || 'Muitas requisições. Aguarde alguns minutos.');
  }

  if (res.status >= 500) {
    throw new Error('Servidor temporariamente indisponível. Tente novamente em instantes.');
  }

  const body = await getErrorBody(res);
  throw new Error(body.error || `Erro ${res.status}`);
}

async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const cacheKey = method === 'GET' ? buildCacheKey('api', path, authToken) : null;
  const isPublicAuthRoute = PUBLIC_AUTH_PATHS.has(path);
  const extraHeaders = options.headers as Record<string, string> | undefined;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (extraHeaders) Object.assign(headers, extraHeaders);

  if (authToken && !isPublicAuthRoute) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Timeout de 30s para evitar requests pendentes infinitos
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name !== 'AbortError') {
      return getCachedOrThrow<T>(cacheKey, 'Sem conexão com o servidor. Verifique sua internet.');
    }
    if (err.name === 'AbortError') {
      throw new Error('Servidor demorou para responder. Tente novamente.');
    }
    throw new Error('Sem conexão com o servidor. Verifique sua internet.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    await handleFailedResponse(res, path);
  }

  return parseJsonResponse<T>(res, cacheKey);
}

/* Wrapper para enviar body */
function post<T = any>(path: string, data: any) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(toSnake(data)) });
}
function put<T = any>(path: string, data: any) {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(toSnake(data)) });
}
function patch<T = any>(path: string, data: any) {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(toSnake(data)) });
}
function del<T = any>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

// ── Auth ──
export const auth = {
  login: (email: string, senha: string) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    }),
  register: (data: { email: string; senha: string; nome: string; role: string; cargo?: string; condominioId?: string; supervisorId?: string }) =>
    post('/auth/register', data),
  me: () => request('/auth/me'),
  changePassword: (senhaAtual: string, novaSenha: string) =>
    post('/auth/change-password', { senhaAtual, novaSenha }),
  selfRegister: (data: { email: string; senha: string; nome: string; telefone?: string }) =>
    request<{ message: string }>('/auth/self-register', { method: 'POST', body: JSON.stringify(data) }),
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, novaSenha: string) =>
    request<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, novaSenha }) }),
};

// ── Generic CRUD factory ──
function crud<T = any>(basePath: string) {
  return {
    list: () => request<T[]>(basePath),
    get: (id: string) => request<T>(`${basePath}/${id}`),
    create: (data: Partial<T>) => post<T>(basePath, data),
    update: (id: string, data: Partial<T>) => put<T>(`${basePath}/${id}`, data),
    remove: (id: string) => del(`${basePath}/${id}`),
  };
}

// ── Entidades ──
export const condominios = {
  ...crud('/condominios'),
  patchStatus: (id: string, data: any) => patch(`/condominios/${id}/status`, data),
};
export const ordensServico = {
  ...crud('/ordens-servico'),
  list: (params?: { page?: number; pageSize?: number }) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return request<any>(`/ordens-servico${qs}`);
  },
  updateStatus: (id: string, status: string) => patch(`/ordens-servico/${id}/status`, { status }),
  avaliar: (id: string, nota: number, comentario?: string) => patch(`/ordens-servico/${id}/avaliacao`, { nota, comentario }),
};
export const checklists = {
  ...crud('/checklists'),
  updateItens: (id: string, data: any) => patch(`/checklists/${id}/itens`, data),
  locais: () => request<any[]>('/checklists/locais'),
  criarLocal: (data: { nome: string; itensPadrao?: string[]; condominioId?: string }) => post('/checklists/locais', data),
  atualizarLocal: (id: number, data: { nome: string; itensPadrao?: string[] }) => put(`/checklists/locais/${id}`, data),
  excluirLocal: (id: number) => del(`/checklists/locais/${id}`),
};
export const escalas = crud('/escalas');
export const materiais = {
  ...crud('/materiais'),
  listMovimentacoes: (id: string) => request<any[]>(`/materiais/${id}/movimentacoes`),
  addMovimentacao: (id: string, data: any) => post(`/materiais/${id}/movimentacoes`, data),
};
export const inspecoes = crud('/inspecoes');
export const vistorias = crud('/vistorias');
export const reportes = {
  ...crud('/reportes'),
  updateStatus: (id: string, status: string) => patch(`/reportes/${id}/status`, { status }),
};
export const tarefas = {
  ...crud('/tarefas'),
  listExecucoes: (id: string) => request<any[]>(`/tarefas/${id}/execucoes`),
  allExecucoes: () => request<any[]>('/tarefas/execucoes/all'),
  addExecucao: (id: string, data: any) => post(`/tarefas/${id}/execucoes`, data),
};
export const roteiros = {
  ...crud('/roteiros'),
  listExecucoes: (id: string) => request<any[]>(`/roteiros/${id}/execucoes`),
  addExecucao: (id: string, data: any) => post(`/roteiros/${id}/execucoes`, data),
};
export const qrcodes = {
  ...crud('/qrcodes'),
  leituras: () => request<any[]>('/qrcodes/leituras/all'),
  addLeitura: (data: any) => post('/qrcodes/leituras', data),
  listPonto: () => request<any[]>('/qrcodes/ponto/all'),
  addPonto: (data: any) => post('/qrcodes/ponto', data),
  listSla: () => request<any[]>('/qrcodes/sla/all'),
  createSla: (data: any) => post('/qrcodes/sla', data),
  updateSla: (id: string, status: string) => patch(`/qrcodes/sla/${id}`, { status }),
  getSupervisorPerm: () => request<{ autorizado: boolean }>('/qrcodes/supervisor-perm'),
  setSupervisorPerm: (autorizado: boolean) => put('/qrcodes/supervisor-perm', { autorizado }),
  listRespostas: (qrcodeId?: string) => qrcodeId
    ? request<any[]>(`/qrcodes/respostas/${qrcodeId}`)
    : request<any[]>('/qrcodes/respostas/all'),
  addResposta: (data: any) => post('/qrcodes/respostas', data),
};
export const geolocalizacao = {
  list: (data?: string) => request<any[]>(withDateQuery('/geolocalizacao', 'data', data)),
  create: (data: any) => post('/geolocalizacao', data),
  registrarSaida: (id: string, tempoTotal: number) => patch(`/geolocalizacao/${id}/saida`, { tempoTotal }),
  listSla: () => request<any[]>('/geolocalizacao/sla'),
  createSla: (data: any) => post('/geolocalizacao/sla', data),
  updateSla: (id: string, status: string) => patch(`/geolocalizacao/sla/${id}`, { status }),
};
export const comunicados = crud('/comunicados');
export const moradores = {
  ...crud('/moradores'),
  listWhatsContatos: () => request<any[]>('/moradores/whatsapp-contatos'),
  addWhatsContato: (data: any) => post('/moradores/whatsapp-contatos', data),
  removeWhatsContato: (id: string) => del(`/moradores/whatsapp-contatos/${id}`),
};
export const vencimentos = {
  ...crud('/vencimentos'),
  create: (data: any) => request('/vencimentos', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request(`/vencimentos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getEmails: () => request<{ emails: string[] }>('/vencimentos/emails/global'),
  setEmails: (emails: string[]) => put('/vencimentos/emails/global', { emails }),
};
export const quadroAtividades = {
  ...crud('/quadro-atividades'),
  updateStatus: (id: string, status: string) => patch(`/quadro-atividades/${id}/status`, { status }),
};
export const usuarios = {
  ...crud('/usuarios'),
  list: async () => {
    const res = await request<any>('/usuarios');
    return Array.isArray(res) ? res : res.data ?? [];
  },
  bloquear: (id: string, bloqueado: boolean, motivo?: string) => patch(`/usuarios/${id}/bloquear`, { bloqueado, motivo }),
  resetSenha: (id: string, novaSenha: string) => patch(`/usuarios/${id}/reset-senha`, { novaSenha }),
};
export const configuracoes = {
  getTema: () => request('/configuracoes/tema'),
  setTema: (data: any) => put('/configuracoes/tema', data),
  getQuadroPermissoes: () => request('/configuracoes/quadro-permissoes'),
  setQuadroPermissoes: (data: any) => put('/configuracoes/quadro-permissoes', data),
  getVencimentosTipos: () => request<{ tipos: Array<{ id: string; label: string }> }>('/configuracoes/vencimentos-tipos'),
  setVencimentosTipos: (tipos: Array<{ id: string; label: string }>) => put('/configuracoes/vencimentos-tipos', { tipos }),
};
export const permissoes = {
  list: () => request<any[]>('/permissoes'),
  update: (id: string, data: any) => put(`/permissoes/${id}`, data),
};
export const dashboard = {
  summary: () => request<any>('/dashboard/summary'),
  masterSummary: () => request<any>('/dashboard/master-summary'),
  masterUsers: () => request<any>('/dashboard/master-users'),
  masterReport: (params: { dataInicio?: string; dataFim?: string; statusPlano?: string }) => {
    const qs = new URLSearchParams();
    if (params.dataInicio) qs.set('dataInicio', params.dataInicio);
    if (params.dataFim) qs.set('dataFim', params.dataFim);
    if (params.statusPlano) qs.set('statusPlano', params.statusPlano);
    return request<any>(`/dashboard/master-report?${qs.toString()}`);
  },
};
export const relatorios = {
  resumo: () => request<any>('/relatorios/resumo'),
};
export const notificacoes = {
  list: () => request<any[]>('/notificacoes'),
  unreadCount: () => request<{ count: number }>('/notificacoes/unread-count'),
  markRead: (id: string) => patch('/notificacoes/' + id + '/read', {}),
  markAllRead: () => post('/notificacoes/read-all', {}),
  remove: (id: string) => del('/notificacoes/' + id),
};
export const perfil = {
  get: () => request<any>('/perfil'),
  update: (data: { nome?: string; telefone?: string; cargo?: string }) => put('/perfil', data),
  changeSenha: (senhaAtual: string, novaSenha: string) => put('/perfil/senha', { senhaAtual, novaSenha }),
  updateAvatar: (avatarUrl: string) => put('/perfil/avatar', { avatarUrl }),
};
export const audit = {
  list: (page?: number, limit?: number) => request<any>(`/audit?page=${page || 1}&limit=${limit || 50}`),
  metrics: () => request<any>('/audit/metrics'),
};

// ── Equipamentos ──
export const equipamentos = {
  ...crud('/equipamentos'),
  listHistorico: (id: string) => request<any[]>(`/equipamentos/${id}/historico`),
  addHistorico: (id: string, data: any) => post(`/equipamentos/${id}/historico`, data),
};

// ── Fornecedores ──
export const fornecedores = {
  ...crud('/fornecedores'),
  list: async () => {
    const res = await request<any>('/fornecedores');
    return Array.isArray(res) ? res : res.data ?? [];
  },
  listAvaliacoes: (id: string) => request<any[]>(`/fornecedores/${id}/avaliacoes`),
  addAvaliacao: (id: string, data: any) => post(`/fornecedores/${id}/avaliacoes`, data),
};

// ── Planos de Manutenção ──
export const planosManutencao = {
  ...crud('/planos-manutencao'),
  listExecucoes: (id: string) => request<any[]>(`/planos-manutencao/${id}/execucoes`),
  addExecucao: (id: string, data: any) => post(`/planos-manutencao/${id}/execucoes`, data),
  calendario: () => request<any[]>('/planos-manutencao/calendario/proximos'),
};

// ── Custos ──
export const custos = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/custos${qs}`);
  },
  porCondominio: () => request<any[]>('/custos/por-condominio'),
  porCategoria: () => request<any[]>('/custos/por-categoria'),
  evolucao: () => request<any[]>('/custos/evolucao'),
  porEquipamento: () => request<any[]>('/custos/por-equipamento'),
};

// ── KPIs ──
export const kpis = {
  get: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/kpis${qs}`);
  },
  equipamentos: () => request<any[]>('/kpis/equipamentos'),
  tendencia: () => request<any[]>('/kpis/tendencia'),
};

// ── Documentos Técnicos ──
export const documentos = {
  ...crud('/documentos'),
  resumo: () => request<any>('/documentos/resumo'),
};

// ── Solicitações (staff) ──
export const solicitacoes = {
  list: () => request<any[]>('/solicitacoes'),
  get: (id: string | number) => request<any>(`/solicitacoes/${id}`),
  resumo: () => request<any>('/solicitacoes/resumo'),
  responder: (id: string | number, data: { status: string; resposta?: string }) =>
    patch(`/solicitacoes/${id}/responder`, data),
  converterOS: (id: string | number) => patch(`/solicitacoes/${id}/converter-os`, {}),
};

// ── SLA ──
export const sla = {
  configuracoes: () => request<any[]>('/sla/configuracoes'),
  salvarConfiguracoes: (condominioId: string, configuracoes: any[]) =>
    put('/sla/configuracoes', { condominioId, configuracoes }),
  dashboard: () => request<any>('/sla/dashboard'),
  violacoes: () => request<any[]>('/sla/violacoes'),
  recalcular: () => patch('/sla/recalcular', {}),
};

// ── PDF ──
export const pdf = {
  ordemServico: (id: string) => {
    secureDownload(`${API_BASE}/pdf/ordem-servico/${id}`, `OS-${id}.pdf`);
  },
  relatorioMensal: (mes?: string) => {
    const qs = mes ? `?mes=${mes}` : '';
    secureDownload(`${API_BASE}/pdf/relatorio-mensal${qs}`, `Relatorio-${mes || 'Mensal'}.pdf`);
  },
};

// ── WhatsApp ──
export const whatsapp = {
  getConfig: (condominioId: string) => request<any>(`/whatsapp/config/${condominioId}`),
  saveConfig: (condominioId: string, data: any) => put(`/whatsapp/config/${condominioId}`, data),
  enviarMensagem: (data: any) => post('/whatsapp/enviar', data),
  mensagens: (condominioId: string) => request<any[]>(`/whatsapp/mensagens/${condominioId}`),
  testar: (condominioId: string) => post(`/whatsapp/testar/${condominioId}`, {}),
};

// ── Síndico ──
export const sindico = {
  resumo: () => request<any>('/sindico/resumo'),
  osPorCondominio: () => request<any[]>('/sindico/os-por-condominio'),
  evolucaoMensal: () => request<any[]>('/sindico/evolucao-mensal'),
};

// ── Calendário ──
export const calendario = {
  eventos: (mes?: string) => {
    const qs = mes ? `?mes=${mes}` : '';
    return request<any>(`/calendario${qs}`);
  },
  // Anotações
  anotacoes: (mes?: string) => {
    const qs = mes ? `?mes=${mes}` : '';
    return request<any[]>(`/calendario/anotacoes${qs}`);
  },
  criarAnotacao: (data: { data: string; texto: string; cor: string }) =>
    request<any>('/calendario/anotacoes', { method: 'POST', body: JSON.stringify(data) }),
  atualizarAnotacao: (id: number, data: { texto?: string; cor?: string }) =>
    request<any>(`/calendario/anotacoes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  excluirAnotacao: (id: number) =>
    request<any>(`/calendario/anotacoes/${id}`, { method: 'DELETE' }),
  // Legendas
  legendas: () => request<any[]>('/calendario/legendas'),
  criarLegenda: (data: { cor: string; rotulo: string }) =>
    request<any>('/calendario/legendas', { method: 'POST', body: JSON.stringify(data) }),
  atualizarLegenda: (id: number, data: { cor?: string; rotulo?: string }) =>
    request<any>(`/calendario/legendas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  excluirLegenda: (id: number) =>
    request<any>(`/calendario/legendas/${id}`, { method: 'DELETE' }),
};

// ── Exportação ──
export const exportar = {
  csv: (entidade: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    secureDownload(`${API_BASE}/export/${entidade}${qs}`, `Export-${entidade}.csv`);
  },
};

// ── Controle de Ponto ──
export const ponto = {
  list: (data?: string) => request<any[]>(withDateQuery('/ponto', 'data', data)),
  resumo: (mes?: string) => request<any>(withDateQuery('/ponto/resumo', 'mes', mes)),
  registrar: (data: any) => post('/ponto', data),
};

// ── Contratos de Fornecedores ──
export const contratos = {
  ...crud('/contratos'),
  list: async () => {
    const res = await request<any>('/contratos');
    return Array.isArray(res) ? res : res.data ?? [];
  },
  resumo: () => request<any>('/contratos/resumo'),
};

// ── Orçamentos ──
export const orcamentos = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/orcamentos${qs}`);
  },
  get: (id: string) => request<any>(`/orcamentos/${id}`),
  create: (data: any) => post('/orcamentos', data),
  update: (id: string, data: any) => put(`/orcamentos/${id}`, data),
  remove: (id: string) => del(`/orcamentos/${id}`),
  updateStatus: (id: string, status: string) => patch(`/orcamentos/${id}/status`, { status }),
  pdf: (id: string) => {
    secureDownload(`${API_BASE}/orcamentos/${id}/pdf`, `Orcamento-${id}.pdf`);
  },
};

// ── Push Notifications ──
export const push = {
  getVapidKey: () => request<{ key: string; enabled: boolean }>('/push/vapid-key'),
  subscribe: (subscription: any) => post('/push/subscribe', { subscription }),
  unsubscribe: (endpoint: string) => post('/push/unsubscribe', { endpoint }),
};

// ── Portal do Morador ──
const PORTAL_BASE = import.meta.env.VITE_API_URL || '/api';

let portalToken: string | null = safeStorage.getItem('portal_token');

export function setPortalToken(token: string | null) {
  portalToken = token;
  if (token) safeStorage.setItem('portal_token', token);
  else safeStorage.removeItem('portal_token');
}

export function getPortalToken(): string | null {
  return portalToken;
}

async function portalRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const cacheKey = method === 'GET' ? buildCacheKey('portal', path, portalToken) : null;
  const extraHeaders = options.headers as Record<string, string> | undefined;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (extraHeaders) Object.assign(headers, extraHeaders);
  if (portalToken) headers['Authorization'] = `Bearer ${portalToken}`;

  let res: Response;
  try {
    res = await fetch(`${PORTAL_BASE}/portal${path}`, { ...options, headers });
  } catch {
    return getCachedOrThrow<T>(cacheKey, 'Sem conexão com o servidor. Verifique sua internet.');
  }

  if (res.status === 401) {
    const had = !!portalToken;
    setPortalToken(null);
    if (had) globalThis.location.assign('/portal/login');
    throw new Error('Sessão expirada');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }
  return parseJsonResponse<T>(res, cacheKey);
}

function portalPost<T = any>(path: string, data: any) {
  return portalRequest<T>(path, { method: 'POST', body: JSON.stringify(toSnake(data)) });
}
function portalPut<T = any>(path: string, data: any) {
  return portalRequest<T>(path, { method: 'PUT', body: JSON.stringify(toSnake(data)) });
}

export const portal = {
  login: (email: string, senha: string) =>
    portalPost<{ token: string; morador: any }>('/login', { email, senha }),
  primeiroAcesso: (token: string, senha: string) =>
    portalPost<{ token: string; morador: any }>('/primeiro-acesso', { token, senha }),
  me: () => portalRequest<any>('/perfil'),
  updatePerfil: (data: any) => portalPut('/perfil', data),
  changeSenha: (senhaAtual: string, novaSenha: string) =>
    portalPut('/senha', { senha_atual: senhaAtual, nova_senha: novaSenha }),
  resumo: () => portalRequest<any>('/resumo'),
  comunicados: () => portalRequest<any[]>('/comunicados'),
  solicitacoes: () => portalRequest<any[]>('/solicitacoes'),
  getSolicitacao: (id: number) => portalRequest<any>(`/solicitacoes/${id}`),
  criarSolicitacao: (data: any) => portalPost('/solicitacoes', data),
};

// ── Upload ──
export const upload = {
  image: async (file: File, folder?: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) formData.append('folder', folder);
    const res = await fetch(`${API_BASE}/upload/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: formData,
    });
    const data = await res.json();
    return data.url;
  },
  avatar: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: formData,
    });
    const data = await res.json();
    return data.url;
  },
  document: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload/document`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: formData,
    });
    const data = await res.json();
    return data.url;
  },
};
