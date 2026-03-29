import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../contexts/PermissionsContext';
import {
  Search, X, LayoutDashboard, Users, ClipboardCheck, Wrench, Calendar,
  Package, MapPin, Settings, Building2, BarChart3, Shield, FileWarning, Eye, QrCode,
  ScanLine, Flame, CalendarCheck, BookOpen, CalendarClock, Contact, Megaphone, Columns3, Bell, User
} from 'lucide-react';
import styles from './GlobalSearch.module.css';

interface SearchItem {
  id: string;
  label: string;
  descricao: string;
  icon: React.ReactNode;
  rota: string;
  minRole: number;
  keywords: string[];
}

const SEARCH_ITEMS: SearchItem[] = [
  { id: 'dashboard', label: 'Dashboard', descricao: 'Painel principal, indicadores', icon: <LayoutDashboard size={18} />, rota: '/dashboard', minRole: 1, keywords: ['painel', 'inicio', 'home', 'indicadores', 'resumo'] },
  { id: 'vencimentos', label: 'Agenda de Vencimentos', descricao: 'Controle de vencimentos e prazos', icon: <CalendarClock size={18} />, rota: '/vencimentos', minRole: 2, keywords: ['agenda', 'vencimento', 'prazo', 'data'] },
  { id: 'condominios', label: 'Condomínios', descricao: 'Cadastro e gestão de condomínios', icon: <Building2 size={18} />, rota: '/condominios', minRole: 2, keywords: ['condominio', 'predio', 'edificio'] },
  { id: 'moradores', label: 'Moradores', descricao: 'Cadastro de moradores', icon: <Contact size={18} />, rota: '/moradores', minRole: 2, keywords: ['morador', 'residente', 'apartamento'] },
  { id: 'usuarios', label: 'Usuários', descricao: 'Gerenciar usuários do sistema', icon: <Users size={18} />, rota: '/usuarios', minRole: 3, keywords: ['usuario', 'funcionario', 'colaborador', 'equipe'] },
  { id: 'permissoes', label: 'Permissões', descricao: 'Controle de acesso e permissões', icon: <Shield size={18} />, rota: '/permissoes', minRole: 3, keywords: ['permissao', 'acesso', 'role'] },
  { id: 'checklists', label: 'Checklists', descricao: 'Listas de verificação', icon: <ClipboardCheck size={18} />, rota: '/checklists', minRole: 1, keywords: ['checklist', 'verificacao', 'lista'] },
  { id: 'ordens', label: 'Ordens de Serviço', descricao: 'Gerenciar ordens de serviço', icon: <Wrench size={18} />, rota: '/ordens-servico', minRole: 1, keywords: ['ordem', 'servico', 'os', 'manutencao'] },
  { id: 'comunicados', label: 'Comunicados', descricao: 'Comunicados e avisos', icon: <Megaphone size={18} />, rota: '/comunicados', minRole: 2, keywords: ['comunicado', 'aviso', 'mensagem'] },
  { id: 'materiais', label: 'Controle de Estoque', descricao: 'Materiais e estoque', icon: <Package size={18} />, rota: '/materiais', minRole: 1, keywords: ['material', 'estoque', 'produto', 'item'] },
  { id: 'escalas', label: 'Escalas', descricao: 'Escalas de trabalho', icon: <Calendar size={18} />, rota: '/escalas', minRole: 2, keywords: ['escala', 'turno', 'horario'] },
  { id: 'geolocalizacao', label: 'Geolocalização', descricao: 'Rastreamento por GPS', icon: <MapPin size={18} />, rota: '/geolocalizacao', minRole: 2, keywords: ['geo', 'localizacao', 'mapa', 'gps'] },
  { id: 'inspecoes', label: 'Inspeções', descricao: 'Agendar e acompanhar inspeções', icon: <Search size={18} />, rota: '/inspecoes', minRole: 2, keywords: ['inspecao', 'vistoria', 'verificacao'] },
  { id: 'qrcode', label: 'QR Codes', descricao: 'Criar e gerenciar QR Codes', icon: <QrCode size={18} />, rota: '/qrcode', minRole: 2, keywords: ['qrcode', 'qr', 'codigo'] },
  { id: 'leitor-qrcode', label: 'Leitor QR Code', descricao: 'Escanear QR Codes', icon: <ScanLine size={18} />, rota: '/leitor-qrcode', minRole: 1, keywords: ['leitor', 'scanner', 'escanear'] },
  { id: 'mapa-calor', label: 'Reclamações', descricao: 'Mapa de calor de reclamações', icon: <Flame size={18} />, rota: '/mapa-calor', minRole: 3, keywords: ['reclamacao', 'mapa', 'calor'] },
  { id: 'relatorios', label: 'Relatórios', descricao: 'Relatórios e exportações', icon: <BarChart3 size={18} />, rota: '/relatorios', minRole: 2, keywords: ['relatorio', 'export', 'pdf', 'dados'] },
  { id: 'reportes', label: 'Reportes', descricao: 'Reportes e ocorrências', icon: <FileWarning size={18} />, rota: '/reportes', minRole: 1, keywords: ['reporte', 'ocorrencia', 'problema'] },
  { id: 'roteiros', label: 'Roteiro de Execução', descricao: 'Roteiros de limpeza', icon: <BookOpen size={18} />, rota: '/roteiros', minRole: 1, keywords: ['roteiro', 'execucao', 'limpeza'] },
  { id: 'tarefas', label: 'Tarefas Agendadas', descricao: 'Tarefas programadas', icon: <CalendarCheck size={18} />, rota: '/tarefas', minRole: 1, keywords: ['tarefa', 'agendamento', 'programado'] },
  { id: 'vistorias', label: 'Vistorias', descricao: 'Realizar vistorias', icon: <Eye size={18} />, rota: '/vistorias', minRole: 1, keywords: ['vistoria', 'avaliacao'] },
  { id: 'quadro-atividades', label: 'Quadro de Atividades', descricao: 'Kanban de atividades', icon: <Columns3 size={18} />, rota: '/quadro-atividades', minRole: 1, keywords: ['quadro', 'kanban', 'atividade', 'board'] },
  { id: 'configuracoes', label: 'Configurações', descricao: 'Configurações do sistema', icon: <Settings size={18} />, rota: '/configuracoes', minRole: 1, keywords: ['configuracao', 'tema', 'aparencia'] },
  { id: 'perfil', label: 'Meu Perfil', descricao: 'Editar dados pessoais e senha', icon: <User size={18} />, rota: '/perfil', minRole: 1, keywords: ['perfil', 'conta', 'senha', 'avatar'] },
  { id: 'notificacoes', label: 'Notificações', descricao: 'Ver notificações do sistema', icon: <Bell size={18} />, rota: '/notificacoes', minRole: 1, keywords: ['notificacao', 'alerta', 'aviso'] },
];

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const GlobalSearch: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const navigate = useNavigate();
  const { roleNivel, podeVer } = usePermissions();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = query.trim().length > 0
    ? SEARCH_ITEMS.filter(item => {
        if (roleNivel < item.minRole || !podeVer(item.id)) return false;
        const q = normalize(query);
        return normalize(item.label).includes(q)
          || normalize(item.descricao).includes(q)
          || item.keywords.some(k => normalize(k).includes(q));
      })
    : SEARCH_ITEMS.filter(item => roleNivel >= item.minRole && podeVer(item.id));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = useCallback((rota: string) => {
    setOpen(false);
    navigate(rota);
  }, [navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[selectedIdx]) { handleSelect(results[selectedIdx].rota); }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={() => setOpen(false)}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.inputWrap}>
          <Search size={18} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Buscar página ou funcionalidade..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
          />
          <kbd className={styles.kbd}>ESC</kbd>
          <button className={styles.closeBtn} onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <div className={styles.results}>
          {results.length === 0 ? (
            <div className={styles.empty}>Nenhum resultado encontrado</div>
          ) : (
            results.map((item, idx) => (
              <button
                key={item.id}
                className={`${styles.resultItem} ${idx === selectedIdx ? styles.resultItemActive : ''}`}
                onClick={() => handleSelect(item.rota)}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                <span className={styles.resultIcon}>{item.icon}</span>
                <div className={styles.resultText}>
                  <span className={styles.resultLabel}>{item.label}</span>
                  <span className={styles.resultDesc}>{item.descricao}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
