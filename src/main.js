import * as THREE from 'three';
import { ArcadeVehicle } from './physics/ArcadeVehicle.js';
import { VanModel } from './entities/VanModel.js';
import { CityWorld } from './world/CityWorld.js';
import { DeliverySystem } from './systems/DeliverySystem.js';
import { CameraManager } from './systems/CameraManager.js';
import { AudioSynth } from './systems/AudioSynth.js';
import { InputManager } from './systems/InputManager.js';

class GameApp {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // 1. Scene & WebGL Renderer (AAA Greybox GI Look)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe6edf3);
    this.scene.fog = new THREE.FogExp2(0xe6edf3, 0.005);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      (window.innerWidth <= 960 && 'ontouchstart' in window);
    this.isMobile = isMobile;
    this.renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    // 2. Camera & Camera Manager (Starts in Third-Person Chase Cam)
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 350);
    this.cameraManager = new CameraManager(this.camera, this.renderer.domElement);

    // 3. World Environment with Double-Sided Ramps
    this.world = new CityWorld(this.scene);
    this.cityWorld = this.world;

    // 4. Arcade Vehicle Physics (Grounded, zero bounce, high agility)
    this.vehiclePhysics = new ArcadeVehicle(this.scene, { x: 0, y: 0.35, z: -40, heading: 0 });
    this.vehiclePhysics.setColliders(this.world.colliders);

    // 5. Van Model
    this.vanModel = new VanModel(this.scene);

    // 6. SINGLE QUALITY AAA OVERHEAD GROUNDED SHADOW
    this.setupAAAGroundedShadow();

    // 7. Delivery Mission System
    this.deliverySystem = new DeliverySystem(this.scene, this.world.deliverySpots);

    // 8. Audio Synth
    this.audio = new AudioSynth();

    // 9. Input Manager
    this.input = new InputManager();

    // Setup Callbacks
    this.setupInputCallbacks();

    // UI Cache
    this.cacheUIElements();

    // Menu State: Start in Main Menu with engine audio strictly silenced
    this.inMainMenu = true;

    // Clock
    this.clock = new THREE.Clock();

    // Resize listener
    window.addEventListener('resize', () => this.onWindowResize());

    // Robust audio unlock on user interaction (only once active in game)
    const unlockAudio = () => {
      if (!this.inMainMenu) {
        this.audio.resume();
      }
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    // Start loop
    this.animate();
  }

  setupAAAGroundedShadow() {
    // AAA Greybox Global Illumination (GI) Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.25);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);

    // SINGLE QUALITY AAA DIRECTIONAL SUN LIGHT
    // Positioned directly overhead for tight, accurate ground contact shadow
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.35);
    this.sunLight.castShadow = true;

    // Adaptive shadow map resolution: 1024 on mobile for solid 60/120fps, 2048 on desktop
    const shadowRes = this.isMobile ? 1024 : 2048;
    this.sunLight.shadow.mapSize.width = shadowRes;
    this.sunLight.shadow.mapSize.height = shadowRes;

    // Generous 50x50m shadow camera: completely eliminates cube/box shadow frustum clipping artifacts on ramps
    const boxSize = 25.0;
    this.sunLight.shadow.camera.left = -boxSize;
    this.sunLight.shadow.camera.right = boxSize;
    this.sunLight.shadow.camera.top = boxSize;
    this.sunLight.shadow.camera.bottom = -boxSize;
    this.sunLight.shadow.camera.near = 5.0;
    this.sunLight.shadow.camera.far = 85.0;
    this.sunLight.shadow.camera.updateProjectionMatrix();

    // Precise bias settings: crisp, grounded tire contact shadow with zero shadow acne or edge artifacts
    this.sunLight.shadow.bias = -0.0001;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.shadow.radius = 1.0;

    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  setupInputCallbacks() {
    this.input.onToggleSideDoor = () => {
      this.audio.playDoorSlide();
      const isOpen = this.vanModel.toggleSideDoor();
      this.showToast(isOpen ? 'Side Sliding Door: OPEN' : 'Side Sliding Door: CLOSED');
    };

    this.input.onToggleRearDoors = () => {
      this.audio.playDoorSlide();
      const isOpen = this.vanModel.toggleRearDoors();
      this.showToast(isOpen ? 'Rear Barn Doors: OPEN' : 'Rear Barn Doors: CLOSED');
    };

    this.input.onActionDeliver = () => {
      const currentTarget = this.deliverySystem.getCurrentSpot();
      if (!currentTarget) return;

      const dist = this.vanModel.root.position.distanceTo(currentTarget.position);
      if (dist < 12.0) {
        this.audio.playDeliveryChime();
        const result = this.deliverySystem.completeDelivery(this.vanModel.cargoBags[0]);
        this.showDeliveryCelebration(result);
      } else {
        this.showToast('Pull up closer to the glowing delivery zone!');
      }
    };

    this.input.onToggleCamera = () => {
      const mode = this.cameraManager.toggleMode();
      this.showToast(`Camera: ${mode === 'THIRD_PERSON' ? 'Third-Person Chase' : '3D Isometric'}`);
      if (this.uiCamBtn) {
        this.uiCamBtn.innerText = mode === 'THIRD_PERSON' ? '📷 3RD CAM' : '📷 ISO CAM';
      }
    };

    const btnAudio = document.getElementById('btn-audio');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        const unmuted = this.audio.toggleMute();
        btnAudio.innerText = unmuted ? '🔊 AUDIO: ON' : '🔇 AUDIO: OFF';
        btnAudio.style.borderColor = unmuted ? '#00bcd4' : '#757575';
        this.showToast(unmuted ? 'Audio Unmuted' : 'Audio Muted');
      });
    }

    this.input.onResetVehicle = () => {
      this.vehiclePhysics.reset(0, -40, 0);
      if (this.world && this.world.resetCones) {
        this.world.resetCones();
      }
      this.showToast('Van reset on center road!');
    };
  }

  cacheUIElements() {
    this.uiSpeed = document.getElementById('speed-value');
    this.uiScore = document.getElementById('score-value');
    this.uiOrder = document.getElementById('order-title');
    this.uiTargetDist = document.getElementById('order-dist');
    this.uiPrompt = document.getElementById('action-prompt');
    this.uiMobileDeliverBtn = document.getElementById('mobile-btn-deliver');
    this.uiCamBtn = document.getElementById('btn-cam');
    this.uiMinimapPin = document.getElementById('minimap-target');
    this.uiMinimapVan = document.getElementById('minimap-player');

    if (this.uiCamBtn) {
      this.uiCamBtn.innerText = '📷 3RD CAM';
    }

    // PC & iOS Controls Guide Modal
    const guideModal = document.getElementById('controls-guide-modal');
    const btnControlsGuide = document.getElementById('btn-controls-guide');
    const btnOpenGuideBar = document.getElementById('btn-open-guide-bar');
    const btnOpenGamepadBar = document.getElementById('btn-open-gamepad-bar');
    const btnCloseGuide = document.getElementById('btn-close-guide');
    const btnCloseModalX = document.getElementById('btn-close-modal-x');
    const tabKeyboard = document.getElementById('tab-keyboard');
    const tabGamepad = document.getElementById('tab-gamepad');
    const stageKeyboard = document.getElementById('stage-keyboard');
    const stageGamepad = document.getElementById('stage-gamepad');

    const setGuideMode = (mode) => {
      if (mode === 'gamepad') {
        if (stageKeyboard) stageKeyboard.style.display = 'none';
        if (stageGamepad) stageGamepad.style.display = 'block';
        if (tabGamepad) tabGamepad.classList.add('active');
        if (tabKeyboard) tabKeyboard.classList.remove('active');
      } else {
        if (stageKeyboard) stageKeyboard.style.display = 'block';
        if (stageGamepad) stageGamepad.style.display = 'none';
        if (tabKeyboard) tabKeyboard.classList.add('active');
        if (tabGamepad) tabGamepad.classList.remove('active');
      }
    };

    if (tabKeyboard) tabKeyboard.addEventListener('click', () => setGuideMode('keyboard'));
    if (tabGamepad) tabGamepad.addEventListener('click', () => setGuideMode('gamepad'));

    const openGuide = (mode = null) => {
      if (mode) setGuideMode(mode);
      if (guideModal && window.innerWidth > 900) {
        guideModal.classList.add('open');
      }
    };

    const closeGuide = () => {
      if (guideModal) {
        guideModal.classList.remove('open');
        try { sessionStorage.setItem('sixty60_guide_seen', '1'); } catch (e) {}
      }
    };

    if (btnControlsGuide) btnControlsGuide.addEventListener('click', () => openGuide());
    if (btnOpenGuideBar) btnOpenGuideBar.addEventListener('click', () => openGuide('keyboard'));
    if (btnOpenGamepadBar) btnOpenGamepadBar.addEventListener('click', () => openGuide('gamepad'));
    if (btnCloseGuide) btnCloseGuide.addEventListener('click', closeGuide);
    if (btnCloseModalX) btnCloseModalX.addEventListener('click', closeGuide);

    if (guideModal) {
      guideModal.addEventListener('click', (e) => {
        if (e.target === guideModal) closeGuide();
      });
    }

    // Main Start Menu Screen & Sub-Modals
    const mainMenu = document.getElementById('main-menu-screen');
    const btnMenuCareer = document.getElementById('btn-menu-career');
    const btnMenuNew = document.getElementById('btn-menu-new');
    const btnMenuFreeroam = document.getElementById('btn-menu-freeroam');
    const btnMenuGarage = document.getElementById('btn-menu-garage');
    const btnMenuOptions = document.getElementById('btn-menu-options');
    const btnMenuQuit = document.getElementById('btn-menu-quit');
    const btnOpenMainMenu = document.getElementById('btn-open-main-menu');

    const garageModal = document.getElementById('garage-modal');
    const btnCloseGarage = document.getElementById('btn-close-garage');
    const btnGarageDrive = document.getElementById('btn-garage-drive');

    const optionsModal = document.getElementById('options-modal');
    const btnCloseOptions = document.getElementById('btn-close-options');
    const btnOptionsBack = document.getElementById('btn-options-back');
    const btnOptAudio = document.getElementById('btn-opt-audio');
    const btnOptCam = document.getElementById('btn-opt-cam');
    const btnOptControls = document.getElementById('btn-opt-controls');

    this.isFreeRoam = false;

    const startDriving = (mode = 'career') => {
      this.inMainMenu = false;
      if (mainMenu) mainMenu.classList.add('hidden');
      if (garageModal) garageModal.classList.remove('open');
      if (optionsModal) optionsModal.classList.remove('open');
      this.audio.resume();

      if (mode === 'freeroam') {
        this.isFreeRoam = true;
        this.showToast('🏁 FREE ROAM: Explore city streets & stunt ramps!');
        if (this.uiOrder) this.uiOrder.innerText = 'Free Roam Mode';
        if (this.uiTargetDist) this.uiTargetDist.innerText = 'Explore Circuit';
      } else if (mode === 'new') {
        this.isFreeRoam = false;
        this.vehiclePhysics.reset(0, -40, 0);
        if (this.world && this.world.resetCones) this.world.resetCones();
        this.deliverySystem.score = 0;
        this.showToast('🚀 NEW GAME: Delivery Mission Started!');
      } else {
        this.isFreeRoam = false;
        this.showToast('⚡ CAREER: Sixty60 Delivery Run in progress!');
      }
    };

    if (btnMenuCareer) btnMenuCareer.addEventListener('click', () => startDriving('career'));
    if (btnMenuNew) btnMenuNew.addEventListener('click', () => startDriving('new'));
    if (btnMenuFreeroam) btnMenuFreeroam.addEventListener('click', () => startDriving('freeroam'));

    if (btnMenuGarage) {
      btnMenuGarage.addEventListener('click', () => {
        if (garageModal) garageModal.classList.add('open');
      });
    }
    if (btnCloseGarage) {
      btnCloseGarage.addEventListener('click', () => {
        if (garageModal) garageModal.classList.remove('open');
      });
    }
    if (btnGarageDrive) {
      btnGarageDrive.addEventListener('click', () => {
        startDriving('career');
      });
    }

    if (btnMenuOptions) {
      btnMenuOptions.addEventListener('click', () => {
        if (optionsModal) optionsModal.classList.add('open');
      });
    }
    if (btnCloseOptions) {
      btnCloseOptions.addEventListener('click', () => {
        if (optionsModal) optionsModal.classList.remove('open');
      });
    }
    if (btnOptionsBack) {
      btnOptionsBack.addEventListener('click', () => {
        if (optionsModal) optionsModal.classList.remove('open');
      });
    }

    if (btnOptAudio) {
      btnOptAudio.addEventListener('click', () => {
        const unmuted = this.audio.toggleMute();
        btnOptAudio.innerText = unmuted ? '🔊 AUDIO: ON' : '🔇 AUDIO: OFF';
        const btnAudio = document.getElementById('btn-audio');
        if (btnAudio) btnAudio.innerText = unmuted ? '🔊 AUDIO: ON' : '🔇 AUDIO: OFF';
        this.showToast(unmuted ? 'Audio Unmuted' : 'Audio Muted');
      });
    }

    if (btnOptCam) {
      btnOptCam.addEventListener('click', () => {
        const mode = this.cameraManager.toggleMode();
        btnOptCam.innerText = mode === 'THIRD_PERSON' ? '📷 3RD CAM' : '📷 ISO CAM';
        if (this.uiCamBtn) this.uiCamBtn.innerText = btnOptCam.innerText;
        this.showToast(`Camera: ${mode === 'THIRD_PERSON' ? 'Third-Person Chase' : '3D Isometric'}`);
      });
    }

    if (btnOptControls) {
      btnOptControls.addEventListener('click', () => {
        if (optionsModal) optionsModal.classList.remove('open');
        openGuide('keyboard');
      });
    }

    if (btnMenuQuit) {
      btnMenuQuit.addEventListener('click', () => {
        this.showToast('Thanks for playing Checkers Hyper Sixty60! Press Continue to resume.');
      });
    }

    if (btnOpenMainMenu) {
      btnOpenMainMenu.addEventListener('click', () => {
        this.inMainMenu = true;
        this.audio.silenceEngine();
        if (mainMenu) mainMenu.classList.remove('hidden');
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.key === 'Escape') {
        if (garageModal && garageModal.classList.contains('open')) {
          garageModal.classList.remove('open');
          return;
        }
        if (optionsModal && optionsModal.classList.contains('open')) {
          optionsModal.classList.remove('open');
          return;
        }
        if (guideModal && guideModal.classList.contains('open')) {
          closeGuide();
          return;
        }
        // If no modal open, toggle main menu
        if (mainMenu) {
          if (mainMenu.classList.contains('hidden')) {
            mainMenu.classList.remove('hidden');
            this.inMainMenu = true;
            this.audio.silenceEngine();
          } else {
            mainMenu.classList.add('hidden');
            this.inMainMenu = false;
            this.audio.resume();
          }
        }
      }
    });
  }

  showToast(text) {
    const toast = document.getElementById('toast-msg');
    if (toast) {
      toast.innerText = text;
      toast.classList.add('visible');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
    }
  }

  showDeliveryCelebration(result) {
    const banner = document.getElementById('celebration-banner');
    if (banner) {
      banner.innerHTML = `
        <div style="font-size: 28px; font-weight: 900; color: #ffeb3b; text-shadow: 0 0 12px #ff9800;">
          DELIVERED IN A FLASH! ⚡
        </div>
        <div style="font-size: 18px; margin-top: 6px; color: #ffffff;">
          +500 POINTS &bull; Total Deliveries: ${result.deliveredCount}
        </div>
      `;
      banner.classList.add('active');
      setTimeout(() => banner.classList.remove('active'), 3000);
    }
  }

  updateMinimap(playerPos, playerRot, targetPos) {
    if (!this.uiMinimapVan || !this.uiMinimapPin) return;

    const mapScale = 120 / 260;
    const centerX = 60;
    const centerY = 60;

    const vx = centerX + playerPos.x * mapScale;
    const vy = centerY + playerPos.z * mapScale;
    this.uiMinimapVan.style.left = `${vx}px`;
    this.uiMinimapVan.style.top = `${vy}px`;
    this.uiMinimapVan.style.transform = `translate(-50%, -50%) rotate(${playerRot}rad)`;

    if (targetPos) {
      const tx = centerX + targetPos.x * mapScale;
      const ty = centerY + targetPos.z * mapScale;
      this.uiMinimapPin.style.left = `${tx}px`;
      this.uiMinimapPin.style.top = `${ty}px`;
      this.uiMinimapPin.style.display = 'block';
    } else {
      this.uiMinimapPin.style.display = 'none';
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      (window.innerWidth <= 960 && 'ontouchstart' in window);
    this.renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2));
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // When on the main menu, silence all vehicle audio and skip simulation updates
    if (this.inMainMenu) {
      if (this.audio) this.audio.silenceEngine();
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const dt = Math.min(this.clock.getDelta(), 0.08);

    // 1. Process Input
    this.input.update();

    // Auto-resume audio on any driving interaction
    if (!this.audio.initialized || this.audio.ctx?.state === 'suspended') {
      if (this.input.throttle > 0 || this.input.brake > 0 || this.input.steer !== 0 || this.input.handbrake) {
        this.audio.resume();
      }
    }

    // 2. Update Grounded Arcade Physics
    this.vehiclePhysics.update(dt, this.input);

    // 3. Update Visual Van Model & Suspension (Pass input for responsive brake lights)
    this.vanModel.update(dt, this.vehiclePhysics, this.input);

    // 4. Update Dynamic Camera
    this.cameraManager.update(dt, this.vanModel.root, this.vehiclePhysics);

    // 5. UPDATE SINGLE QUALITY AAA GROUNDED SHADOW
    // Overhead sun positioned directly above the van for accurate ground shadow contact without elongated box silhouettes
    const vanPos = this.vanModel.root.position;
    if (this.sunLight) {
      this.sunLight.position.set(vanPos.x + 0.5, vanPos.y + 45.0, vanPos.z + 0.5);
      this.sunLight.target.position.set(vanPos.x, vanPos.y, vanPos.z);
      this.sunLight.target.updateMatrixWorld();
    }

    // 6. Update Delivery System
    this.deliverySystem.update(dt, vanPos);

    // 7. Update Dynamic World Elements (Accurate Traffic Cone Physics & Collisions)
    if (this.world && this.world.update) {
      this.world.update(dt, this.vehiclePhysics, this.audio);
    }

    // 8. Audio Engine, Handbrake Screech & Punchy Brake Sound
    const kmh = Math.abs(this.vehiclePhysics.speed * 3.6);
    this.audio.updateEngine(this.vehiclePhysics.speed, this.input.throttle, this.vehiclePhysics.maxSpeed);
    const isSkidding = (this.input.handbrake || this.vehiclePhysics.isDrifting || this.vehiclePhysics.slipSpeed > 2.5) && Math.abs(this.vehiclePhysics.speed) > 1.2;
    this.audio.updateSkid(isSkidding, Math.max(3.5, this.vehiclePhysics.slipSpeed));
    this.audio.updateBrake(this.vehiclePhysics.isBrakingHard || (this.input.brake > 0.35 && Math.abs(this.vehiclePhysics.speed) > 1.8), this.vehiclePhysics.speed);

    // 9. Update HUD
    if (this.uiSpeed) this.uiSpeed.innerText = Math.round(kmh);
    if (this.uiScore) this.uiScore.innerText = this.deliverySystem.score;

    const currentTarget = this.deliverySystem.getCurrentSpot();
    if (this.isFreeRoam) {
      if (this.uiOrder) this.uiOrder.innerText = 'Mode: Free Roam';
      if (this.uiTargetDist) this.uiTargetDist.innerText = 'Full Circuit Open';
      if (this.uiPrompt) this.uiPrompt.style.display = 'none';
      if (this.uiMobileDeliverBtn) this.uiMobileDeliverBtn.style.display = 'none';
    } else if (currentTarget) {
      const dist = Math.round(vanPos.distanceTo(currentTarget.position));
      if (this.uiOrder) this.uiOrder.innerText = `Order: ${currentTarget.name}`;
      if (this.uiTargetDist) this.uiTargetDist.innerText = `${dist}m away`;

      if (this.uiPrompt) {
        if (dist < 12.0) {
          this.uiPrompt.innerHTML = `<span class="key-pill">ENTER / E</span> Deliver Paper Bags!`;
          this.uiPrompt.style.display = 'block';
          if (this.uiMobileDeliverBtn) this.uiMobileDeliverBtn.style.display = 'inline-block';
        } else {
          this.uiPrompt.style.display = 'none';
          if (this.uiMobileDeliverBtn) this.uiMobileDeliverBtn.style.display = 'none';
        }
      }
    }

    // 9. Update Minimap
    this.updateMinimap(vanPos, this.vehiclePhysics.heading, currentTarget ? currentTarget.position : null);

    // 10. Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Start Game on DOM Load
window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new GameApp();
});
