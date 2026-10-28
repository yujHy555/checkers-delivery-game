import * as THREE from 'three';

export class TextureGenerator {
  /**
   * Generates high-definition side livery textures (2048 x 1024) matching the
   * Checkers Sixty60 Delivery Van Vehicle Model Sheet turnaround.
   *
   * @param {boolean} isRightSide - If true, generates the right side (front is left, rear is right).
   *                                If false, generates the left side (rear is left, front is right).
   */
  static createVanSideTexture(isRightSide = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    const W = canvas.width;
    const H = canvas.height;

    // 1. SIGNATURE SIXTY60 SMOOTH VERTICAL GRADIENT
    // Top: Vibrant Apple/Lime Green (#4ebc25), Bottom: Electric Cyan/Turquoise (#00b4d8)
    const baseGrad = ctx.createLinearGradient(0, 0, 0, H);
    baseGrad.addColorStop(0.0, '#52c628');
    baseGrad.addColorStop(0.28, '#4cb824');
    baseGrad.addColorStop(0.48, '#1fa574');
    baseGrad.addColorStop(0.58, '#00b4d8');
    baseGrad.addColorStop(1.0, '#009bb8');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, W, H);

    // Coordinate mapping:
    // Left side view: Rear is at X=0..W*0.62, Front cab is at X=W*0.62..W
    // Right side view: Front cab is at X=0..W*0.38, Rear is at X=W*0.38..W
    const frontStart = isRightSide ? 0 : W * 0.62;
    const frontEnd = isRightSide ? W * 0.38 : W;
    const cargoStart = isRightSide ? W * 0.38 : 0;
    const cargoEnd = isRightSide ? W : W * 0.62;

    // 2. FRONT CAB SIDE WINDOW WITH CHARACTERISTIC KEI SLANT
    ctx.save();
    ctx.fillStyle = '#151d24'; // tinted dark glass
    ctx.strokeStyle = '#0d1318';
    ctx.lineWidth = 14;

    ctx.beginPath();
    if (!isRightSide) {
      // Left side: Front window is at the right side (front of van)
      // Top A-pillar slant down to front, bottom sill has downward slant at front
      const winL = W * 0.67;
      const winR = W * 0.94;
      const winT = H * 0.08;
      const winB = H * 0.44;
      ctx.moveTo(winL, winT);
      ctx.lineTo(winR - 90, winT);
      ctx.lineTo(winR, winT + 80);
      ctx.lineTo(winR, winB - 25);
      ctx.lineTo(winR - 80, winB);
      ctx.lineTo(winL, winB);
      ctx.closePath();
    } else {
      // Right side: Front window is at the left side (front of van)
      const winL = W * 0.06;
      const winR = W * 0.33;
      const winT = H * 0.08;
      const winB = H * 0.44;
      ctx.moveTo(winL + 90, winT);
      ctx.lineTo(winR, winT);
      ctx.lineTo(winR, winB);
      ctx.lineTo(winL + 80, winB);
      ctx.lineTo(winL, winB - 25);
      ctx.lineTo(winL, winT + 80);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    // Window reflection gloss highlight
    const winRefl = ctx.createLinearGradient(0, 0, W, H);
    winRefl.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    winRefl.addColorStop(0.35, 'rgba(255, 255, 255, 0.04)');
    winRefl.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = winRefl;
    ctx.fill();
    ctx.restore();

    // 3. BLACK B-PILLAR & WINDOW DIVIDERS
    ctx.fillStyle = '#1a1f24';
    if (!isRightSide) {
      ctx.fillRect(W * 0.645, H * 0.06, W * 0.035, H * 0.42);
    } else {
      ctx.fillRect(W * 0.32, H * 0.06, W * 0.035, H * 0.42);
    }

    // 4. SIGNATURE WHITE LIGHTNING BOLT / FLASH GRAPHIC
    // Prominent bold white lightning bolt sweeping along waistline with sharp forward-pointing spear
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    if (!isRightSide) {
      // Left side: Spear points to the RIGHT (towards front)
      // Main bolt
      ctx.moveTo(W * 0.08, H * 0.49);
      ctx.lineTo(W * 0.36, H * 0.49);
      ctx.lineTo(W * 0.45, H * 0.45);
      ctx.lineTo(W * 0.41, H * 0.54);
      ctx.lineTo(W * 0.58, H * 0.51);
      ctx.lineTo(W * 0.53, H * 0.59);
      ctx.lineTo(W * 0.78, H * 0.54); // spearhead pointing forward
      ctx.lineTo(W * 0.62, H * 0.65);
      ctx.lineTo(W * 0.66, H * 0.62);
      ctx.lineTo(W * 0.50, H * 0.69);
      ctx.lineTo(W * 0.53, H * 0.65);
      ctx.lineTo(W * 0.38, H * 0.71);
      ctx.lineTo(W * 0.42, H * 0.64);
      ctx.lineTo(W * 0.20, H * 0.67);
      ctx.lineTo(W * 0.25, H * 0.60);
      ctx.lineTo(W * 0.08, H * 0.57);
      ctx.closePath();
      ctx.fill();

      // Secondary sharp lightning accent underneath
      ctx.beginPath();
      ctx.moveTo(W * 0.28, H * 0.73);
      ctx.lineTo(W * 0.48, H * 0.73);
      ctx.lineTo(W * 0.56, H * 0.69);
      ctx.lineTo(W * 0.44, H * 0.77);
      ctx.closePath();
      ctx.fill();

    } else {
      // Right side: Spear points to the LEFT (towards front)
      // Main bolt
      ctx.moveTo(W * 0.92, H * 0.49);
      ctx.lineTo(W * 0.64, H * 0.49);
      ctx.lineTo(W * 0.55, H * 0.45);
      ctx.lineTo(W * 0.59, H * 0.54);
      ctx.lineTo(W * 0.42, H * 0.51);
      ctx.lineTo(W * 0.47, H * 0.59);
      ctx.lineTo(W * 0.22, H * 0.54); // spearhead pointing forward
      ctx.lineTo(W * 0.38, H * 0.65);
      ctx.lineTo(W * 0.34, H * 0.62);
      ctx.lineTo(W * 0.50, H * 0.69);
      ctx.lineTo(W * 0.47, H * 0.65);
      ctx.lineTo(W * 0.62, H * 0.71);
      ctx.lineTo(W * 0.58, H * 0.64);
      ctx.lineTo(W * 0.80, H * 0.67);
      ctx.lineTo(W * 0.75, H * 0.60);
      ctx.lineTo(W * 0.92, H * 0.57);
      ctx.closePath();
      ctx.fill();

      // Secondary sharp lightning accent underneath
      ctx.beginPath();
      ctx.moveTo(W * 0.72, H * 0.73);
      ctx.lineTo(W * 0.52, H * 0.73);
      ctx.lineTo(W * 0.44, H * 0.69);
      ctx.lineTo(W * 0.56, H * 0.77);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 5. "Checkers Hyper" TYPOGRAPHY ON UPPER CARGO GREEN
    // Bold white typography matching official Sixty60 livery
    ctx.save();
    const cargoCenterX = !isRightSide ? W * 0.34 : W * 0.66;
    const textBaseY = H * 0.34;

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 5;

    // "Checkers"
    ctx.font = 'bold 78px "Montserrat", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '2px';
    ctx.fillText('Checkers', cargoCenterX, textBaseY - 88);

    // "Hyper" - Giant aggressive racing italic sans-serif
    ctx.font = 'italic 900 190px "Arial Black", "Montserrat", Impact, sans-serif';
    ctx.fillText('Hyper', cargoCenterX, textBaseY + 68);
    ctx.restore();

    // 6. "NOW ON sixty60" LOGO ON LOWER FRONT DOOR (CYAN SECTION)
    ctx.save();
    const frontDoorX = !isRightSide ? W * 0.77 : W * 0.23;
    const logoY = H * 0.68;

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    // "NOW ON"
    ctx.font = 'bold 32px "Montserrat", Arial, sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText('NOW ON', frontDoorX, logoY - 32);

    // "sixty" + 60 clock icon
    ctx.font = 'bold 78px "Montserrat", "Arial Black", sans-serif';
    ctx.textAlign = 'right';
    ctx.letterSpacing = '-1px';
    ctx.fillText('sixty', frontDoorX + 10, logoY + 48);

    // Clock Circle Icon representing "60"
    const clockX = frontDoorX + 72;
    const clockY = logoY + 22;
    const clockR = 40;

    // Clock ring
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(clockX, clockY, clockR, 0, Math.PI * 2);
    ctx.stroke();

    // Clock tick markers
    ctx.lineWidth = 4;
    for (let a = 0; a < 12; a++) {
      const angle = (a * Math.PI) / 6;
      const x1 = clockX + Math.cos(angle) * (clockR - 6);
      const y1 = clockY + Math.sin(angle) * (clockR - 6);
      const x2 = clockX + Math.cos(angle) * (clockR - 1);
      const y2 = clockY + Math.sin(angle) * (clockR - 1);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Clock hands (pointing at 10 past 10)
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(clockX - 16, clockY - 20); // hour hand
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(clockX + 22, clockY - 10); // minute hand
    ctx.stroke();

    // "60" centered in the clock
    ctx.font = '900 36px "Montserrat", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('60', clockX, clockY + 36);
    ctx.restore();

    // 7. REALISTIC VEHICLE ARCHITECTURAL PANEL GAPS & HARDWARE
    ctx.save();
    ctx.strokeStyle = 'rgba(15, 23, 30, 0.45)';
    ctx.lineWidth = 4;

    if (!isRightSide) {
      // Left side:
      // Front cab door seam
      ctx.beginPath();
      ctx.moveTo(W * 0.62, H * 0.06);
      ctx.lineTo(W * 0.62, H * 0.88);
      // Front fender seam
      ctx.moveTo(W * 0.94, H * 0.38);
      ctx.lineTo(W * 0.94, H * 0.88);
      // Sliding door rear seam
      ctx.moveTo(W * 0.12, H * 0.06);
      ctx.lineTo(W * 0.12, H * 0.88);
      ctx.stroke();

      // Black horizontal sliding door guide rail
      ctx.fillStyle = '#1c2226';
      ctx.fillRect(W * 0.12, H * 0.525, W * 0.50, 9);

      // Front door handle (recessed black vertical oval)
      ctx.fillStyle = '#181e22';
      ctx.beginPath();
      ctx.roundRect(W * 0.66, H * 0.48, 20, 52, 8);
      ctx.fill();

      // Sliding cargo door handle (horizontal)
      ctx.beginPath();
      ctx.roundRect(W * 0.55, H * 0.50, 48, 18, 6);
      ctx.fill();

      // Amber side turn indicator light on front fender
      const indX = W * 0.90, indY = H * 0.52;
      ctx.fillStyle = '#ff9800';
      ctx.beginPath();
      ctx.ellipse(indX, indY, 18, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e65100';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Fuel filler door on left rear flank
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.lineWidth = 3;
      ctx.strokeRect(W * 0.16, H * 0.62, 58, 58);

    } else {
      // Right side:
      // Front fender seam
      ctx.beginPath();
      ctx.moveTo(W * 0.06, H * 0.38);
      ctx.lineTo(W * 0.06, H * 0.88);
      // Front cab door seam
      ctx.moveTo(W * 0.38, H * 0.06);
      ctx.lineTo(W * 0.38, H * 0.88);
      // Sliding door rear seam
      ctx.moveTo(W * 0.88, H * 0.06);
      ctx.lineTo(W * 0.88, H * 0.88);
      ctx.stroke();

      // Black horizontal sliding door guide rail
      ctx.fillStyle = '#1c2226';
      ctx.fillRect(W * 0.38, H * 0.525, W * 0.50, 9);

      // Front door handle (recessed black vertical oval)
      ctx.fillStyle = '#181e22';
      ctx.beginPath();
      ctx.roundRect(W * 0.32, H * 0.48, 20, 52, 8);
      ctx.fill();

      // Sliding cargo door handle (horizontal)
      ctx.beginPath();
      ctx.roundRect(W * 0.41, H * 0.50, 48, 18, 6);
      ctx.fill();

      // Amber side turn indicator light on front fender
      const indX = W * 0.10, indY = H * 0.52;
      ctx.fillStyle = '#ff9800';
      ctx.beginPath();
      ctx.ellipse(indX, indY, 18, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e65100';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Lower matte black rocker panel sill along bottom edge
    ctx.fillStyle = '#161a1d';
    ctx.fillRect(0, H * 0.91, W, H * 0.09);

    // Subtle waistline protective rub strip
    ctx.fillStyle = 'rgba(15, 23, 30, 0.35)';
    ctx.fillRect(0, H * 0.53, W, 7);

    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Generates high-definition roof livery texture (1024 x 1024) matching the
   * TOP VIEW of the Vehicle Model Sheet turnaround.
   */
  static createVanRoofTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    const W = 1024, H = 1024;

    // 1. Signature smooth gradient: Green at front and sides, Cyan at center and rear
    const roofGrad = ctx.createRadialGradient(W * 0.5, H * 0.55, 120, W * 0.5, H * 0.5, W * 0.65);
    roofGrad.addColorStop(0.0, '#00b4d8');
    roofGrad.addColorStop(0.55, '#1eb080');
    roofGrad.addColorStop(1.0, '#50c228');
    ctx.fillStyle = roofGrad;
    ctx.fillRect(0, 0, W, H);

    // Longitudinal roof strengthening ribs
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    for (let x = 140; x <= 880; x += 120) {
      ctx.fillRect(x, 60, 24, H - 120);
    }

    // 2. MASSIVE WHITE LIGHTNING BOLT ACROSS THE ROOF (As shown in TOP VIEW)
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    // Diagonal lightning bolt stretching across the center
    ctx.moveTo(W * 0.28, H * 0.22);
    ctx.lineTo(W * 0.62, H * 0.22);
    ctx.lineTo(W * 0.44, H * 0.46);
    ctx.lineTo(W * 0.72, H * 0.42);
    ctx.lineTo(W * 0.26, H * 0.86); // bottom spear
    ctx.lineTo(W * 0.42, H * 0.58);
    ctx.lineTo(W * 0.22, H * 0.60);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. Checkers Sixty60 CLOCK LOGO IN THE CENTER
    ctx.save();
    const lcx = W * 0.72, lcy = H * 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(lcx, lcy, 52, 0, Math.PI * 2);
    ctx.stroke();

    // Clock hands
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lcx, lcy);
    ctx.lineTo(lcx - 20, lcy - 24);
    ctx.moveTo(lcx, lcy);
    ctx.lineTo(lcx + 28, lcy - 12);
    ctx.stroke();

    // "sixty" text next to clock
    ctx.font = 'bold 54px "Montserrat", "Arial Black", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('sixty', lcx - 64, lcy + 18);
    ctx.restore();

    // 4. "Checkers Hyper" WHITE LOGO PRINTED ALONG BOTH SIDES OF THE ROOF
    // Left roof edge (rotated -90 deg)
    ctx.save();
    ctx.translate(70, H * 0.5);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px "Montserrat", sans-serif';
    ctx.fillText('Checkers', 0, -32);
    ctx.font = 'italic 900 68px "Arial Black", sans-serif';
    ctx.fillText('Hyper', 0, 32);
    ctx.restore();

    // Right roof edge (rotated 90 deg)
    ctx.save();
    ctx.translate(W - 70, H * 0.5);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px "Montserrat", sans-serif';
    ctx.fillText('Checkers', 0, -32);
    ctx.font = 'italic 900 68px "Arial Black", sans-serif';
    ctx.fillText('Hyper', 0, 32);
    ctx.restore();

    // Front cab roof Sixty60 logo (above windshield)
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px "Montserrat", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ SIXTY60 ⚡', W * 0.5, H * 0.94);
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Generates high-definition front fascia texture (1024 x 512) matching the
   * FRONT VIEW of the Vehicle Model Sheet turnaround.
   */
  static createVanFrontTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const W = 1024, H = 512;

    // 1. Signature smooth vertical gradient: Green at top, Cyan in center/bottom
    const frontGrad = ctx.createLinearGradient(0, 0, 0, H);
    frontGrad.addColorStop(0.0, '#50c228');
    frontGrad.addColorStop(0.35, '#22ae68');
    frontGrad.addColorStop(0.65, '#00b4d8');
    frontGrad.addColorStop(1.0, '#009ab8');
    ctx.fillStyle = frontGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. White "NOW ON sixty60" BRANDING CENTERED ON NOSE ABOVE GRILLE
    ctx.save();
    const cx = W * 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    ctx.font = 'bold 24px "Montserrat", Arial, sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText('NOW ON', cx, 85);

    // "sixty" + clock icon
    ctx.font = 'bold 54px "Montserrat", "Arial Black", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('sixty', cx - 15, 145);

    // Clock circle
    const clockX = cx + 38, clockY = 125, clockR = 28;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(clockX, clockY, clockR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(clockX - 12, clockY - 14);
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(clockX + 16, clockY - 6);
    ctx.stroke();

    ctx.font = '900 24px "Montserrat", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('60', clockX, clockY + 24);
    ctx.restore();

    // 3. HORIZONTAL BLACK FRONT GRILLE WITH SUZUKI CHROME EMBLEM
    const grilleL = 220, grilleR = W - 220, grilleT = 180, grilleH = 120;
    ctx.fillStyle = '#181b1e';
    ctx.beginPath();
    ctx.roundRect(grilleL, grilleT, grilleR - grilleL, grilleH, 12);
    ctx.fill();

    // Grille mesh pattern & horizontal slats
    ctx.strokeStyle = '#2b3137';
    ctx.lineWidth = 4;
    for (let y = grilleT + 18; y < grilleT + grilleH; y += 22) {
      ctx.beginPath();
      ctx.moveTo(grilleL + 12, y);
      ctx.lineTo(grilleR - 12, y);
      ctx.stroke();
    }

    // Chrome center Suzuki "S" emblem
    ctx.save();
    const gcx = W * 0.5, gcy = grilleT + grilleH * 0.5;
    // Chrome badge backing
    ctx.fillStyle = '#101315';
    ctx.beginPath();
    ctx.roundRect(gcx - 36, gcy - 36, 72, 72, 10);
    ctx.fill();

    // Chrome stylized "S"
    const sGrad = ctx.createLinearGradient(gcx - 24, gcy - 24, gcx + 24, gcy + 24);
    sGrad.addColorStop(0.0, '#ffffff');
    sGrad.addColorStop(0.4, '#d8dee4');
    sGrad.addColorStop(0.7, '#88939e');
    sGrad.addColorStop(1.0, '#ffffff');
    ctx.strokeStyle = sGrad;
    ctx.lineWidth = 9;
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(gcx + 20, gcy - 20);
    ctx.lineTo(gcx - 12, gcy - 20);
    ctx.lineTo(gcx - 18, gcy - 4);
    ctx.lineTo(gcx + 14, gcy + 4);
    ctx.lineTo(gcx + 18, gcy + 20);
    ctx.lineTo(gcx - 20, gcy + 20);
    ctx.stroke();
    ctx.restore();

    // 4. KEI HEADLIGHT UNITS (Left & Right)
    const drawHeadlightUnit = (hx, hy, isLeft) => {
      // Outer black/chrome housing
      ctx.fillStyle = '#121619';
      ctx.beginPath();
      ctx.roundRect(hx, hy, 165, 115, 14);
      ctx.fill();

      // Chrome reflector bowl
      const refGrad = ctx.createLinearGradient(hx, hy, hx + 165, hy + 115);
      refGrad.addColorStop(0, '#78848f');
      refGrad.addColorStop(0.3, '#d4dce4');
      refGrad.addColorStop(0.7, '#ffffff');
      refGrad.addColorStop(1, '#505a62');
      ctx.fillStyle = refGrad;
      ctx.beginPath();
      ctx.roundRect(hx + 8, hy + 8, 110, 99, 10);
      ctx.fill();

      // Projector bulb lens
      const lensGrad = ctx.createRadialGradient(hx + 62, hy + 58, 4, hx + 62, hy + 58, 38);
      lensGrad.addColorStop(0, '#ffffff');
      lensGrad.addColorStop(0.4, '#cceeff');
      lensGrad.addColorStop(0.75, '#5599bb');
      lensGrad.addColorStop(1, '#1b2d38');
      ctx.fillStyle = lensGrad;
      ctx.beginPath();
      ctx.arc(hx + 62, hy + 58, 34, 0, Math.PI * 2);
      ctx.fill();

      // Amber corner turn signal
      const ambX = isLeft ? hx + 124 : hx + 124;
      ctx.fillStyle = '#ff9800';
      ctx.beginPath();
      ctx.roundRect(ambX, hy + 12, 32, 91, 6);
      ctx.fill();
      ctx.strokeStyle = '#e65100';
      ctx.lineWidth = 3;
      ctx.stroke();
    };

    drawHeadlightUnit(35, 185, true);
    drawHeadlightUnit(W - 200, 185, false);

    // 5. LOWER BUMPER & AIR INTAKE
    ctx.fillStyle = '#16191c';
    ctx.beginPath();
    ctx.roundRect(80, 340, W - 160, 140, 16);
    ctx.fill();

    // Center license plate holder
    ctx.fillStyle = '#f8f9fa';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(cx - 120, 375, 240, 75, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#111';
    ctx.font = 'bold 36px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SIXTY 60', cx, 424);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Generates high-definition rear tailgate texture (1024 x 768) matching the
   * BACK VIEW of the Vehicle Model Sheet turnaround.
   */
  static createVanRearTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 768;
    const ctx = canvas.getContext('2d');

    const W = 1024, H = 768;

    // 1. Vertical Signature Gradient: Green on top, Cyan in center/bottom
    const rearGrad = ctx.createLinearGradient(0, 0, 0, H);
    rearGrad.addColorStop(0.0, '#50c228');
    rearGrad.addColorStop(0.4, '#1cb276');
    rearGrad.addColorStop(0.7, '#00b4d8');
    rearGrad.addColorStop(1.0, '#0096b4');
    ctx.fillStyle = rearGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. LARGE REAR TAILGATE WINDOW / RECESSED UPPER PANEL
    const winW = 760, winH = 260;
    const winL = (W - winW) * 0.5, winT = 60;
    ctx.fillStyle = '#12171c'; // dark tinted glass
    ctx.strokeStyle = '#0d1114';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.roundRect(winL, winT, winW, winH, 24);
    ctx.fill();
    ctx.stroke();

    // Rear window wiper
    ctx.strokeStyle = '#282e34';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(W * 0.5, winT + winH - 12);
    ctx.lineTo(W * 0.58, winT + 40);
    ctx.stroke();

    // 3. PROMINENT WHITE SIXTY60 LOGO CENTERED ON TAILGATE (As shown in BACK VIEW)
    ctx.save();
    const cx = W * 0.5, logoY = 385;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;

    // "sixty" + 60 clock icon
    ctx.font = 'bold 78px "Montserrat", "Arial Black", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('sixty', cx - 20, logoY + 28);

    // Clock icon
    const clockX = cx + 54, clockY = logoY, clockR = 40;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(clockX, clockY, clockR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(clockX - 16, clockY - 20);
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(clockX + 22, clockY - 10);
    ctx.stroke();

    ctx.font = '900 36px "Montserrat", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('60', clockX, clockY + 36);
    ctx.restore();

    // 4. VERTICAL CORNER TAILLIGHTS (Left & Right outer pillars)
    // Aligned to match 3D lens coordinates: Red brake (top: 330-430), Amber turn (middle: 432-530), White reverse (bottom: 532-625)
    const drawTailLightCluster = (tx) => {
      // Black housing
      ctx.fillStyle = '#101416';
      ctx.beginPath();
      ctx.roundRect(tx, 330, 72, 298, 10);
      ctx.fill();

      // Red brake lens (prism reflector texture)
      const redGrad = ctx.createLinearGradient(tx, 335, tx + 72, 430);
      redGrad.addColorStop(0, '#e53935');
      redGrad.addColorStop(0.5, '#ff1744');
      redGrad.addColorStop(1, '#b71c1c');
      ctx.fillStyle = redGrad;
      ctx.fillRect(tx + 6, 336, 60, 94);

      // Amber turn signal
      const ambGrad = ctx.createLinearGradient(tx, 432, tx + 72, 530);
      ambGrad.addColorStop(0, '#ffb300');
      ambGrad.addColorStop(1, '#ff8f00');
      ctx.fillStyle = ambGrad;
      ctx.fillRect(tx + 6, 433, 60, 96);

      // White reverse lens
      const revGrad = ctx.createLinearGradient(tx, 532, tx + 72, 625);
      revGrad.addColorStop(0, '#f5f7fa');
      revGrad.addColorStop(1, '#cfd8dc');
      ctx.fillStyle = revGrad;
      ctx.fillRect(tx + 6, 533, 60, 92);

      // Inner lens fluting lines
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 2;
      for (let y = 340; y < 625; y += 14) {
        ctx.beginPath();
        ctx.moveTo(tx + 8, y);
        ctx.lineTo(tx + 64, y);
        ctx.stroke();
      }
    };

    drawTailLightCluster(20);
    drawTailLightCluster(W - 92);

    // 5. RECESSED LICENSE PLATE HOUSING & REAR HANDLE
    ctx.fillStyle = '#14181a';
    ctx.beginPath();
    ctx.roundRect(cx - 150, 470, 300, 130, 10);
    ctx.fill();

    // Black horizontal grab handle
    ctx.fillStyle = '#22282c';
    ctx.beginPath();
    ctx.roundRect(cx - 100, 455, 200, 24, 6);
    ctx.fill();

    // License plate
    ctx.fillStyle = '#fffae8';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(cx - 110, 495, 220, 80, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#111';
    ctx.font = 'bold 36px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SIXTY 60', cx, 548);

    // 6. MATTE BLACK REAR BUMPER
    ctx.fillStyle = '#16191c';
    ctx.fillRect(0, H - 120, W, 120);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Generates high-definition multi-spoke silver alloy wheel rim texture (512 x 512)
   * matching the 8-spoke alloy wheels shown in all views of the Vehicle Model Sheet.
   */
  static createWheelRimTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

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

    // 8 Dual/Split Machined Silver Spokes (As seen on model sheet turnaround)
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

    // Center Suzuki hub cap (bright teal Sixty60 ring with chrome badge)
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
      // Nut socket
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(lx, ly, 10, 0, Math.PI * 2);
      ctx.fill();
      // Chrome nut
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(lx, ly, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  static createPaperBagTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Kraft paper natural light brown background
    ctx.fillStyle = '#c79c6e';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle paper grain noise
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    for (let i = 0; i < 4000; i++) {
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
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.stroke();

    // Clock hands
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - 36);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 28, cy + 14);
    ctx.stroke();

    // "Checkers" text on bag
    ctx.fillStyle = '#263238';
    ctx.font = 'bold 36px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Checkers', cx, 295);

    // "SIXTY 60"
    ctx.font = '900 52px "Arial Black", Impact, sans-serif';
    ctx.fillStyle = '#007982';
    ctx.fillText('SIXTY60', cx, 350);

    // Grocery icons ribbon pattern along bottom
    ctx.fillStyle = '#263238';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText('GROCERIES DELIVERED IN 60 MINUTES', cx, 400);

    // Small icons line: bread, milk, apple, van
    ctx.strokeStyle = '#455a64';
    ctx.lineWidth = 3;
    ctx.strokeRect(100, 430, 312, 40);
    ctx.font = '14px sans-serif';
    ctx.fillText('FAST - FRESH - ON TIME', cx, 455);

    // Crease & fold lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 80);
    ctx.lineTo(512, 80); // top roll fold
    ctx.moveTo(60, 0);
    ctx.lineTo(60, 512); // left side pleat
    ctx.moveTo(452, 0);
    ctx.lineTo(452, 512); // right side pleat
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  static createAsphaltTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2b2e33';
    ctx.fillRect(0, 0, 512, 512);

    // Grain
    for (let i = 0; i < 8000; i++) {
      const g = Math.floor(Math.random() * 50) + 30;
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(20, 20);
    return texture;
  }

  static createTireTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#18191a';
    ctx.fillRect(0, 0, 256, 256);

    // Tread blocks
    ctx.fillStyle = '#2a2c2e';
    for (let y = 0; y < 256; y += 32) {
      for (let x = 0; x < 256; x += 32) {
        if ((x + y) % 64 === 0) {
          ctx.fillRect(x + 4, y + 4, 24, 24);
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  static createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Rich vibrant lawn base
    ctx.fillStyle = '#2e7d32';
    ctx.fillRect(0, 0, 256, 256);

    // Organic dual-tone blades and natural noise
    for (let i = 0; i < 4500; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const rand = Math.random();
      if (rand > 0.65) {
        ctx.fillStyle = '#43a047'; // fresh emerald green
      } else if (rand > 0.35) {
        ctx.fillStyle = '#388e3c'; // lush park green
      } else {
        ctx.fillStyle = '#1b5e20'; // deep shadow blade
      }
      ctx.fillRect(x, y, 1.5 + Math.random() * 2, 2.5 + Math.random() * 3);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(35, 35);
    return texture;
  }
}
