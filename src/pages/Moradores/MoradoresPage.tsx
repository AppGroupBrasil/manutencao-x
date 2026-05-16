import React, { useState, useEffect, useRef } from 'react';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import {
  Plus, X, Pencil, Trash2, Upload, Download, Search,
  Building2, User, Home, FileSpreadsheet, Check, AlertCircle
} from 'lucide-react';
import { useDemo } from '../../contexts/DemoContext';
import { moradores as moradoresApi, condominios as condominiosApi } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import Pagination from '../../components/Common/Pagination';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { usePagination } from '../../hooks/usePagination';
import styles from './Moradores.module.css';

/* ============ Tipos ============ */
interface Morador {
  id: string;
  nome: string;
  condominioId: string;
  condominioNome: string;
  bloco: string;
  apartamento: string;
  whatsapp: string;
  email: string;
  perfil: string;
  criadoEm: string;
}

interface Condominio {
  id: string;
  nome: string;
}

const PERFIS = ['Proprietário', 'Inquilino', 'Dependente', 'Síndico', 'Funcionário'];

const formVazio = () => ({
  nome: '', condominioId: '', bloco: '', apartamento: '', whatsapp: '', email: '', perfil: '',
});

function normalizeImportCell(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/* ============ Componente ============ */
function parseCsvText(text: string): Record<string, unknown>[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim() !== '');
  if (lines.length === 0) return [];
  const splitRow = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if ((c === ',' || c === ';') && !inQuotes) {
        out.push(cur); cur = '';
      } else cur += c;
    }
    out.push(cur);
    return out;
  };
  const headers = splitRow(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = splitRow(line);
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    return row;
  });
}

async function parsePlanilha(file: File, ext: string): Promise<Record<string, unknown>[]> {
  if (ext === 'csv') {
    return parseCsvText(await file.text());
  }
  if (ext === 'xls') {
    throw new Error('Formato .xls antigo não suportado. Salve como .xlsx no Excel/LibreOffice e reenvie.');
  }
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => { headers[col - 1] = String(cell.value ?? '').trim(); });
  const rows: Record<string, unknown>[] = [];
  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      const v = row.getCell(i + 1).value;
      obj[h] = v == null ? '' : typeof v === 'object' && 'text' in (v as any) ? (v as any).text : v;
    });
    rows.push(obj);
  });
  return rows;
}

const MoradoresPage: React.FC = () => {
  const { tentarAcao } = useDemo();
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalImport, setModalImport] = useState(false);
  const [form, setForm] = useState(formVazio());
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroCond, setFiltroCond] = useState('');

  /* Import state */
  const [importData, setImportData] = useState<Record<string, string>[]>([]);
  const [importErro, setImportErro] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Carregar dados da API */
  useEffect(() => {
    Promise.all([moradoresApi.list(), condominiosApi.list()])
      .then(([m, c]) => {
        setMoradores(m as Morador[]);
        setCondominios(c.map((x: any) => ({ id: x.id, nome: x.nome })));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  /* Filter */
  const moradoresFiltrados = moradores.filter(m => {
    const matchBusca = !busca || m.nome.toLowerCase().includes(busca.toLowerCase()) ||
      m.bloco?.toLowerCase().includes(busca.toLowerCase()) ||
      m.apartamento?.toLowerCase().includes(busca.toLowerCase()) ||
      m.email?.toLowerCase().includes(busca.toLowerCase());
    const matchCond = !filtroCond || m.condominioNome === filtroCond || m.condominioId === filtroCond;
    return matchBusca && matchCond;
  });

  /* CRUD */
  const abrirNovo = () => {
    if (!tentarAcao()) return;
    setForm(formVazio());
    setEditandoId(null);
    setModalAberto(true);
  };
  const abrirEditar = (m: Morador) => {
    if (!tentarAcao()) return;
    setForm({ nome: m.nome, condominioId: m.condominioId, bloco: m.bloco, apartamento: m.apartamento, whatsapp: m.whatsapp, email: m.email, perfil: m.perfil });
    setEditandoId(m.id);
    setModalAberto(true);
  };
  const fecharModal = () => { setModalAberto(false); setEditandoId(null); };
  const fecharImport = () => { setModalImport(false); setImportData([]); setImportErro(''); };

  useEscapeKey(() => {
    if (modalImport) {
      fecharImport();
      return;
    }
    if (modalAberto) {
      fecharModal();
    }
  }, modalAberto || modalImport);

  const salvar = async () => {
    if (!form.nome.trim() || !form.condominioId) return;
    try {
      if (editandoId) {
        const updated = await moradoresApi.update(editandoId, form);
        setMoradores(prev => prev.map(m => m.id === editandoId ? (updated as Morador) : m));
      } else {
        const novo = await moradoresApi.create(form);
        setMoradores(prev => [...prev, novo as Morador]);
      }
      fecharModal();
    } catch (err) { console.error(err); }
  };

  const excluir = async (id: string) => {
    if (!tentarAcao()) return;
    try {
      await moradoresApi.remove(id);
      setMoradores(prev => prev.filter(m => m.id !== id));
      setConfirmDelete(null);
    } catch (err) { console.error(err); }
  };

  const setField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  /* ===== Import Excel/CSV ===== */
  const abrirImport = () => { setImportData([]); setImportErro(''); setModalImport(true); };

  const COLUNAS_ESPERADAS = ['nome', 'condominio', 'bloco', 'apartamento', 'whatsapp', 'email', 'perfil'];

  const processarArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extensao = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(extensao || '')) {
      setImportErro('Formato não suportado. Use .xlsx, .xls ou .csv');
      return;
    }

    try {
      const json = await parsePlanilha(file, extensao!);

      if (json.length === 0) {
        setImportErro('A planilha está vazia.');
        return;
      }

      /* Normalize headers */
      const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const headerMap: Record<string, string> = {};
      const rawHeaders = Object.keys(json[0]);
      for (const h of rawHeaders) {
        const n = normalize(h);
        if (n.includes('nome')) headerMap[h] = 'nome';
        else if (n.includes('condominio')) headerMap[h] = 'condominio';
        else if (n.includes('bloco')) headerMap[h] = 'bloco';
        else if (n.includes('apartamento') || n === 'apto' || n === 'apt') headerMap[h] = 'apartamento';
        else if (n.includes('whatsapp') || n.includes('telefone') || n.includes('celular') || n === 'fone') headerMap[h] = 'whatsapp';
        else if (n.includes('email') || n.includes('e-mail')) headerMap[h] = 'email';
        else if (n.includes('perfil') || n.includes('tipo')) headerMap[h] = 'perfil';
      }

      const colunasEncontradas = new Set(Object.values(headerMap));
      const faltando = COLUNAS_ESPERADAS.filter(c => !colunasEncontradas.has(c));
      if (faltando.includes('nome')) {
        setImportErro(`Coluna obrigatória faltando: nome. Cabeçalhos encontrados: ${rawHeaders.join(', ')}`);
        return;
      }

      const condominiosPorNome = new Map(
        condominios.map((condominio) => [condominio.nome.toLowerCase(), condominio])
      );
      const rows: Record<string, string>[] = json.map((row) => {
        const mapped: Record<string, string> = {};
        for (const [rawH, field] of Object.entries(headerMap)) {
          mapped[field] = normalizeImportCell(row[rawH]);
        }

        const condNome = mapped.condominio || '';
        const condMatch = condominiosPorNome.get(condNome.toLowerCase());
        return {
          nome: mapped.nome || '',
          condominioId: condMatch?.id || condominios[0]?.id || '',
          condominio: condNome,
          bloco: mapped.bloco || '',
          apartamento: mapped.apartamento || '',
          whatsapp: mapped.whatsapp || '',
          email: mapped.email || '',
          perfil: mapped.perfil || '',
        };
      }).filter((row) => row.nome.trim() !== '');

      if (rows.length === 0) {
        setImportErro('Nenhum registro válido encontrado na planilha.');
        return;
      }

      setImportData(rows);
      setImportErro('');
    } catch {
      setImportErro('Erro ao processar o arquivo. Verifique se é uma planilha válida.');
    }
    /* Reset input so same file can be re-selected */
    e.target.value = '';
  };

  const confirmarImport = async () => {
    try {
      const novos: Morador[] = [];
      for (const row of importData) {
        const created = await moradoresApi.create(row);
        novos.push(created as Morador);
      }
      setMoradores(prev => [...prev, ...novos]);
      fecharImport();
    } catch (err) { console.error(err); }
  };

  /* Download template */
  const baixarModelo = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Moradores');
    ws.addRow(['Nome', 'Condomínio', 'Bloco', 'Apartamento', 'WhatsApp', 'E-mail', 'Perfil']);
    ws.addRow(['João Silva', 'Condomínio Aurora', 'A', '101', '(11) 99999-0001', 'joao@email.com', 'Proprietário']);
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_moradores.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  /* Resumo por condomínio */
  const resumoPorCond = moradores.reduce<Record<string, number>>((acc, m) => {
    const nome = m.condominioNome || 'Sem condomínio';
    acc[nome] = (acc[nome] || 0) + 1;
    return acc;
  }, {});

  /* Resumo por perfil */
  const resumoPorPerfil = moradores.reduce<Record<string, number>>((acc, m) => {
    const p = m.perfil || 'Sem perfil';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  /* Export */
  const compartilhar = () => compartilharConteudo(
    'Cadastro de Moradores',
    moradores.map(m => `${m.nome} — ${m.condominioNome || ''} Bl.${m.bloco} Ap.${m.apartamento}`).join('\n')
  );
  const imprimir = () => imprimirElemento('moradores-content');
  const gerarPdf = () => gerarPdfDeElemento('moradores-content', 'moradores');

  /* ===== Condominios únicos presentes ===== */
  const condominiosUnicos = [...new Set(moradores.map(m => m.condominioNome).filter(Boolean))];

  const pag = usePagination(moradoresFiltrados, { pageSize: 20 });

  if (loading) return <LoadingSpinner texto="Carregando moradores..." />;

  return (
    <div id="moradores-content">
      <HowItWorks
        titulo="Cadastro de Moradores"
        descricao="Registre o moradores dos condomínios administrados."
        passos={[
          '👤 Cadastro Manual — Adicione moradores individualmente com todos os dados.',
          '📊 Importar Planilha — Importe moradores em lote via arquivo Excel ou CSV.',
          '🔍 Consulta Rápida — Busque e filtre moradores por condomínio, bloco ou nome.',
        ]}
      />

      <PageHeader
        titulo="Moradores"
        onCompartilhar={compartilhar}
        onImprimir={imprimir}
        onGerarPdf={gerarPdf}
      />

      {/* Resumo cards */}
      <div className={styles.resumoGrid}>
        <Card>
          <div className={styles.resumoCard}>
            <User size={24} />
            <div>
              <span className={styles.resumoNum}>{moradores.length}</span>
              <span className={styles.resumoLabel}>Total de Moradores</span>
            </div>
          </div>
        </Card>
        <Card>
          <div className={styles.resumoCard}>
            <Building2 size={24} />
            <div>
              <span className={styles.resumoNum}>{condominiosUnicos.length}</span>
              <span className={styles.resumoLabel}>Condomínios</span>
            </div>
          </div>
        </Card>
        <Card>
          <div className={styles.resumoCard}>
            <Home size={24} />
            <div>
              <span className={styles.resumoNum}>{Object.keys(resumoPorPerfil).length}</span>
              <span className={styles.resumoLabel}>Perfis</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Ações + filtro */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por nome, bloco, apartamento..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <select
          className={styles.filtroSelect}
          value={filtroCond}
          onChange={e => setFiltroCond(e.target.value)}
        >
          <option value="">Todos os condomínios</option>
          {condominiosUnicos.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className={styles.toolbarBtns}>
          <button className={styles.addBtn} onClick={abrirNovo}>
            <Plus size={16} /> Cadastrar
          </button>
          <button className={styles.importBtn} onClick={abrirImport}>
            <Upload size={16} /> Importar Planilha
          </button>
        </div>
      </div>

      {/* Tabela */}
      <Card>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Condomínio</th>
                <th>Bloco</th>
                <th>Apto</th>
                <th>WhatsApp</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {moradoresFiltrados.length === 0 ? (
                <tr><td colSpan={8} className={styles.empty}>Nenhum morador encontrado.</td></tr>
              ) : (
                pag.items.map(m => (
                  <tr key={m.id}>
                    <td className={styles.cellNome}>{m.nome}</td>
                    <td>{m.condominioNome}</td>
                    <td>{m.bloco}</td>
                    <td>{m.apartamento}</td>
                    <td>{m.whatsapp}</td>
                    <td>{m.email}</td>
                    <td><span className={styles.perfilBadge}>{m.perfil || '—'}</span></td>
                    <td>
                      <div className={styles.cellActions}>
                        <button className={styles.actionBtn} onClick={() => abrirEditar(m)} title="Editar">
                          <Pencil size={14} />
                        </button>
                        {confirmDelete === m.id ? (
                          <>
                            <button className={styles.actionBtnDanger} onClick={() => excluir(m.id)} title="Confirmar"><Check size={14} /></button>
                            <button className={styles.actionBtn} onClick={() => setConfirmDelete(null)} title="Cancelar"><X size={14} /></button>
                          </>
                        ) : (
                          <button className={styles.actionBtnDanger} onClick={() => setConfirmDelete(m.id)} title="Excluir">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Pagination page={pag.page} totalPages={pag.totalPages} totalItems={pag.totalItems} pageSize={pag.pageSize} onPageChange={pag.goToPage} hasNext={pag.hasNext} hasPrev={pag.hasPrev} />

      {/* Resumo por condomínio */}
      {Object.keys(resumoPorCond).length > 0 && (
        <div className={styles.resumoSection}>
          <h3 className={styles.resumoSectionTitle}>Moradores por Condomínio</h3>
          <div className={styles.resumoChips}>
            {Object.entries(resumoPorCond).map(([cond, qt]) => (
              <span key={cond} className={styles.chip}>
                <Building2 size={14} /> {cond}: <strong>{qt}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ===== Modal Cadastro Manual ===== */}
      {modalAberto && (
        <div className={styles.overlay} onClick={fecharModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editandoId ? 'Editar Morador' : 'Cadastrar Morador'}</h3>
              <button className={styles.modalClose} onClick={fecharModal}><X size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Nome *</label>
                <input value={form.nome} onChange={e => setField('nome', e.target.value)} placeholder="Nome completo" />
              </div>
              <div className={styles.formGroup}>
                <label>Condomínio *</label>
                <select value={form.condominioId} onChange={e => setField('condominioId', e.target.value)}>
                  <option value="">Selecione...</option>
                  {condominios.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Bloco</label>
                  <input value={form.bloco} onChange={e => setField('bloco', e.target.value)} placeholder="Ex: A" />
                </div>
                <div className={styles.formGroup}>
                  <label>Apartamento</label>
                  <input value={form.apartamento} onChange={e => setField('apartamento', e.target.value)} placeholder="Ex: 101" />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>WhatsApp</label>
                  <input value={form.whatsapp} onChange={e => setField('whatsapp', e.target.value)} placeholder="(11) 99999-0000" />
                </div>
                <div className={styles.formGroup}>
                  <label>E-mail</label>
                  <input type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="email@exemplo.com" />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Perfil</label>
                <select value={form.perfil} onChange={e => setField('perfil', e.target.value)}>
                  <option value="">Selecione...</option>
                  {PERFIS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancelar} onClick={fecharModal}>Cancelar</button>
              <button className={styles.btnSalvar} onClick={salvar} disabled={!form.nome.trim() || !form.condominioId}>
                {editandoId ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal Importação ===== */}
      {modalImport && (
        <div className={styles.overlay} onClick={fecharImport}>
          <div className={styles.modalLarge} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Importar Moradores via Planilha</h3>
              <button className={styles.modalClose} onClick={fecharImport}><X size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.importDesc}>
                Faça upload de um arquivo <strong>.xlsx</strong>, <strong>.xls</strong> ou <strong>.csv</strong> com as colunas:
                <br /><em>Nome, Condomínio, Bloco, Apartamento, WhatsApp, E-mail, Perfil</em>
              </p>

              <div className={styles.importActions}>
                <button className={styles.modeloBtn} onClick={baixarModelo}>
                  <Download size={16} /> Baixar Modelo
                </button>
                <label className={styles.uploadLabel}>
                  <FileSpreadsheet size={16} /> Selecionar Arquivo
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={processarArquivo}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {importErro && (
                <div className={styles.importErro}>
                  <AlertCircle size={16} /> {importErro}
                </div>
              )}

              {importData.length > 0 && (
                <>
                  <p className={styles.importPreviewTitle}>
                    <Check size={16} /> {importData.length} registro(") encontrado(") — prévia:
                  </p>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Nome</th>
                          <th>Condomínio</th>
                          <th>Bloco</th>
                          <th>Apto</th>
                          <th>WhatsApp</th>
                          <th>E-mail</th>
                          <th>Perfil</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importData.slice(0, 10).map((row, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td>{row.nome}</td>
                            <td>{row.condominio}</td>
                            <td>{row.bloco}</td>
                            <td>{row.apartamento}</td>
                            <td>{row.whatsapp}</td>
                            <td>{row.email}</td>
                            <td>{row.perfil}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importData.length > 10 && (
                    <p className={styles.importMore}>...e mais {importData.length - 10} registro(s).</p>
                  )}
                </>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancelar} onClick={fecharImport}>Cancelar</button>
              <button
                className={styles.btnSalvar}
                onClick={confirmarImport}
                disabled={importData.length === 0}
              >
                Importar {importData.length} Morador(es)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoradoresPage;
