import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { qrcodes as qrcodesApi } from '../../services/api';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento } from '../../utils/exportUtils';
import { Camera, QrCode, Upload, X, ExternalLink, CheckCircle, MapPin, Clock, User, Navigation, Trash2 } from 'lucide-react';
import styles from './LeitorQRCode.module.css';

interface LeituraInfo {
  qrConteudo: string;
  funcionario: { nome: string; email: string; cargo?: string; perfil: string };
  dataHora: string;
  geolocalizacao: { latitude: number; longitude: number } | null;
  endereco: string | null;
  timestamp: number;
}



const formatarData = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const PERFIL_LABEL: Record<string, string> = {
  master: 'Master',
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  funcionario: 'Funcionário',
};

const LeitorQRCodePage: React.FC = () => {
  const { usuario } = useAuth();
  const [modo, setModo] = useState<'camera' | 'upload' | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [leituraAtual, setLeituraAtual] = useState<LeituraInfo | null>(null);
  const [carregandoGeo, setCarregandoGeo] = useState(false);
  const [historico, setHistorico] = useState<LeituraInfo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    qrcodesApi.leituras().then((data: any[]) => {
      setHistorico(data.map((r: any) => ({
        qrConteudo: r.qrConteudo,
        funcionario: { nome: r.funcionarioNome, email: r.funcionarioEmail, cargo: r.funcionarioCargo, perfil: '' },
        dataHora: r.dataHora,
        geolocalizacao: r.latitude ? { latitude: r.latitude, longitude: r.longitude } : null,
        endereco: r.endereco,
        timestamp: new Date(r.dataHora).getTime(),
      })));
    }).catch(() => {});
  }, []);

  /* ── Capturar dados ao detectar QR ── */
  const capturarDados = async (conteudo: string) => {
    setCarregandoGeo(true);
    const agora = new Date();

    const leitura: LeituraInfo = {
      qrConteudo: conteudo,
      funcionario: {
        nome: usuario?.nome || 'Desconhecido',
        email: usuario?.email || '',
        cargo: usuario?.cargo,
        perfil: PERFIL_LABEL[usuario?.role || 'funcionario'] || usuario?.role || '',
      },
      dataHora: agora.toISOString(),
      geolocalizacao: null,
      endereco: null,
      timestamp: agora.getTime(),
    };

    // Geolocalização
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });
      leitura.geolocalizacao = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };

      // Geocodificação reversa
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=18&addressdetails=1`,
          { headers: { 'Accept-Language': 'pt-BR' } }
        );
        if (resp.ok) {
          const data = await resp.json();
          leitura.endereco = data.display_name || null;
        }
      } catch {
        // Sem endereço, mas temos coordenadas
      }
    } catch {
      // Geolocalização não disponível, continua sem
    }

    try {
      await qrcodesApi.addLeitura({
        qrConteudo: conteudo,
        funcionarioNome: leitura.funcionario.nome,
        funcionarioEmail: leitura.funcionario.email,
        funcionarioCargo: leitura.funcionario.cargo,
        latitude: leitura.geolocalizacao?.latitude,
        longitude: leitura.geolocalizacao?.longitude,
        endereco: leitura.endereco,
      });
    } catch {}
    setHistorico(prev => [leitura, ...prev]);
    setLeituraAtual(leitura);
    setCarregandoGeo(false);
  };

  /* ── Iniciar câmera ── */
  const iniciarCamera = async () => {
    setErro(null);
    setResultado(null);
    setLeituraAtual(null);
    setModo('camera');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch {
      setErro('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
      setModo(null);
    }
  };

  /* ── Parar câmera ── */
  const pararCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setModo(null);
  };

  /* ── Escanear frame do vídeo ── */
  useEffect(() => {
    if (modo !== 'camera' || !stream) return;

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        detector.detect(imageData).then((barcodes: any[]) => {
          if (barcodes.length > 0) {
            const valor = barcodes[0].rawValue;
            setResultado(valor);
            pararCamera();
            capturarDados(valor);
          }
        }).catch(() => {});
      }
    };

    scanIntervalRef.current = window.setInterval(scanFrame, 500);
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [modo, stream]);

  /* ── Limpar câmera ao desmontar ── */
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, []);

  /* ── Upload de imagem ── */
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setModo('upload');
    setErro(null);
    setResultado(null);
    setLeituraAtual(null);

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        detector.detect(canvas).then((barcodes: any[]) => {
          if (barcodes.length > 0) {
            const valor = barcodes[0].rawValue;
            setResultado(valor);
            capturarDados(valor);
          } else {
            setErro('Nenhum QR Code encontrado na imagem. Tente outra imagem.');
          }
        }).catch(() => {
          setErro('Erro ao processar a imagem.');
        });
      } else {
        setErro('Seu navegador não suporta leitura de QR Code. Use o Google Chrome ou Microsoft Edge.');
      }
    };
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  };

  /* ── Abrir URL ── */
  const abrirResultado = () => {
    if (!resultado) return;
    try {
      new URL(resultado);
      window.open(resultado, '_blank', 'noopener,noreferrer');
    } catch {
      // Não é URL válida
    }
  };

  const ehUrl = resultado ? (() => { try { new URL(resultado); return true; } catch { return false; } })() : false;

  const resetar = () => {
    pararCamera();
    setResultado(null);
    setLeituraAtual(null);
    setErro(null);
    setModo(null);
  };

  const limparHistorico = () => {
    setHistorico([]);
  };

  return (
    <div id="leitor-qrcode-content">
      <HowItWorks
        titulo="Leitor de QR Code"
        descricao="Escaneie QR Code usando a câmera do dispositivo ou fazendo upload de uma imagem. O sistema captura automaticamente a identificação, localização, data e hora."
        passos={[
          'Escolha entre usar a câmera ou enviar uma imagem com QR Code',
          'Aponte a câmera para o QR Code ou selecione a imagem',
          'O sistema detecta o QR Code e captura: funcionário, localização, data/hora',
          'Todas as leituras ficam registradas no histórico',
        ]}
      />

      <PageHeader
        titulo="Leitor de QR Code"
        subtitulo="Escaneie QR Codes"
        onCompartilhar={() => compartilharConteudo('Leitor QR Code', 'Leitor de QR Code')}
        onImprimir={() => imprimirElemento('leitor-qrcode-content')}
        onGerarPdf={() => gerarPdfDeElemento('leitor-qrcode-content', 'leitor-qrcode')}
      />

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Carregando geolocalização */}
      {carregandoGeo && (
        <div className={styles.carregandoGeo}>
          <div className={styles.spinner} />
          <p>Capturando localização e dados...</p>
        </div>
      )}

      {/* Resultado com dados capturados */}
      {resultado && leituraAtual && !carregandoGeo && (
        <div className={styles.resultadoCard}>
          <div className={styles.resultadoIcone}>
            <CheckCircle size={40} />
          </div>
          <h4>QR Code detectado!</h4>
          <div className={styles.resultadoTexto}>
            <code>{resultado}</code>
          </div>

          {/* Dados capturados */}
          <div className={styles.dadosCapturados}>
            <div className={styles.dadoItem}>
              <User size={16} />
              <div>
                <strong>Funcionário</strong>
                <span>{leituraAtual.funcionario.nome}</span>
                <span className={styles.dadoSub}>{leituraAtual.funcionario.email} · {leituraAtual.funcionario.perfil}{leituraAtual.funcionario.cargo ? ` · ${leituraAtual.funcionario.cargo}` : ''}</span>
              </div>
            </div>
            <div className={styles.dadoItem}>
              <Clock size={16} />
              <div>
                <strong>Data e Hora</strong>
                <span>{formatarData(leituraAtual.dataHora)}</span>
              </div>
            </div>
            <div className={styles.dadoItem}>
              <MapPin size={16} />
              <div>
                <strong>Geolocalização</strong>
                {leituraAtual.geolocalizacao ? (
                  <span>{leituraAtual.geolocalizacao.latitude.toFixed(6)}, {leituraAtual.geolocalizacao.longitude.toFixed(6)}</span>
                ) : (
                  <span className={styles.dadoIndisponivel}>Não disponível</span>
                )}
              </div>
            </div>
            <div className={styles.dadoItem}>
              <Navigation size={16} />
              <div>
                <strong>Endereço</strong>
                {leituraAtual.endereco ? (
                  <span>{leituraAtual.endereco}</span>
                ) : (
                  <span className={styles.dadoIndisponivel}>{leituraAtual.geolocalizacao ? 'Endereço não encontrado' : 'Não disponível'}</span>
                )}
              </div>
            </div>
          </div>

          <div className={styles.resultadoAcoes}>
            {ehUrl && (
              <button className={styles.btnAbrir} onClick={abrirResultado}>
                <ExternalLink size={16} /> Abrir Link
              </button>
            )}
            <button className={styles.btnNovo} onClick={resetar}>
              <QrCode size={16} /> Escanear Outro
            </button>
          </div>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div className={styles.erroCard}>
          <p>{erro}</p>
          <button className={styles.btnNovo} onClick={resetar}>Tentar Novamente</button>
        </div>
      )}

      {/* Seleção de modo */}
      {!resultado && !modo && !carregandoGeo && (
        <>
          <div className={styles.modoGrid}>
            <button className={styles.modoCard} onClick={iniciarCamera}>
              <div className={styles.modoIcone}>
                <Camera size={40} />
              </div>
              <h4>Usar Câmera</h4>
              <p>Aponte a câmera para o QR Code</p>
            </button>
            <button className={styles.modoCard} onClick={() => fileInputRef.current?.click()}>
              <div className={styles.modoIcone}>
                <Upload size={40} />
              </div>
              <h4>Enviar Imagem</h4>
              <p>Faça upload de uma imagem com QR Code</p>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleUpload} />
          </div>

          {/* Histórico de leituras */}
          {historico.length > 0 && (
            <div className={styles.historicoSection}>
              <div className={styles.historicoHeader}>
                <h3>Histórico de Leituras</h3>
                <button className={styles.btnLimpar} onClick={limparHistorico}>
                  <Trash2 size={14} /> Limpar
                </button>
              </div>
              <div className={styles.historicoLista}>
                {historico.map((l, i) => (
                  <div key={l.timestamp + '-' + i} className={styles.historicoItem}>
                    <div className={styles.historicoQr}>
                      <QrCode size={16} />
                      <code>{l.qrConteudo.length > 60 ? l.qrConteudo.slice(0, 60) + '...' : l.qrConteudo}</code>
                    </div>
                    <div className={styles.historicoDetalhes}>
                      <span><User size={12} /> {l.funcionario.nome}</span>
                      <span><Clock size={12} /> {formatarData(l.dataHora)}</span>
                      <span><MapPin size={12} /> {l.endereco ? (l.endereco.length > 50 ? l.endereco.slice(0, 50) + '...' : l.endereco) : (l.geolocalizacao ? `${l.geolocalizacao.latitude.toFixed(4)}, ${l.geolocalizacao.longitude.toFixed(4)}` : 'Sem localização')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Câmera ativa */}
      {modo === 'camera' && !resultado && (
        <div className={styles.cameraArea}>
          <div className={styles.cameraWrapper}>
            <video ref={videoRef} className={styles.cameraVideo} playsInline muted />
            <div className={styles.cameraScanLine} />
            <div className={styles.cameraOverlay}>
              <div className={styles.cameraCorner} data-pos="tl" />
              <div className={styles.cameraCorner} data-pos="tr" />
              <div className={styles.cameraCorner} data-pos="bl" />
              <div className={styles.cameraCorner} data-pos="br" />
            </div>
          </div>
          <p className={styles.cameraHint}>Posicione o QR Code dentro da área de leitura</p>
          <button className={styles.btnCancelar} onClick={pararCamera}>
            <X size={16} /> Cancelar
          </button>
        </div>
      )}
    </div>
  );
};

export default LeitorQRCodePage;
