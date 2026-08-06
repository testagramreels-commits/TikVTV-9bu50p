import type { IPTVChannel } from '@/types';

interface Props {
  channel: IPTVChannel;
  onClose: () => void;
}

/**
 * Generates a branded share card using Canvas API and triggers download.
 */
export async function generateAndDownloadShareCard(channel: IPTVChannel): Promise<void> {
  const W = 400, H = 600;
  const canvas = document.createElement('canvas');
  canvas.width = W * 2;   // 2× for retina
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  // Dark gradient background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a0a0a');
  bg.addColorStop(0.6, '#111118');
  bg.addColorStop(1, '#1a0a2e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid pattern
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 30) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 30) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Glow circle
  const glow = ctx.createRadialGradient(W / 2, 200, 0, W / 2, 200, 200);
  glow.addColorStop(0, 'rgba(255,0,80,0.15)');
  glow.addColorStop(1, 'rgba(255,0,80,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // LIVE badge
  ctx.fillStyle = '#e60023';
  roundRect(ctx, W / 2 - 28, 52, 56, 22, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('● LIVE', W / 2, 63);

  // Channel logo
  const logoY = 100;
  const logoSize = 100;
  if (channel.logo) {
    try {
      const img = await loadImg(channel.logo);
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, (W - logoSize) / 2, logoY, logoSize, logoSize, 20);
      ctx.clip();
      ctx.drawImage(img, (W - logoSize) / 2, logoY, logoSize, logoSize);
      ctx.restore();
    } catch {
      drawLogoFallback(ctx, channel.name, (W - logoSize) / 2, logoY, logoSize);
    }
  } else {
    drawLogoFallback(ctx, channel.name, (W - logoSize) / 2, logoY, logoSize);
  }

  // Channel name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  wrapText(ctx, channel.name, W / 2, 240, W - 60, 34);

  // Country & language
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '14px system-ui, sans-serif';
  const meta = [channel.country, channel.languages[0]?.toUpperCase()].filter(Boolean).join(' · ');
  ctx.fillText(meta, W / 2, 285);

  // Category pills
  const cats = channel.categories.slice(0, 3);
  const pillColors: Record<string, string> = {
    news: '#2563eb', sports: '#16a34a', entertainment: '#7c3aed',
    music: '#db2777', movies: '#ea580c', kids: '#ca8a04',
    documentary: '#0d9488', general: '#4b5563',
  };
  let pillX = W / 2 - (cats.length * 70) / 2;
  for (const cat of cats) {
    const color = pillColors[cat.toLowerCase()] || '#4b5563';
    ctx.fillStyle = color;
    roundRect(ctx, pillX, 300, 65, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cat.charAt(0).toUpperCase() + cat.slice(1), pillX + 32.5, 311);
    pillX += 72;
  }

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 348); ctx.lineTo(W - 40, 348);
  ctx.stroke();

  // QR placeholder / scan text
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Watch live on TikVTV', W / 2, 370);

  // Branding footer
  const footerGrad = ctx.createLinearGradient(0, H - 80, W, H - 80);
  footerGrad.addColorStop(0, '#ff0050');
  footerGrad.addColorStop(1, '#00f2ea');
  ctx.fillStyle = footerGrad;
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TikVTV', W / 2, H - 44);

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('Live TV · Global Channels · Free', W / 2, H - 20);

  // Download
  const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tikvtv-${channel.id}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    // Proxy through allorigins to avoid CORS
    img.src = `https://api.allorigins.win/raw?url=${encodeURIComponent(src)}`;
    // Fallback to direct
    setTimeout(() => { img.src = src; }, 2000);
  });
}

function drawLogoFallback(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, size: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  roundRect(ctx, x, y, size, size, 20);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `bold ${size * 0.45}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.charAt(0).toUpperCase(), x + size / 2, y + size / 2);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, curY);
      line = word;
      curY += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, curY);
}

// Default export (unused but satisfies module)
export default function ShareCard(_: Props) { return null; }
