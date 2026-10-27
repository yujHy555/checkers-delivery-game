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

    // Gamepad state
    this.gamepadIndex = null;
    this.prevGamepadButtons = {};

    // Virtual Touch Joystick
    this.joystickActive = false;
    this.joystickOrigin = { x: 0, y: 0 };
    this.joystickPos = { x: 0, y: 0 };

    // Mobile Button States
    this.btnSteerLeft = false;
    this.btnSteerRight = false;
    this.btnGas = false;
    this.btnBrake = false;
    this.btnDrift = false;

    this.bindKeyboard();
    this.bindTouchControls();
    this.bindGamepad();
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

  bindGamepad() {
    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
      console.log(`🎮 Gamepad connected at index ${e.gamepad.index}: ${e.gamepad.id}`);
      const toast = document.getElementById('toast-msg');
      if (toast) {
        toast.innerText = `🎮 Gamepad Connected: ${e.gamepad.id.substring(0, 24)}...`;
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), 3000);
      }
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.gamepadIndex === e.gamepad.index) {
        this.gamepadIndex = null;
      }
    });
  }

  pollGamepad() {
    if (!navigator.getGamepads) return null;
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && gp.connected) return gp;
    }
    return null;
  }

  bindTouchControls() {
    // Mobile Driving Controls: Left/Right Steering Triangles & Racing Pedals
    this.bindTouchButton('btn-steer-left', (active) => { this.btnSteerLeft = active; });
    this.bindTouchButton('btn-steer-right', (active) => { this.btnSteerRight = active; });
    this.bindTouchButton('btn-gas', (active) => { this.btnGas = active; });
    this.bindTouchButton('btn-brake', (active) => { this.btnBrake = active; });
    this.bindTouchButton('btn-drift', (active) => { this.btnDrift = active; });

    this.bindButtonClick('btn-deliver', () => { if (this.onActionDeliver) this.onActionDeliver(); });
    this.bindButtonClick('mobile-btn-deliver', () => { if (this.onActionDeliver) this.onActionDeliver(); });
    this.bindButtonClick('btn-cam', () => { if (this.onToggleCamera) this.onToggleCamera(); });
  }

  bindTouchButton(id, callback) {
    const el = document.getElementById(id);
    if (!el) return;

    let activePointerId = null;

    const onPointerDown = (e) => {
      e.preventDefault();
      activePointerId = e.pointerId;
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {}
      callback(true);
      el.classList.add('active');
    };

    const onPointerUp = (e) => {
      if (activePointerId !== null && e.pointerId === activePointerId) {
        activePointerId = null;
        try {
          el.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
      callback(false);
      el.classList.remove('active');
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('pointerleave', (e) => {
      if (!el.hasPointerCapture || !el.hasPointerCapture(e.pointerId)) {
        onPointerUp(e);
      }
    });

    // Touch events for ultra-low latency mobile response
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      callback(true);
      el.classList.add('active');
    }, { passive: false });

    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      callback(false);
      el.classList.remove('active');
    });

    el.addEventListener('touchcancel', (e) => {
      callback(false);
      el.classList.remove('active');
    });
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
    let handbrakeActive = false;

    // 1. Keyboard & Touch Button Inputs (Responsive multi-touch support)
    if (this.keys['KeyW'] || this.keys['ArrowUp'] || this.btnGas) t += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown'] || this.btnBrake) b += 1;

    // Steering (A/Left = Left, D/Right = Right)
    if (this.keys['KeyA'] || this.keys['ArrowLeft'] || this.btnSteerLeft) s += 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight'] || this.btnSteerRight) s -= 1;

    // Handbrake Drift
    if (this.keys['Space'] || this.btnDrift) handbrakeActive = true;

    // 3. HTML5 Gamepad Input (Xbox, PlayStation, etc.)
    const gp = this.pollGamepad();
    if (gp) {
      // Analog Steering (Left Stick X, with 0.12 deadzone)
      const stickX = gp.axes[0] || 0;
      if (Math.abs(stickX) > 0.12) {
        // Swap sign to match: left stick tilts left
        s -= stickX;
      }

      // D-Pad Steering
      if (gp.buttons[14] && gp.buttons[14].pressed) s += 1; // D-pad Left
      if (gp.buttons[15] && gp.buttons[15].pressed) s -= 1; // D-pad Right

      // Triggers for Gas & Brake
      // Right Trigger (buttons[7]): Analog Throttle
      if (gp.buttons[7]) {
        t = Math.max(t, gp.buttons[7].value);
      }
      // Left Trigger (buttons[6]): Analog Brake
      if (gp.buttons[6]) {
        b = Math.max(b, gp.buttons[6].value);
      }

      // Face Buttons & D-Pad
      if (gp.buttons[12] && gp.buttons[12].pressed) t = 1.0; // D-pad Up
      if (gp.buttons[13] && gp.buttons[13].pressed) b = 1.0; // D-pad Down

      // Handbrake Drift: B (buttons[1]), X (buttons[2]), or Right Bumper (buttons[5])
      if ((gp.buttons[1] && gp.buttons[1].pressed) ||
          (gp.buttons[2] && gp.buttons[2].pressed) ||
          (gp.buttons[5] && gp.buttons[5].pressed)) {
        handbrakeActive = true;
      }

      // Deliver action: Button A (buttons[0])
      const btnAPressed = gp.buttons[0] && gp.buttons[0].pressed;
      if (btnAPressed && !this.prevGamepadButtons[0]) {
        if (this.onActionDeliver) this.onActionDeliver();
      }
      this.prevGamepadButtons[0] = btnAPressed;

      // Toggle Camera: Button Y (buttons[3])
      const btnYPressed = gp.buttons[3] && gp.buttons[3].pressed;
      if (btnYPressed && !this.prevGamepadButtons[3]) {
        if (this.onToggleCamera) this.onToggleCamera();
      }
      this.prevGamepadButtons[3] = btnYPressed;

      // Reset Van: Start Button (buttons[9])
      const btnStartPressed = gp.buttons[9] && gp.buttons[9].pressed;
      if (btnStartPressed && !this.prevGamepadButtons[9]) {
        if (this.onResetVehicle) this.onResetVehicle();
      }
      this.prevGamepadButtons[9] = btnStartPressed;

      // Doors: Left Bumper (buttons[4])
      const btnLBPressed = gp.buttons[4] && gp.buttons[4].pressed;
      if (btnLBPressed && !this.prevGamepadButtons[4]) {
        if (this.onToggleSideDoor) this.onToggleSideDoor();
      }
      this.prevGamepadButtons[4] = btnLBPressed;
    }

    this.throttle = Math.min(1.0, Math.max(0.0, t));
    this.brake = Math.min(1.0, Math.max(0.0, b));
    this.steer = Math.min(1.0, Math.max(-1.0, s));
    this.handbrake = handbrakeActive;
  }
}
