export class InputManager {
  constructor() {
    this.keys = {};

    // Standardized drive input
    this.throttle = 0;
    this.brake = 0;
    this.steer = 0;
    this.handbrake = false;

    // Callbacks
    this.onToggleSideDoor = null;
    this.onToggleRearDoors = null;
    this.onActionDeliver = null;
    this.onToggleCamera = null;
    this.onResetVehicle = null;

    // Virtual Touch Joystick
    this.joystickActive = false;
    this.joystickOrigin = { x: 0, y: 0 };
    this.joystickPos = { x: 0, y: 0 };

    this.bindKeyboard();
    this.bindTouchControls();
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Spacebar MUST ONLY handbrake turn, NEVER click focused UI buttons or scroll
      if (e.code === 'Space') {
        e.preventDefault();
      }

      this.keys[e.code] = true;

      // Blur any accidentally focused DOM element
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }

      // Explicit camera toggle only via C key
      if (e.code === 'KeyC') {
        if (this.onToggleCamera) this.onToggleCamera();
      } else if (e.code === 'KeyR') {
        if (this.onResetVehicle) this.onResetVehicle();
      } else if (e.code === 'KeyG') {
        if (this.onToggleRearDoors) this.onToggleRearDoors();
      } else if (e.code === 'KeyH') {
        if (this.onToggleSideDoor) this.onToggleSideDoor();
      } else if (e.code === 'Enter' || e.code === 'KeyQ' || e.code === 'KeyE') {
        if (this.onActionDeliver) this.onActionDeliver();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
      }
      this.keys[e.code] = false;
    });
  }

  bindTouchControls() {
    const joystickZone = document.getElementById('touch-joystick-zone');
    const joystickNub = document.getElementById('touch-joystick-nub');

    if (!joystickZone || !joystickNub) return;

    let touchId = null;

    joystickZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      touchId = touch.identifier;
      const rect = joystickZone.getBoundingClientRect();
      this.joystickOrigin = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      this.joystickActive = true;
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!this.joystickActive) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchId) {
          e.preventDefault();
          const maxRadius = 45;
          const dx = touch.clientX - this.joystickOrigin.x;
          const dy = touch.clientY - this.joystickOrigin.y;
          const dist = Math.hypot(dx, dy);
          const angle = Math.atan2(dy, dx);
          const clampedDist = Math.min(dist, maxRadius);

          const nx = Math.cos(angle) * clampedDist;
          const ny = Math.sin(angle) * clampedDist;

          joystickNub.style.transform = `translate(${nx}px, ${ny}px)`;
          this.joystickPos.x = nx / maxRadius;
          this.joystickPos.y = ny / maxRadius;
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          this.joystickActive = false;
          touchId = null;
          joystickNub.style.transform = `translate(0px, 0px)`;
          this.joystickPos.x = 0;
          this.joystickPos.y = 0;
        }
      }
    };

    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);

    this.bindButton('btn-gas', (active) => { this.btnGas = active; });
    this.bindButton('btn-brake', (active) => { this.btnBrake = active; });
    this.bindButton('btn-drift', (active) => { this.btnDrift = active; });
    this.bindButtonClick('btn-deliver', () => { if (this.onActionDeliver) this.onActionDeliver(); });
    this.bindButtonClick('btn-cam', () => { if (this.onToggleCamera) this.onToggleCamera(); });
  }

  bindButton(id, callback) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = (e) => { e.preventDefault(); callback(true); el.classList.add('active'); };
    const end = (e) => { e.preventDefault(); callback(false); el.classList.remove('active'); };

    el.addEventListener('mousedown', start);
    window.addEventListener('mouseup', end);
    el.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
  }

  bindButtonClick(id, callback) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      callback();
      el.blur();
    });
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      callback();
      el.blur();
    }, { passive: false });
  }

  update() {
    let t = 0;
    let b = 0;
    let s = 0;

    // Acceleration & Braking
    if (this.keys['KeyW'] || this.keys['ArrowUp'] || this.btnGas) t += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown'] || this.btnBrake) b += 1;

    // Steering (Left turns Left, Right turns Right)
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) s += 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) s -= 1;

    // Virtual Joystick
    if (this.joystickActive) {
      s -= this.joystickPos.x;
      if (this.joystickPos.y < -0.15) t += -this.joystickPos.y;
      if (this.joystickPos.y > 0.15) b += this.joystickPos.y;
    }

    this.throttle = Math.min(1.0, Math.max(0.0, t));
    this.brake = Math.min(1.0, Math.max(0.0, b));
    this.steer = Math.min(1.0, Math.max(-1.0, s));
    // Space bar is strictly Handbrake
    this.handbrake = Boolean(this.keys['Space'] || this.btnDrift);
  }
}
