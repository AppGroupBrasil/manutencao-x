import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';

/**
 * Middleware factory: valida req.body com schema Zod.
 * Uso: router.post('/', validate(meuSchema), handler)
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`);
        res.status(400).json({ error: 'Dados inválidos', detalhes: messages });
        return;
      }
      next(err);
    }
  };
}

// ── Schemas reutilizáveis ──

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(1, 'Senha obrigatória'),
});

export const registerSchema = z.object({
  email: z.string().email('E-mail inválido').max(255),
  senha: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').max(128),
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(255),
  role: z.enum(['administrador', 'supervisor', 'funcionario']),
  cargo: z.string().max(100).optional().nullable(),
  condominioId: z.string().uuid().optional().nullable(),
  supervisorId: z.string().uuid().optional().nullable(),
});

export const selfRegisterSchema = z.object({
  email: z.string().email('E-mail inválido').max(255),
  senha: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').max(128),
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(255),
  telefone: z.string().max(30).optional().nullable(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token obrigatório').max(128),
  novaSenha: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').max(128),
});

export const changePasswordSchema = z.object({
  senhaAtual: z.string().min(1, 'Senha atual obrigatória').max(128),
  novaSenha: z.string().min(8, 'Nova senha deve ter no mínimo 8 caracteres').max(128),
});

export const ordemServicoSchema = z.object({
  condominioId: z.string().uuid('ID do condomínio inválido'),
  titulo: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(255),
  descricao: z.string().max(5000).optional().nullable(),
  tipo: z.string().max(100).optional(),
  prioridade: z.string().max(50).optional(),
  responsavelId: z.string().uuid().optional().nullable(),
  equipamentoId: z.string().uuid().optional().nullable(),
  fornecedorId: z.string().uuid().optional().nullable(),
  planoId: z.string().uuid().optional().nullable(),
  custoMaterial: z.number().min(0).optional().nullable(),
  custoMaoObra: z.number().min(0).optional().nullable(),
  custoExterno: z.number().min(0).optional().nullable(),
}).passthrough();

export const condominioSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(255),
  endereco: z.string().max(500).optional(),
  cidade: z.string().max(255).optional(),
  estado: z.string().max(2).optional(),
  cep: z.string().max(10).optional(),
  cnpj: z.string().max(20).optional(),
}).passthrough();

export const comunicadoSchema = z.object({
  titulo: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(255),
  mensagem: z.string().min(5, 'Mensagem deve ter no mínimo 5 caracteres').max(5000),
  condominioId: z.string().uuid('ID do condomínio inválido'),
  tipo: z.string().max(100).optional(),
  destinatarioTipo: z.string().max(100).optional(),
}).passthrough();

export const whatsappConfigSchema = z.object({
  api_url: z.string().url('URL inválida').max(500).optional().or(z.literal('')),
  api_token: z.string().max(500).optional(),
  numero_remetente: z.string().max(30).optional(),
  ativo: z.boolean().optional(),
  notificar_os_criada: z.boolean().optional(),
  notificar_os_concluida: z.boolean().optional(),
  notificar_vencimentos: z.boolean().optional(),
  notificar_comunicados: z.boolean().optional(),
}).passthrough();

export const whatsappEnviarSchema = z.object({
  condominio_id: z.string().uuid('ID do condomínio inválido'),
  destinatario: z.string().min(8, 'Número de telefone inválido').max(30),
  mensagem: z.string().min(1, 'Mensagem obrigatória').max(5000),
  tipo: z.string().max(100).optional(),
});

// ── Fornecedores ──
export const fornecedorSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(255),
  condominioId: z.string().uuid('ID do condomínio inválido'),
  cnpj: z.string().max(20).optional().nullable(),
  tipo: z.string().max(100).optional(),
  especialidade: z.string().max(255).optional().nullable(),
  telefone: z.string().max(30).optional().nullable(),
  email: z.string().email('E-mail inválido').max(255).optional().nullable().or(z.literal('')),
}).passthrough();

// ── Contratos ──
export const contratoSchema = z.object({
  fornecedorId: z.string().uuid('ID do fornecedor inválido'),
  condominioId: z.string().uuid('ID do condomínio inválido'),
  valor: z.number().min(0).optional().nullable(),
  status: z.string().max(50).optional(),
}).passthrough();

export const contratoUpdateSchema = z.object({
  status: z.string().max(50).optional(),
  valor: z.number().min(0).optional().nullable(),
}).passthrough();

// ── Equipamentos ──
export const equipamentoSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(255),
  condominioId: z.string().uuid('ID do condomínio inválido'),
  categoria: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
}).passthrough();

// ── Usuários ──
export const usuarioUpdateSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(255),
  role: z.enum(['administrador', 'supervisor', 'funcionario']),
  ativo: z.boolean(),
}).passthrough();

// ── Moradores ──
export const moradorSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(255),
  condominioId: z.string().uuid('ID do condomínio inválido'),
  bloco: z.string().max(50).optional().nullable(),
  apartamento: z.string().max(20).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  email: z.string().email('E-mail inválido').max(255).optional().nullable().or(z.literal('')),
  perfil: z.string().max(50).optional(),
}).passthrough();

// ── Materiais ──
export const materialSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(255),
  condominioId: z.string().uuid('ID do condomínio inválido'),
  categoria: z.string().max(100).optional().nullable(),
  unidade: z.string().max(50).optional(),
  quantidade: z.number().min(0).optional(),
  quantidadeMinima: z.number().min(0).optional(),
  custoUnitario: z.number().min(0).optional(),
}).passthrough();

// ── Tarefas ──
export const tarefaSchema = z.object({
  titulo: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(255),
  condominioId: z.string().uuid('ID do condomínio inválido'),
  descricao: z.string().max(5000).optional().nullable(),
  recorrencia: z.string().max(50).optional(),
  prioridade: z.string().max(50).optional(),
}).passthrough();

// ── Vistorias ──
export const vistoriaSchema = z.object({
  titulo: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(255),
  condominioId: z.string().uuid('ID do condomínio inválido'),
  tipo: z.string().max(100).optional(),
  data: z.string().max(30).optional(),
}).passthrough();

// ── Inspeções ──
export const inspecaoSchema = z.object({
  condominioId: z.string().uuid('ID do condomínio inválido'),
  tipo: z.string().min(1, 'Tipo obrigatório').max(100),
  local: z.string().max(255).optional().nullable(),
}).passthrough();

// ── Escalas ──
export const escalaSchema = z.object({
  condominioId: z.string().uuid('ID do condomínio inválido'),
  diaSemana: z.number().int().min(0).max(6),
  horaInicio: z.string().min(1, 'Hora início obrigatória').max(10),
  horaFim: z.string().min(1, 'Hora fim obrigatória').max(10),
}).passthrough();

// ── Reportes ──
export const reporteSchema = z.object({
  condominioId: z.string().uuid('ID do condomínio inválido'),
  descricao: z.string().min(3, 'Descrição deve ter no mínimo 3 caracteres').max(5000),
  prioridade: z.string().max(50).optional(),
}).passthrough();

// ── Roteiros ──
export const roteiroSchema = z.object({
  titulo: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(255),
  categoria: z.string().max(100).optional().nullable(),
}).passthrough();

// ── QR Codes ──
export const qrcodeSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(255),
  descricao: z.string().max(5000).optional().nullable(),
}).passthrough();

// ── Quadro de Atividades ──
export const quadroAtividadeSchema = z.object({
  titulo: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(255),
  condominioId: z.string().uuid('ID do condomínio inválido'),
  prioridade: z.string().max(50).optional(),
  rotina: z.string().max(50).optional(),
}).passthrough();

// ── Vencimentos ──
export const vencimentoSchema = z.object({
  titulo: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(255),
  condominioId: z.string().uuid('ID do condomínio inválido'),
  tipo: z.string().max(100).optional(),
  dataVencimento: z.string().max(30).optional().nullable(),
}).passthrough();

// ── Checklists ──
export const checklistSchema = z.object({
  condominioId: z.string().uuid('ID do condomínio inválido'),
  local: z.string().min(1, 'Local obrigatório').max(255),
  tipo: z.string().max(100).optional(),
}).passthrough();

// ── Documentos Técnicos ──
export const documentoSchema = z.object({
  titulo: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(255),
  condominioId: z.string().uuid('ID do condomínio inválido'),
  tipo: z.string().max(100).optional(),
}).passthrough();

// ── Planos de Manutenção ──
export const planoManutencaoSchema = z.object({
  titulo: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(255),
  condominioId: z.string().uuid('ID do condomínio inválido'),
  frequencia: z.string().max(50).optional(),
}).passthrough();

// ── Orçamentos ──
export const orcamentoItemSchema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória').max(500),
  tipo: z.enum(['material', 'servico', 'mao_de_obra']).optional(),
  quantidade: z.number().min(0).optional(),
  unidade: z.string().max(30).optional(),
  valor_unitario: z.number().min(0).optional(),
});

export const orcamentoSchema = z.object({
  condominio_id: z.string().uuid('ID do condomínio inválido'),
  titulo: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(255),
  cliente_nome: z.string().max(255).optional().nullable(),
  cliente_telefone: z.string().max(30).optional().nullable(),
  cliente_email: z.string().max(255).optional().nullable(),
  cliente_endereco: z.string().max(500).optional().nullable(),
  descricao_geral: z.string().max(5000).optional().nullable(),
  observacoes: z.string().max(5000).optional().nullable(),
  condicoes_pagamento: z.string().max(500).optional().nullable(),
  validade_dias: z.number().int().min(1).max(365).optional(),
  prazo_execucao: z.string().max(255).optional().nullable(),
  desconto_tipo: z.enum(['nenhum', 'percentual', 'valor']).optional(),
  desconto_valor: z.number().min(0).optional(),
  logo_url: z.string().max(500).optional().nullable(),
  os_referencia: z.string().max(255).optional().nullable(),
  itens: z.array(orcamentoItemSchema).max(100).optional(),
  fotos: z.array(z.object({
    url: z.string().max(500),
    legenda: z.string().max(255).optional(),
  })).max(20).optional(),
}).passthrough();
