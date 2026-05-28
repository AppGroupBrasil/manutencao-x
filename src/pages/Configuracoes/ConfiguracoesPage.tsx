import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { validarImagem } from '../../utils/imageUtils';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import { CORES_DISPONIVEIS } from '../../types';
import { Palette, Moon, Sun, Upload, Check, Monitor, QrCode, Printer } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useDemo } from '../../contexts/DemoContext';
import styles from './Configuracoes.module.css';

const FUNCOES_QR: { id: string; label: string; rota: string }[] = [
  { id: 'dashboard', label: 'Dashboard', rota: '/dashboard' },
  { id: 'quadro-atividades', label: 'Quadro de Atividades', rota: '/quadro-atividades' },
  { id: 'ordens', label: 'Ordens de Serviço', rota: '/ordens-servico' },
  { id: 'checklists', label: 'Checklists', rota: '/checklists' },
  { id: 'vistorias', label: 'Vistorias', rota: '/vistorias' },
  { id: 'reportes', label: 'Reportes', rota: '/reportes' },
  { id: 'tarefas', label: 'Tarefas Agendadas', rota: '/tarefas' },
  { id: 'roteiros', label: 'Roteiro de Execução', rota: '/roteiros' },
  { id: 'materiais', label: 'Controle de Estoque', rota: '/materiais' },
  { id: 'leitor-qrcode', label: 'Leitor QR Code', rota: '/leitor-qrcode' },
  { id: 'escalas', label: 'Escalas', rota: '/escalas' },
  { id: 'vencimentos', label: 'Agenda de Vencimentos', rota: '/vencimentos' },
  { id: 'inspecoes', label: 'Inspeções', rota: '/inspecoes' },
  { id: 'comunicados', label: 'Comunicados / Avisos', rota: '/comunicados' },
  { id: 'moradores', label: 'Cadastro de Moradores', rota: '/moradores' },
  { id: 'condominios', label: 'Condomínios', rota: '/condominios' },
  { id: 'usuarios', label: 'Cadastro de Usuários', rota: '/usuarios' },
  { id: 'geolocalizacao', label: 'Geolocalização', rota: '/geolocalizacao' },
  { id: 'relatorios', label: 'Relatórios', rota: '/relatorios' },
  { id: 'configuracoes', label: 'Configurações', rota: '/configuracoes' },
];

const ConfiguracoesPage: React.FC = () => {
  const { usuario } = useAuth();
  const { tema, atualizarTema, toggleModoEscuro } = useTheme();
  const { podeGerenciarTema, podeAlterarLogo } = usePermissions();
  const { tentarAcao } = useDemo();
  const fileRef = useRef<HTMLInputElement>(null);
  const qrPrintRef = useRef<HTMLDivElement>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const imprimirQRCodes = useCallback(() => {
    const el = qrPrintRef.current;
    if (!el) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>QR Codes - Funções</title><style>
      @page { size: A4 portrait; margin: 10mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #222; }
      .titulo { text-align: center; font-size: 18px; font-weight: 700; padding: 14px 0 4px; }
      .subtitulo { text-align: center; font-size: 11px; color: #888; margin-bottom: 12px; }
      .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 0 4px; }
      .item { border: 1.5px solid #ddd; border-radius: 8px; padding: 8px 4px 10px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
      .item canvas, .item img { width: 90px !important; height: 90px !important; }
      .item span { font-size: 9px; font-weight: 600; text-align: center; line-height: 1.2; }
      .item small { font-size: 7px; color: #999; word-break: break-all; text-align: center; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body>`);
    win.document.write(`<div class="titulo">QR Codes — Acesso Rápido às Funções</div>`);
    win.document.write(`<div class="subtitulo">Escaneie o QR Code para acessar a função diretamente no celular</div>`);
    const grid = win.document.createElement('div');
    grid.className = 'grid';
    el.querySelectorAll('[data-qr-item]').forEach(item => {
      const clone = item.cloneNode(true) as HTMLElement;
      // converter canvas para img para garantir renderização na nova janela
      clone.querySelectorAll('canvas').forEach(c => {
        const img = win.document.createElement('img');
        try { img.src = (c as HTMLCanvasElement).toDataURL('image/png'); } catch { /* tainted */ }
        c.replaceWith(img);
      });
      grid.append(win.document.adoptNode(clone));
    });
    win.document.body.append(grid);
    win.document.write('</body></html>');
    win.document.close();
    setTimeout(() => { win.print(); }, 400);
  }, []);

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!tentarAcao()) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const erro = validarImagem(file);
    if (erro) { alert(erro); return; }
    const reader = new FileReader();
    reader.onload = () => {
      atualizarTema({ logoUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const corSections: { label: string; key: keyof typeof tema; desc: string }[] = [
    { label: 'Cor Primária', key: 'corPrimaria', desc: 'Cor principal para botões, links e destaques' },
    { label: 'Cor Secundária', key: 'corSecundaria', desc: 'Cor secundária para accents' },
    { label: 'Cor do Menu', key: 'corMenu', desc: 'Cor de fundo do menu lateral' },
    { label: 'Cor dos Botões', key: 'corBotao', desc: 'Cor de fundo dos botões de ação' },
  ];

  return (
    <div id="config-content">
      <HowItWorks
        titulo="Configuraçõe do Sistema"
        descricao="Personalize a aparência do sistema escolhendo core para menus, botões e fundo. O Master pode alterar a logo da tela de login."
        passos={[
          'Escolha as cores do tema clicando nas opções disponíveis',
          'Cores aplicadas: menu lateral, botões, destaque e fundo',
          'Alterne entre modo claro e escuro para o fundo da página',
          'Funcionários e supervisores navegam pelo dashboard sem menu lateral',
          'O usuário Master pode alterar a logo da tela de login',
          'As alterações são salvas automaticamente',
        ]}
      />

      <PageHeader
        titulo="Configurações"
        subtitulo="Personalize a aparência do sistema"
        onCompartilhar={() => compartilharConteudo('Configurações', 'Configurações do tema')}
        onImprimir={() => imprimirElemento('config-content')}
        onGerarPdf={() => gerarPdfDeElemento('config-content', 'configuracoes')}
      />

      {/* Modo Escuro */}
      <Card padding="md">
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Monitor size={20} />
            <div>
              <h3>Modo de Exibição</h3>
              <p>Escolha entre fundo branco ou escuro</p>
            </div>
          </div>
          <div className={styles.modeToggle}>
            <button
              className={`${styles.modeBtn} ${!tema.modoEscuro ? styles.modeActive : ''}`}
              onClick={() => tema.modoEscuro && toggleModoEscuro()}
            >
              <Sun size={18} />
              <span>Claro</span>
            </button>
            <button
              className={`${styles.modeBtn} ${tema.modoEscuro ? styles.modeActive : ''}`}
              onClick={() => !tema.modoEscuro && toggleModoEscuro()}
            >
              <Moon size={18} />
              <span>Escuro</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Cores do Tema */}
      {podeGerenciarTema() && (
        <div style={{ marginTop: '1cm' }}>
          {corSections.map(sec => (
            <Card key={sec.key} padding="md">
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <Palette size={20} />
                  <div>
                    <h3>{sec.label}</h3>
                    <p>{sec.desc}</p>
                  </div>
                  <div className={styles.currentColor} style={{ background: tema[sec.key] as string }} />
                </div>
                <div className={styles.colorGrid}>
                  {CORES_DISPONIVEIS.map(cor => (
                    <button
                      key={cor.valor}
                      className={`${styles.colorBtn} ${tema[sec.key] === cor.valor ? styles.colorActive : ''}`}
                      style={{ background: cor.valor }}
                      onClick={() => atualizarTema({ [sec.key]: cor.valor })}
                      title={cor.nome}
                    >
                      {tema[sec.key] === cor.valor && <Check size={16} color="white" />}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Textos da Tela de Login */}
      {podeAlterarLogo() && (
        <div style={{ marginTop: '1cm' }}>
          <Card padding="md">
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <Upload size={20} />
                <div>
                  <h3>Textos da Tela de Login</h3>
                  <p>Personalize o título e subtítulo exibidos na tela de login</p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cor-texto-secundario)' }}>Título</label>
                  <input
                    type="text"
                    value={tema.loginTitulo || ''}
                    onChange={e => atualizarTema({ loginTitulo: e.target.value || undefined })}
                    placeholder="Manutenção X"
                    style={{ padding: '10px 14px', border: '2px solid var(--cor-borda)', borderRadius: 10, fontSize: 13.5, color: 'var(--cor-texto)', background: 'var(--cor-superficie)', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cor-texto-secundario)' }}>Subtítulo</label>
                  <input
                    type="text"
                    value={tema.loginSubtitulo || ''}
                    onChange={e => atualizarTema({ loginSubtitulo: e.target.value || undefined })}
                    placeholder="Faça login para acessar o sistema"
                    style={{ padding: '10px 14px', border: '2px solid var(--cor-borda)', borderRadius: 10, fontSize: 13.5, color: 'var(--cor-texto)', background: 'var(--cor-superficie)', outline: 'none' }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Logo */}
      {podeAlterarLogo() && (
        <div style={{ marginTop: '1cm' }}>
          <Card padding="md">
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <Upload size={20} />
                <div>
                  <h3>Logo da Empresa</h3>
                  <p>Altere a logo exibida na tela de login (apenas Master)</p>
                </div>
              </div>
              <div className={styles.logoSection}>
                {tema.logoUrl && (
                  <img src={tema.logoUrl} alt="Logo atual" className={styles.logoPreview} />
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogo}
                  style={{ display: 'none' }}
                />
                <button className={styles.uploadBtn} onClick={() => fileRef.current?.click()}>
                  <Upload size={16} />
                  {tema.logoUrl ? 'Alterar Logo' : 'Enviar Logo'}
                </button>
                {tema.logoUrl && (
                  <button className={styles.removeBtn} onClick={() => atualizarTema({ logoUrl: undefined })}>
                    Remover Logo
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* QR Codes das Funções */}
      <div style={{ marginTop: '1cm' }}>
        <Card padding="md">
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <QrCode size={20} />
              <div>
                <h3>QR Codes das Funções</h3>
                <p>Cada QR Code leva o funcionário direto para a função ao escanear</p>
              </div>
              <button className={styles.uploadBtn} style={{ marginLeft: 'auto' }} onClick={imprimirQRCodes}>
                <Printer size={16} /> Imprimir Folha A4
              </button>
            </div>
            <div className={styles.qrGrid} ref={qrPrintRef}>
              {FUNCOES_QR.map(f => (
                <div key={f.id} className={styles.qrItem} data-qr-item>
                  <QRCodeCanvas value={`${baseUrl}${f.rota}`} size={100} level="M" includeMargin={false} />
                  <span className={styles.qrLabel}>{f.label}</span>
                  <small className={styles.qrUrl}>{f.rota}</small>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Preview */}
      <div style={{ marginTop: '1cm' }}>
        <Card padding="md">
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px' }}>Preview do Tema</h3>
          <div className={styles.preview}>
            <div className={styles.previewBox} style={{ background: tema.corPrimaria, color: 'white' }}>Primária</div>
            <div className={styles.previewBox} style={{ background: tema.corSecundaria, color: 'white' }}>Secundária</div>
            <div className={styles.previewBox} style={{ background: tema.corMenu, color: 'white' }}>Menu</div>
            <div className={styles.previewBox} style={{ background: tema.corBotao, color: 'white' }}>Botão</div>
            <button className={styles.previewBtn} style={{ background: tema.corBotao }}>Botão de Exemplo</button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ConfiguracoesPage;
