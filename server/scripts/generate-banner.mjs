import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';

const W = 1024;
const H = 500;

// Paleta extraída da logo: azul petroleum escuro
const BG_DARK = '#1e3a4c';
const BG_DARK2 = '#15293a';
const BLUE_GRAD_1 = '#2b5d7a';
const BLUE_GRAD_2 = '#4a87a8';
const WHITE = '#ffffff';

// Decorative QR-like grid pattern (não funcional, só visual)
function qrPattern(x, y, size, cell = 5) {
  const cells = Math.floor(size / cell);
  let svg = '';
  // Pseudo-random mas determinístico
  let seed = 7;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      if (rand() > 0.5) {
        svg += `<rect x="${x + i * cell}" y="${y + j * cell}" width="${cell}" height="${cell}" fill="${WHITE}" opacity="0.85"/>`;
      }
    }
  }
  // Cantos típicos do QR (finder patterns)
  const fp = (cx, cy) => {
    const s = cell * 7;
    return `
      <rect x="${cx}" y="${cy}" width="${s}" height="${s}" fill="${WHITE}"/>
      <rect x="${cx + cell}" y="${cy + cell}" width="${s - 2 * cell}" height="${s - 2 * cell}" fill="${BG_DARK}"/>
      <rect x="${cx + 2 * cell}" y="${cy + 2 * cell}" width="${s - 4 * cell}" height="${s - 4 * cell}" fill="${WHITE}"/>
    `;
  };
  svg += fp(x, y);
  svg += fp(x + size - cell * 7, y);
  svg += fp(x, y + size - cell * 7);
  return svg;
}

const QR_SIZE = 220;
const QR_LEFT = 30;
const QR_RIGHT = W - 30 - QR_SIZE;

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BG_DARK}"/>
      <stop offset="100%" stop-color="${BG_DARK2}"/>
    </linearGradient>
    <linearGradient id="band" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${BLUE_GRAD_1}"/>
      <stop offset="50%" stop-color="${BLUE_GRAD_2}"/>
      <stop offset="100%" stop-color="${BLUE_GRAD_1}"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="6"/>
      <feOffset dx="0" dy="6" result="offsetblur"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Fundo -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- QR decorativos laterais (fora da área segura) -->
  <g opacity="0.18">
    ${qrPattern(QR_LEFT, (H - QR_SIZE) / 2, QR_SIZE)}
    ${qrPattern(QR_RIGHT, (H - QR_SIZE) / 2, QR_SIZE)}
  </g>

  <!-- Faixa do título -->
  <rect x="${(W - 720) / 2}" y="${H / 2 - 75}" width="720" height="110" rx="10" fill="url(#band)" filter="url(#shadow)"/>

  <text x="${W / 2}" y="${H / 2 + 8}" font-family="Arial Black, Helvetica, sans-serif" font-weight="900"
        font-size="68" fill="${WHITE}" text-anchor="middle" letter-spacing="3">APP INTERFONE</text>

  <!-- Subtítulo -->
  <text x="${W / 2}" y="${H / 2 + 95}" font-family="Arial, Helvetica, sans-serif" font-weight="400"
        font-size="22" fill="${WHITE}" text-anchor="middle" opacity="0.92" letter-spacing="2">
    O INTERFONE DO SEU CONDOMÍNIO NO CELULAR
  </text>

  <!-- Tagline inferior -->
  <text x="${W / 2}" y="${H - 35}" font-family="Arial, Helvetica, sans-serif" font-weight="700"
        font-size="16" fill="${WHITE}" text-anchor="middle" opacity="0.7" letter-spacing="4">
    CHAMADAS • QR CODE • MORADORES • VISITANTES
  </text>
</svg>
`;

const out = 'C:/Users/HP/OneDrive/Área de Trabalho/feature-graphic-appinterfone.png';

await sharp(Buffer.from(svg))
  .png()
  .resize(W, H)
  .toFile(out);

console.log('OK:', out, fs.statSync(out).size, 'bytes');
