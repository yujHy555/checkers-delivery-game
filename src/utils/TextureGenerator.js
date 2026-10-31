import { DynamicTexture } from '@babylonjs/core';

export class TextureGenerator {
  /**
   * Generates radial tire tread texture (512 x 512) for Babylon.js
   */
  static createTireTexture(scene) {
    const dt = new DynamicTexture('tireTex', 512, scene, true);
    const ctx = dt.getContext();

    // Base deep dark charcoal rubber
    ctx.fillStyle = '#1c1f22';
    ctx.fillRect(0, 0, 512, 512);

    // Lateral tread sipes & grooves
    ctx.fillStyle = '#0f1113';
    for (let y = 0; y < 512; y += 16) {
      ctx.fillRect(0, y, 512, 5);
    }

    // Longitudinal tread channel grooves
    ctx.fillRect(96, 0, 14, 512);
    ctx.fillRect(192, 0, 14, 512);
    ctx.fillRect(306, 0, 14, 512);
    ctx.fillRect(402, 0, 14, 512);

    // Shoulder block grip cuts
    ctx.fillStyle = '#141618';
    for (let y = 8; y < 512; y += 32) {
      ctx.fillRect(0, y, 70, 8);
      ctx.fillRect(442, y, 70, 8);
    }

    dt.update();
    return dt;
  }

  /**
   * Generates multi-spoke silver alloy wheel rim texture (512 x 512)
   */
  static createWheelRimTexture(scene) {
    const dt = new DynamicTexture('rimTex', 512, scene, true);
    const ctx = dt.getContext();

    const cx = 256, cy = 256;

    // Outer dark rim lip
    ctx.fillStyle = '#1a1d20';
    ctx.beginPath();
    ctx.arc(cx, cy, 250, 0, Math.PI * 2);
    ctx.fill();

    // Dark ventilated brake disc background
    ctx.fillStyle = '#282c30';
    ctx.beginPath();
    ctx.arc(cx, cy, 230, 0, Math.PI * 2);
    ctx.fill();

    // Disc brake ventilation holes
    ctx.fillStyle = '#151719';
    for (let r = 160; r <= 210; r += 24) {
      for (let a = 0; a < 24; a++) {
        const ang = (a * Math.PI) / 12 + (r % 2) * 0.1;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Machined silver rim outer ring
    const rimGrad = ctx.createRadialGradient(cx, cy, 140, cx, cy, 240);
    rimGrad.addColorStop(0.0, '#5a626a');
    rimGrad.addColorStop(0.4, '#d8e0e8');
    rimGrad.addColorStop(0.8, '#a0abb6');
    rimGrad.addColorStop(1.0, '#424850');
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(cx, cy, 222, 0, Math.PI * 2);
    ctx.stroke();

    // 8 Dual/Split Machined Silver Spokes
    const numSpokes = 8;
    for (let i = 0; i < numSpokes; i++) {
      const angle = (i * Math.PI * 2) / numSpokes;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      // Machined silver spoke
      const spGrad = ctx.createLinearGradient(0, 0, 0, 220);
      spGrad.addColorStop(0, '#cbd5e1');
      spGrad.addColorStop(0.5, '#ffffff');
      spGrad.addColorStop(1, '#94a3b8');
      ctx.fillStyle = spGrad;

      ctx.beginPath();
      ctx.moveTo(-16, 50);
      ctx.lineTo(-24, 218);
      ctx.lineTo(24, 218);
      ctx.lineTo(16, 50);
      ctx.closePath();
      ctx.fill();

      // Center recessed spoke groove
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(-4, 75);
      ctx.lineTo(-6, 205);
      ctx.lineTo(6, 205);
      ctx.lineTo(4, 75);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Deep recessed center hub
    const hubGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 65);
    hubGrad.addColorStop(0, '#e2e8f0');
    hubGrad.addColorStop(0.6, '#64748b');
    hubGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = hubGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 65, 0, Math.PI * 2);
    ctx.fill();

    // Center hub cap (bright teal Sixty60 ring with chrome badge)
    ctx.fillStyle = '#00bcd4';
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Chrome lug nuts (5 nuts in circle)
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      const lx = cx + Math.cos(angle) * 46;
      const ly = cy + Math.sin(angle) * 46;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(lx, ly, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(lx, ly, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    dt.update();
    return dt;
  }

  /**
   * Generates AAA quality dark grey tire tread mark texture (128 x 256)
   * Features distinct longitudinal tire ribs, channel grooves, angled lateral sipes,
   * and soft feathered outer edges for authentic rubber burn marks on asphalt.
   */
  static createTireSkidmarkPatternTexture(scene) {
    const dt = new DynamicTexture('skidmarkTreadTex', { width: 128, height: 256 }, scene, true);
    const ctx = dt.getContext();
    ctx.clearRect(0, 0, 128, 256);

    const darkGrey = '#26282c'; // Dark grey rubber compound
    const ribDark = '#18191c';  // Deepest pressure contact points
    const grooveTone = 'rgba(38, 40, 44, 0.22)'; // Recessed tread channel grooves

    // 1. Base tread ribs (4 longitudinal contact ribs)
    const ribs = [
      { start: 14, width: 20 },
      { start: 40, width: 19 },
      { start: 69, width: 19 },
      { start: 94, width: 20 }
    ];

    // Longitudinal continuous rubber burn
    for (const r of ribs) {
      ctx.fillStyle = darkGrey;
      ctx.fillRect(r.start, 0, r.width, 256);

      // Deep core pressure inside each rib
      ctx.fillStyle = ribDark;
      ctx.fillRect(r.start + 3, 0, r.width - 6, 256);
    }

    // Longitudinal channels (lower opacity gap between ribs)
    const grooves = [
      { start: 34, width: 6 },
      { start: 59, width: 10 },
      { start: 88, width: 6 }
    ];
    ctx.fillStyle = grooveTone;
    for (const g of grooves) {
      ctx.fillRect(g.start, 0, g.width, 256);
    }

    // 2. Transverse lateral sipes & tread block cuts
    ctx.strokeStyle = 'rgba(18, 19, 21, 0.85)';
    ctx.lineWidth = 2.5;

    for (let y = 0; y < 256; y += 18) {
      // Angled sipes on left ribs
      ctx.beginPath();
      ctx.moveTo(14, y);
      ctx.lineTo(34, y + 8);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(40, y + 4);
      ctx.lineTo(59, y + 12);
      ctx.stroke();

      // Mirror-angled sipes on right ribs
      ctx.beginPath();
      ctx.moveTo(88, y + 12);
      ctx.lineTo(69, y + 4);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(114, y + 8);
      ctx.lineTo(94, y);
      ctx.stroke();
    }

    // 3. Subtle micro rubber grain striations along direction of travel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let i = 0; i < 400; i++) {
      const rx = 14 + Math.random() * 100;
      const ry = Math.random() * 256;
      ctx.fillRect(rx, ry, 1.5, 4 + Math.random() * 8);
    }

    // 4. Soft feathered alpha edges on outer tire boundaries (margins 0..14 and 114..128)
    const leftGrad = ctx.createLinearGradient(0, 0, 14, 0);
    leftGrad.addColorStop(0, 'rgba(38, 40, 44, 0.0)');
    leftGrad.addColorStop(1, 'rgba(38, 40, 44, 0.88)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, 14, 256);

    const rightGrad = ctx.createLinearGradient(114, 0, 128, 0);
    rightGrad.addColorStop(0, 'rgba(38, 40, 44, 0.88)');
    rightGrad.addColorStop(1, 'rgba(38, 40, 44, 0.0)');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(114, 0, 14, 256);

    dt.wrapU = 1; // WRAP_ADDRESSMODE
    dt.wrapV = 1;
    dt.hasAlpha = true;
    dt.update();
    return dt;
  }

  /**
   * Generates organic multi-lobed tire smoke cloud puff texture (256 x 256)
   * Soft gaussian alpha decay creates realistic billowy tire drift smoke.
   */
  static createSmokePuffTexture(scene) {
    const dt = new DynamicTexture('smokePuffTex', { width: 256, height: 256 }, scene, true);
    const ctx = dt.getContext();
    ctx.clearRect(0, 0, 256, 256);

    const cx = 128, cy = 128;
    // Central core with feathered soft decay
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 115);
    grad.addColorStop(0, 'rgba(248, 249, 252, 0.90)');
    grad.addColorStop(0.35, 'rgba(235, 238, 242, 0.65)');
    grad.addColorStop(0.68, 'rgba(215, 220, 225, 0.28)');
    grad.addColorStop(1.0, 'rgba(200, 205, 210, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 115, 0, Math.PI * 2);
    ctx.fill();

    // Additional organic cloud lobes for natural fluffy silhouette
    const lobes = [
      { x: cx - 35, y: cy - 22, r: 65, alpha: 0.55 },
      { x: cx + 35, y: cy - 18, r: 68, alpha: 0.55 },
      { x: cx - 22, y: cy + 28, r: 62, alpha: 0.50 },
      { x: cx + 26, y: cy + 24, r: 64, alpha: 0.50 },
    ];
    for (const l of lobes) {
      const g = ctx.createRadialGradient(l.x, l.y, 6, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(245, 247, 250, ${l.alpha})`);
      g.addColorStop(0.45, `rgba(230, 234, 238, ${l.alpha * 0.6})`);
      g.addColorStop(1.0, 'rgba(200, 205, 210, 0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
      ctx.fill();
    }

    dt.hasAlpha = true;
    dt.update();
    return dt;
  }

  /**
   * Generates pure-white anime speed line streak texture (128 x 16)
   * Feathered tapered head and tail for classic anime action lines.
   */
  static createAnimeSpeedLineTexture(scene) {
    const dt = new DynamicTexture('animeSpeedLineTex', { width: 128, height: 16 }, scene, false);
    const ctx = dt.getContext();
    ctx.clearRect(0, 0, 128, 16);

    // Linear gradient along length: sharp bright head at front, tapering to zero at back
    const grad = ctx.createLinearGradient(0, 0, 0, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 16);

    // Alpha mask along X length: tail at left (x=0) fading in to head at right (x=128)
    ctx.globalCompositeOperation = 'destination-in';
    const xGrad = ctx.createLinearGradient(0, 0, 128, 0);
    xGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.0)'); // invisible tail
    xGrad.addColorStop(0.35, 'rgba(0, 0, 0, 0.45)');
    xGrad.addColorStop(0.80, 'rgba(0, 0, 0, 0.95)');
    xGrad.addColorStop(1.0, 'rgba(0, 0, 0, 1.0)'); // sharp leading tip
    ctx.fillStyle = xGrad;
    ctx.fillRect(0, 0, 128, 16);

    dt.hasAlpha = true;
    dt.update();
    return dt;
  }

  /**
   * Generates a clean, simple needle-line spark texture (64 x 256)
   * Pure single streak with incandescent white core, zero branching or forking.
   */
  static createSparkTexture(scene) {
    const dt = new DynamicTexture('arcadeSparkTex', { width: 64, height: 256 }, scene, false);
    const ctx = dt.getContext();
    ctx.clearRect(0, 0, 64, 256);

    const cx = 32;
    const cy = 128;

    // 1. Sleek warm electric-amber glow halo along the spark line
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80);
    glow.addColorStop(0, 'rgba(255, 240, 180, 1.0)');
    glow.addColorStop(0.25, 'rgba(255, 180, 40, 0.85)');
    glow.addColorStop(0.60, 'rgba(255, 90, 0, 0.40)');
    glow.addColorStop(1.0, 'rgba(255, 40, 0, 0.0)');

    ctx.save();
    ctx.scale(0.30, 1.0);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx / 0.30, cy, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Simple, crisp needle-line streak with tapered tips (zero forking)
    const lineGrad = ctx.createLinearGradient(cx, 16, cx, 240);
    lineGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
    lineGrad.addColorStop(0.20, 'rgba(255, 230, 140, 0.95)');
    lineGrad.addColorStop(0.50, 'rgba(255, 255, 255, 1.0)');
    lineGrad.addColorStop(0.80, 'rgba(255, 230, 140, 0.95)');
    lineGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, 20);
    ctx.lineTo(cx, 236);
    ctx.stroke();

    // 3. Ultra-bright razor-white incandescent core
    ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, 36);
    ctx.lineTo(cx, 220);
    ctx.stroke();

    dt.hasAlpha = true;
    dt.update();
    return dt;
  }

  /**
   * Generates a soft blurred ambient occlusion contact shadow texture (512 x 512)
   */
  static createSoftContactShadowTexture(scene) {
    const dt = new DynamicTexture('vanContactShadowTex', 512, scene, true);
    const ctx = dt.getContext();
    ctx.clearRect(0, 0, 512, 512);

    const cx = 256;
    const cy = 256;
    const grad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 240);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.52)');
    grad.addColorStop(0.70, 'rgba(0, 0, 0, 0.20)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

    ctx.save();
    ctx.scale(0.85, 1.45);
    ctx.beginPath();
    ctx.arc(cx / 0.85, cy / 1.45, 160, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    dt.hasAlpha = true;
    dt.update();
    return dt;
  }

  /**
   * Generates paper bag texture (512 x 512)
   */
  static createPaperBagTexture(scene) {
    const dt = new DynamicTexture('bagTex', 512, scene, true);
    const ctx = dt.getContext();

    // Kraft paper natural light brown background
    ctx.fillStyle = '#c79c6e';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle paper grain noise
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    for (let i = 0; i < 3000; i++) {
      const rx = Math.random() * 512;
      const ry = Math.random() * 512;
      ctx.fillRect(rx, ry, 2, 2);
    }

    // Sixty60 teal circular stamp logo
    const cx = 256, cy = 180;
    ctx.fillStyle = '#00a8b5';
    ctx.beginPath();
    ctx.arc(cx, cy, 74, 0, Math.PI * 2);
    ctx.fill();

    // White clock circle
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.stroke();

    // Clock hands
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - 16, cy - 18);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 22, cy - 8);
    ctx.stroke();

    // Brand text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Montserrat", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Checkers', cx, 305);
    ctx.font = 'italic 900 52px "Arial Black", sans-serif';
    ctx.fillText('Sixty60', cx, 355);

    dt.update();
    return dt;
  }

  /**
   * Generates delicate chromatic anamorphic halo ring (256 x 256)
   */
  static createAnamorphicHaloDataUrl() {
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.clearRect(0, 0, 256, 256);
    const cx = 128, cy = 128, r = 85;

    const ringGrad = ctx.createRadialGradient(cx, cy, r - 20, cx, cy, r + 20);
    ringGrad.addColorStop(0, 'rgba(0, 0, 0, 0.0)');
    ringGrad.addColorStop(0.3, 'rgba(37, 99, 235, 0.2)');
    ringGrad.addColorStop(0.5, 'rgba(0, 229, 255, 0.65)');
    ringGrad.addColorStop(0.7, 'rgba(168, 85, 247, 0.25)');
    ringGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = ringGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 20, 0, Math.PI * 2);
    ctx.fill();

    return canvas.toDataURL('image/png');
  }

  /**
   * Generates horizontally stretched anamorphic bokeh oval ghost (256 x 256)
   */
  static createAnamorphicGhostDataUrl() {
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.clearRect(0, 0, 256, 256);
    const cx = 128, cy = 128;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.8, 0.9); // 2:1 horizontal stretch characteristic of anamorphic glass

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
    grad.addColorStop(0, 'rgba(0, 229, 255, 0.45)');
    grad.addColorStop(0.4, 'rgba(37, 99, 235, 0.35)');
    grad.addColorStop(0.8, 'rgba(30, 58, 138, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    return canvas.toDataURL('image/png');
  }

  /**
   * Generates radiant central sun starburst (256 x 256)
   */
  static createSunStarburstDataUrl() {
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.clearRect(0, 0, 256, 256);
    const cx = 128, cy = 128;

    ctx.globalCompositeOperation = 'lighter';
    const numSpikes = 8;
    for (let i = 0; i < numSpikes; i++) {
      const angle = (i * Math.PI) / numSpikes;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      const spikeGrad = ctx.createLinearGradient(-110, 0, 110, 0);
      spikeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
      spikeGrad.addColorStop(0.35, 'rgba(255, 240, 210, 0.3)');
      spikeGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
      spikeGrad.addColorStop(0.65, 'rgba(255, 240, 210, 0.3)');
      spikeGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

      ctx.fillStyle = spikeGrad;
      ctx.fillRect(-110, -1.5, 220, 3);
      ctx.restore();
    }

    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 45);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    coreGrad.addColorStop(0.3, 'rgba(255, 248, 220, 0.85)');
    coreGrad.addColorStop(0.7, 'rgba(255, 200, 140, 0.35)');
    coreGrad.addColorStop(1, 'rgba(255, 180, 100, 0.0)');

    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 45, 0, Math.PI * 2);
    ctx.fill();

    return canvas.toDataURL('image/png');
  }
}
