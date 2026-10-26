import * as THREE from 'three';

export class TextureGenerator {
  static createVanSideTexture(isFlipped = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Background two-tone split: Top lime green, Bottom vibrant cyan
    const greenColor = '#13b843';
    const cyanColor = '#00a3b8';
    const lightningColor = '#ffffff';

    ctx.fillStyle = greenColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Diagonal lightning bolt cut
    ctx.fillStyle = cyanColor;
    ctx.beginPath();
    ctx.moveTo(0, 240);
    // Draw stepped lightning bolt pattern matching the Sixty60 Hyper van
    ctx.lineTo(260, 240);
    ctx.lineTo(320, 275);
    ctx.lineTo(460, 275);
    ctx.lineTo(540, 230);
    ctx.lineTo(1024, 255);
    ctx.lineTo(1024, 512);
    ctx.lineTo(0, 512);
    ctx.closePath();
    ctx.fill();

    // White lightning bolt accent stripe
    ctx.strokeStyle = lightningColor;
    ctx.lineWidth = 14;
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(0, 240);
    ctx.lineTo(260, 240);
    ctx.lineTo(320, 275);
    ctx.lineTo(460, 275);
    ctx.lineTo(540, 230);
    ctx.lineTo(1024, 255);
    ctx.stroke();

    // Secondary subtle lightning streak
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 270);
    ctx.lineTo(240, 270);
    ctx.lineTo(300, 305);
    ctx.lineTo(480, 305);
    ctx.lineTo(560, 260);
    ctx.lineTo(1024, 285);
    ctx.stroke();

    // "Checkers Hyper" Text on Upper Cargo side
    ctx.save();
    if (isFlipped) {
      // Invert horizontally if needed for opposite side mapping
      // but canvas text looks best aligned left-to-right on car sides
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 900 68px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    
    // Slight italic slant
    const textX = 640;
    const textY = 145;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;
    
    // Sub-title "Checkers"
    ctx.font = 'bold 36px "Arial Black", sans-serif';
    ctx.fillText('Checkers', textX - 70, textY - 45);

    // Main title "Hyper"
    ctx.font = 'italic 900 96px "Arial Black", Impact, sans-serif';
    ctx.fillText('Hyper', textX + 40, textY + 30);
    ctx.restore();

    // "NOW ON Sixty60" on lower cyan section
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText('NOW ON', 120, 420);

    ctx.font = 'italic 900 52px "Arial Black", sans-serif';
    ctx.fillText('SIXTY', 230, 422);
    
    // Draw Sixty60 Clock Icon
    const clockX = 410;
    const clockY = 405;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(clockX, clockY, 26, 0, Math.PI * 2);
    ctx.stroke();
    // Clock hands
    ctx.beginPath();
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(clockX, clockY - 14);
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(clockX + 11, clockY + 6);
    ctx.stroke();

    // Number "60"
    ctx.font = '900 36px "Arial Black", sans-serif';
    ctx.fillText('60', clockX + 34, clockY + 12);
    ctx.restore();

    // Side sliding door track groove
    ctx.fillStyle = '#222222';
    ctx.fillRect(480, 260, 480, 5);

    // Door seams & handle
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 3;
    // Front door seam
    ctx.beginPath();
    ctx.moveTo(420, 50);
    ctx.lineTo(420, 480);
    // Sliding door seam
    ctx.moveTo(940, 50);
    ctx.lineTo(940, 480);
    ctx.stroke();

    // Door handles
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.roundRect(380, 245, 34, 12, 4);
    ctx.roundRect(500, 245, 34, 12, 4);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  static createVanRoofTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#13b843';
    ctx.fillRect(0, 0, 512, 512);

    // Center roof logo
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Checkers', 256, 210);

    ctx.font = 'italic 900 84px "Arial Black", Impact, sans-serif';
    ctx.fillText('Hyper', 256, 285);

    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText('NOW ON SIXTY60', 256, 335);

    // Roof ribs / grooves
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let i = 80; i <= 440; i += 60) {
      ctx.fillRect(i, 40, 14, 432);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  static createVanFrontTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Split background: top green, bottom cyan
    ctx.fillStyle = '#13b843';
    ctx.fillRect(0, 0, 512, 110);
    ctx.fillStyle = '#00a3b8';
    ctx.fillRect(0, 110, 512, 146);

    // Black bumper & grille area
    ctx.fillStyle = '#1c1f21';
    ctx.beginPath();
    ctx.roundRect(110, 130, 292, 90, 8);
    ctx.fill();

    // Grille mesh pattern
    ctx.strokeStyle = '#33373b';
    ctx.lineWidth = 2;
    for (let x = 120; x <= 390; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, 140);
      ctx.lineTo(x, 210);
      ctx.stroke();
    }

    // Sixty60 front badge emblem
    const cx = 256, cy = 175;
    ctx.fillStyle = '#00bcd4';
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial Black, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('60', cx, cy + 6);

    // Modern Kei Headlights (Left & Right)
    const drawHeadlight = (hx, hy) => {
      // Chrome casing
      ctx.fillStyle = '#222629';
      ctx.beginPath();
      ctx.roundRect(hx, hy, 84, 52, 10);
      ctx.fill();

      // Projector beam lens
      const grad = ctx.createRadialGradient(hx + 42, hy + 26, 4, hx + 42, hy + 26, 30);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#d8f8ff');
      grad.addColorStop(0.7, '#7ad0e2');
      grad.addColorStop(1, '#2c4046');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(hx + 42, hy + 26, 22, 0, Math.PI * 2);
      ctx.fill();

      // Amber turn signal strip
      ctx.fillStyle = '#ff9800';
      ctx.fillRect(hx + 8, hy + 38, 68, 8);
    };

    drawHeadlight(20, 85);
    drawHeadlight(408, 85);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  static createVanRearTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');

    // Split background
    ctx.fillStyle = '#13b843';
    ctx.fillRect(0, 0, 512, 180);
    ctx.fillStyle = '#00a3b8';
    ctx.fillRect(0, 180, 512, 204);

    // Center vertical seam between the two barn doors
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(256, 0);
    ctx.lineTo(256, 384);
    ctx.stroke();

    // Slogan & branding
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'italic 900 32px "Arial Black", sans-serif';
    ctx.fillText('DELIVERED IN A FLASH', 256, 80);

    ctx.font = 'bold 28px "Arial Black", sans-serif';
    ctx.fillText('Checkers Hyper', 256, 125);

    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillText('NOW ON SIXTY60', 256, 225);

    // License plate
    ctx.fillStyle = '#fffae8';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(196, 270, 120, 48, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#111';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillText('SIXTY 60', 256, 302);

    // Vertical Taillights on outer edges
    const drawTailLight = (tx) => {
      ctx.fillStyle = '#222';
      ctx.fillRect(tx, 140, 28, 120);

      // Red brake
      ctx.fillStyle = '#e53935';
      ctx.fillRect(tx + 4, 144, 20, 40);

      // Amber indicator
      ctx.fillStyle = '#ffb300';
      ctx.fillRect(tx + 4, 188, 20, 32);

      // White reverse light
      ctx.fillStyle = '#eceff1';
      ctx.fillRect(tx + 4, 224, 20, 32);
    };

    drawTailLight(16);
    drawTailLight(468);

    // Rear door handles
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.roundRect(235, 200, 16, 24, 3);
    ctx.roundRect(261, 200, 16, 24, 3);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
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

  static createWheelRimTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Metallic alloy wheel face
    const cx = 128, cy = 128;
    const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 128);
    grad.addColorStop(0, '#555b62');
    grad.addColorStop(0.5, '#bdc3c7');
    grad.addColorStop(0.8, '#7f8c8d');
    grad.addColorStop(1, '#2c3e50');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 120, 0, Math.PI * 2);
    ctx.fill();

    // 5-Spoke Star Design
    ctx.strokeStyle = '#e0e6ed';
    ctx.lineWidth = 18;
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * 105, cy + Math.sin(angle) * 105);
      ctx.stroke();
    }

    // Center hub cap with Sixty60 Cyan dot
    ctx.fillStyle = '#00bcd4';
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fill();

    // Lug nuts
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      const lx = cx + Math.cos(angle) * 44;
      const ly = cy + Math.sin(angle) * 44;
      ctx.beginPath();
      ctx.arc(lx, ly, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }
}
