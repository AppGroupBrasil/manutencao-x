import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

export async function gerarPdfDaTabela(
  titulo: string,
  colunas: string[],
  linhas: string[][],
  nomeArquivo: string
) {
  const pdf = new jsPDF('l', 'mm', 'a4');
  pdf.setFontSize(18);
  pdf.text(titulo, 14, 20);
  pdf.setFontSize(10);
  pdf.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);

  (pdf as any).autoTable({
    head: [colunas],
    body: linhas,
    startY: 34,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [26, 115, 232], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  pdf.save(`${nomeArquivo}.pdf`);
}

export async function gerarPdfDeElemento(elementIdOrEl: string | HTMLElement, nomeArquivo: string) {
  const el = typeof elementIdOrEl === 'string' ? document.getElementById(elementIdOrEl) : elementIdOrEl;
  if (!el) return;

  const canvas = await html2canvas(el, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('l', 'mm', 'a4');
  const w = pdf.internal.pageSize.getWidth();
  const h = (canvas.height * w) / canvas.width;
  pdf.addImage(imgData, 'PNG', 0, 0, w, h);
  pdf.save(`${nomeArquivo}.pdf`);
}

export function imprimirElemento(elementIdOrEl: string | HTMLElement) {
  const el = typeof elementIdOrEl === 'string' ? document.getElementById(elementIdOrEl) : elementIdOrEl;
  if (!el) return;

  const win = window.open('', '_blank');
  if (!win) return;

  win.document.write(`
    <html>
    <head>
      <title>Impressão</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #1a1a2e; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px 12px; border: 1px solid #e0e4e8; text-align: left; }
        th { background: #1a73e8; color: white; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>${el.innerHTML}</body>
    </html>
  `);
  win.document.close();
  win.print();
}

export async function compartilharConteudo(titulo: string, texto: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title: titulo, text: texto });
    } catch {
      copiarParaClipboard(texto);
    }
  } else {
    copiarParaClipboard(texto);
  }
}

function copiarParaClipboard(texto: string) {
  navigator.clipboard.writeText(texto).then(() => {
    alert('Conteúdo copiado para a área de transferência!');
  });
}
