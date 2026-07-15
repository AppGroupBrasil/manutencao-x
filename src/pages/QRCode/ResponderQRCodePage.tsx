import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, QrCode } from 'lucide-react';
import ResponderFormulario from './ResponderFormulario';
import type { QRCodeFormulario, Identificacao, RespostaBlocos } from './ResponderFormulario';
import { qrcodesPublic } from '../../services/api';

const wrapStyle: React.CSSProperties = { minHeight: '100vh', background: '#f5f7fa', padding: '24px 12px' };
const cardStyle: React.CSSProperties = { maxWidth: 560, margin: '0 auto', background: '#fff', borderRadius: 12, padding: '20px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' };

const ResponderQRCodePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [formulario, setFormulario] = useState<QRCodeFormulario | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!id) { setErro('Formulário não encontrado.'); setCarregando(false); return; }
    qrcodesPublic.get(id)
      .then((data: any) => setFormulario({ ...data, blocos: data.blocos || [], blocosCadastrados: data.blocosCadastrados || [] }))
      .catch((err: any) => setErro(err?.message || 'Formulário não encontrado.'))
      .finally(() => setCarregando(false));
  }, [id]);

  const enviar = async (identificacao: Identificacao, respostas: RespostaBlocos) => {
    if (!id || !formulario) return;
    try {
      await qrcodesPublic.addResposta(id, { qrcodeNome: formulario.nome, identificacao, respostas });
    } catch (err: any) {
      throw new Error(err?.message || 'Não foi possível enviar. Verifique sua conexão e tente novamente.');
    }
  };

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        {carregando && <p style={{ textAlign: 'center', padding: 24 }}>Carregando formulário...</p>}

        {!carregando && (erro || !formulario) && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <AlertTriangle size={40} color="#d32f2f" />
            <h3 style={{ margin: '12px 0 6px' }}>Formulário indisponível</h3>
            <p style={{ color: '#666', margin: 0 }}>{erro || 'Formulário não encontrado.'}</p>
          </div>
        )}

        {!carregando && !erro && formulario && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <QrCode size={22} color="#f57c00" />
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{formulario.nome}</h2>
            </div>
            <ResponderFormulario formulario={formulario} onEnviar={enviar} />
          </>
        )}
      </div>
    </div>
  );
};

export default ResponderQRCodePage;
