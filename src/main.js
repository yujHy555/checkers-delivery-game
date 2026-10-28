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
    // Set 2.0x DPR for razor-sharp HD rendering on both retina mobile screens and high-DPI desktop displays
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
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
    this.cameraManager.setColliders(this.world.colliders);

    // 4. Arcade Vehicle Physics (Grounded, zero bounce, high agility)
    this.vehiclePhysics = new ArcadeVehicle(this.scene, { x: 0, y: 0.35, z: -40, heading: 0 });
    this.vehiclePhysics.setColliders(this.world.colliders);

    // 5. Preloader & Van Model (Guarantees model is 100% loaded before game starts)
    this.initPreloader();
    this.vanModel = new VanModel(this.scene, {
      onProgress: (xhr) => this.onVanProgress(xhr),
      onLoaded: () => this.onVanLoaded(),
      onError: (err) => this.onVanLoadError(err)
    });

    // Immediate initial sync of van pose & camera so neither starts at (0, 0, 0)
    this.vanModel.update(0, this.vehiclePhysics, null);
    this.cameraManager.snap(this.vanModel.root, this.vehiclePhysics);

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

    // Day-Night Cycle: 1 min Day, 1 min Night (120s total loop)
    this.dayNightCycleDuration = 120.0;
    this.cycleTime = 12.0; // Start during bright morning sunlight
    this.isNight = false;

    // Clock
    this.clock = new THREE.Clock();

    // Resize listener
    window.addEventListener('resize', () => this.onWindowResize());

    // Robust audio unlock on user interaction
    const unlockAudio = () => {
      this.audio.resume();
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    // Initialize UI Audio, Fullscreen Toggle, and Gamepad Menu Navigation
    this.initUiAudio();
    this.initFullscreenToggle();
    this.initMenuGamepadNavigation();

    // Start loop
    this.animate();
  }

  initPreloader() {
    this.preloaderOverlay = document.getElementById('preloader-overlay');
    this.preloaderFill = document.getElementById('preloader-bar-fill');
    this.preloaderStatus = document.getElementById('preloader-status-text');
    this.preloaderPct = document.getElementById('preloader-percent-text');
    this.modelLoaded = false;

    // Incremental progress placeholder in case Content-Length isn't reported
    this.simulatedProgress = 10;
    this.progressInterval = setInterval(() => {
      if (!this.modelLoaded && this.simulatedProgress < 90) {
        this.simulatedProgress += Math.random() * 6;
        this.updatePreloaderUI(Math.floor(this.simulatedProgress), 'Downloading Sixty60 Delivery Van...');
      }
    }, 220);
  }

  onVanProgress(xhr) {
    if (xhr.lengthComputable && xhr.total > 0) {
      const pct = Math.min(Math.round((xhr.loaded / xhr.total) * 100), 98);
      const loadedMB = (xhr.loaded / (1024 * 1024)).toFixed(1);
      const totalMB = (xhr.total / (1024 * 1024)).toFixed(1);
      this.simulatedProgress = pct;
      this.updatePreloaderUI(pct, `Loading HD Delivery Van (${loadedMB}MB / ${totalMB}MB)...`);
    }
  }

  onVanLoaded() {
    this.modelLoaded = true;
    if (this.progressInterval) clearInterval(this.progressInterval);
    this.updatePreloaderUI(100, 'Van Ready! Welcome to Checkers Hyper Sixty60!');

    setTimeout(() => {
      if (this.preloaderOverlay) {
        this.preloaderOverlay.classList.add('fade-out');
        setTimeout(() => {
          this.preloaderOverlay.style.display = 'none';
        }, 550);
      }
    }, 350);
  }

  onVanLoadError(err) {
    console.warn('Van loading error:', err);
    this.modelLoaded = true;
    if (this.progressInterval) clearInterval(this.progressInterval);
    this.updatePreloaderUI(100, 'Ready!');
    setTimeout(() => {
      if (this.preloaderOverlay) {
        this.preloaderOverlay.classList.add('fade-out');
        setTimeout(() => {
          this.preloaderOverlay.style.display = 'none';
        }, 550);
      }
    }, 250);
  }

  updatePreloaderUI(pct, text) {
    if (this.preloaderFill) this.preloaderFill.style.width = `${pct}%`;
    if (this.preloaderPct) this.preloaderPct.textContent = `${pct}%`;
    if (this.preloaderStatus && text) this.preloaderStatus.textContent = text;
  }

  setupAAAGroundedShadow() {
    // AAA Greybox Global Illumination (GI) Lighting
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.25);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

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
      if (this.isMobile) return;
      const mode = this.cameraManager.toggleMode();
      let label = 'Third-Person Chase';
      let btnText = '📷 3RD CAM';
      if (mode === 'ISOMETRIC_CLOSE') {
        label = '3D Isometric (Close)';
        btnText = '📐 ISO CLOSE';
      } else if (mode === 'ISOMETRIC_FAR') {
        label = '3D Isometric (Wide Overview)';
        btnText = '🌐 ISO WIDE';
      }
      this.showToast(`Camera: ${label}`);
      if (this.uiCamBtn) {
        this.uiCamBtn.innerText = btnText;
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
      this.vanModel.update(0, this.vehiclePhysics, null);
      this.cameraManager.snap(this.vanModel.root, this.vehiclePhysics);
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
      if (this.isMobile) {
        this.uiCamBtn.style.display = 'none';
      } else {
        this.uiCamBtn.innerText = '📷 3RD CAM';
      }
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
    const bgDusk = document.getElementById('menu-bg-dusk');
    const bgMorning = document.getElementById('menu-bg-morning');
    if (bgDusk && bgMorning) {
      let isDuskActive = true;
      setInterval(() => {
        isDuskActive = !isDuskActive;
        if (isDuskActive) {
          bgDusk.classList.add('active');
          bgMorning.classList.remove('active');
        } else {
          bgMorning.classList.add('active');
          bgDusk.classList.remove('active');
        }
      }, 10000);
    }

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

      // Ensure van model and camera are immediately placed behind the car upon start
      this.vanModel.update(0, this.vehiclePhysics, null);
      this.cameraManager.snap(this.vanModel.root, this.vehiclePhysics);
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

    // Volume Slider in Options Modal
    this.optVolumeSlider = document.getElementById('opt-volume-slider');
    this.volSliderLabel = document.getElementById('vol-slider-label');
    if (this.optVolumeSlider) {
      this.optVolumeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (this.volSliderLabel) this.volSliderLabel.innerText = `${val}%`;
        this.audio.setVolume(val / 100);
      });
    }

    // Day / Night Pill Indicators
    this.uiDayNightPill = document.getElementById('day-night-pill');
    this.uiDnIcon = document.getElementById('dn-icon');
    this.uiDnText = document.getElementById('dn-text');

    if (btnOptCam) {
      if (this.isMobile) {
        const camRow = btnOptCam.closest('.menu-setting-row');
        if (camRow) camRow.style.display = 'none';
      } else {
        btnOptCam.addEventListener('click', () => {
          const mode = this.cameraManager.toggleMode();
          let btnText = '📷 3RD CAM';
          let label = 'Third-Person Chase';
          if (mode === 'ISOMETRIC_CLOSE') {
            btnText = '📐 ISO CLOSE';
            label = '3D Isometric (Close)';
          } else if (mode === 'ISOMETRIC_FAR') {
            btnText = '🌐 ISO WIDE';
            label = '3D Isometric (Wide Overview)';
          }
          btnOptCam.innerText = btnText;
          if (this.uiCamBtn) this.uiCamBtn.innerText = btnText;
          this.showToast(`Camera: ${label}`);
        });
      }
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

  initFullscreenToggle() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          const docEl = document.documentElement;
          const rfs = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
          if (rfs) {
            rfs.call(docEl).catch(() => {});
          }
          this.showToast('🖥️ Fullscreen: Enabled (Press F to exit)');
        } else {
          const efs = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
          if (efs) {
            efs.call(document).catch(() => {});
          }
          this.showToast('🖥️ Fullscreen: Exited');
        }
      }
    });
  }

  initUiAudio() {
    let lastHoveredBtn = null;
    let lastHoverTime = 0;

    // Play subtle audio blip when pointer hovers over any interactive button
    document.addEventListener('pointerenter', (e) => {
      const btn = e.target.closest('button, .menu-btn, .btn-top-action, .btn-drive-start, .guide-tab-btn, .guide-btn-close, input[type="range"]');
      if (btn && btn !== lastHoveredBtn) {
        const now = performance.now();
        if (now - lastHoverTime > 35) {
          this.audio.playUiHover();
          lastHoverTime = now;
        }
        lastHoveredBtn = btn;
      }
    }, true);

    document.addEventListener('pointerleave', (e) => {
      const btn = e.target.closest('button, .menu-btn, .btn-top-action, .btn-drive-start, .guide-tab-btn, .guide-btn-close, input[type="range"]');
      if (btn && btn === lastHoveredBtn) {
        lastHoveredBtn = null;
      }
    }, true);

    // Play crisp confirmation sound when any button is clicked
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, .menu-btn, .btn-top-action, .btn-drive-start, .guide-tab-btn, .guide-btn-close');
      if (btn) {
        this.audio.playUiClick();
      }
    }, true);
  }

  initMenuGamepadNavigation() {
    this.gamepadMenuIndex = 0;
    this.gamepadNavCooldown = 0;
    this.prevGpButtons = {};
    this.lastFocusedElement = null;
  }

  updateMenuGamepad(dt) {
    if (!this.input || !this.input.pollGamepad) return;
    const gp = this.input.pollGamepad();
    if (!gp) {
      if (this.lastFocusedElement) {
        this.lastFocusedElement.classList.remove('gamepad-focused');
        this.lastFocusedElement = null;
      }
      return;
    }

    if (this.gamepadNavCooldown > 0) {
      this.gamepadNavCooldown -= dt;
    }

    const garageModal = document.getElementById('garage-modal');
    const optionsModal = document.getElementById('options-modal');
    const guideModal = document.getElementById('guide-modal');
    const mainMenu = document.getElementById('main-menu-screen');

    let activeContainer = null;
    let isModal = false;

    if (guideModal && guideModal.classList.contains('open')) {
      activeContainer = guideModal;
      isModal = true;
    } else if (optionsModal && optionsModal.classList.contains('open')) {
      activeContainer = optionsModal;
      isModal = true;
    } else if (garageModal && garageModal.classList.contains('open')) {
      activeContainer = garageModal;
      isModal = true;
    } else if (this.inMainMenu && mainMenu && !mainMenu.classList.contains('hidden')) {
      activeContainer = mainMenu;
    }

    // When playing in-game (no menu active), pressing Start button (9) opens the main menu
    const btnStart = Boolean(gp.buttons[9] && gp.buttons[9].pressed);
    if (!activeContainer) {
      if (this.lastFocusedElement) {
        this.lastFocusedElement.classList.remove('gamepad-focused');
        this.lastFocusedElement = null;
      }
      if (btnStart && !this.prevGpButtons[9]) {
        this.inMainMenu = true;
        this.audio.silenceEngine();
        this.audio.playUiClick();
        if (mainMenu) mainMenu.classList.remove('hidden');
        this.gamepadMenuIndex = 0;
      }
      this.prevGpButtons[9] = btnStart;
      return;
    }

    // Find all visible interactive elements in current active container
    const interactiveElements = Array.from(
      activeContainer.querySelectorAll('button, input[type="range"]')
    ).filter(el => el.offsetParent !== null && !el.disabled && el.style.display !== 'none');

    if (interactiveElements.length === 0) return;

    if (this.gamepadMenuIndex < 0 || this.gamepadMenuIndex >= interactiveElements.length) {
      this.gamepadMenuIndex = 0;
    }

    // Gamepad Navigation Inputs (D-Pad or Left Analog Stick)
    const stickY = gp.axes[1] || 0;
    const stickX = gp.axes[0] || 0;
    const dpadUp = Boolean(gp.buttons[12] && gp.buttons[12].pressed);
    const dpadDown = Boolean(gp.buttons[13] && gp.buttons[13].pressed);
    const dpadLeft = Boolean(gp.buttons[14] && gp.buttons[14].pressed);
    const dpadRight = Boolean(gp.buttons[15] && gp.buttons[15].pressed);

    const navUp = dpadUp || (stickY < -0.45);
    const navDown = dpadDown || (stickY > 0.45);
    const navLeft = dpadLeft || (stickX < -0.45);
    const navRight = dpadRight || (stickX > 0.45);

    if (this.gamepadNavCooldown <= 0) {
      if (navUp) {
        this.gamepadMenuIndex = (this.gamepadMenuIndex - 1 + interactiveElements.length) % interactiveElements.length;
        this.gamepadNavCooldown = 0.22;
        this.audio.playUiHover();
      } else if (navDown) {
        this.gamepadMenuIndex = (this.gamepadMenuIndex + 1) % interactiveElements.length;
        this.gamepadNavCooldown = 0.22;
        this.audio.playUiHover();
      }
    }

    if (!navUp && !navDown) {
      if (this.gamepadNavCooldown > 0) this.gamepadNavCooldown = 0;
    }

    // Update focused element visual state
    const currentEl = interactiveElements[this.gamepadMenuIndex];
    if (this.lastFocusedElement !== currentEl) {
      if (this.lastFocusedElement) {
        this.lastFocusedElement.classList.remove('gamepad-focused');
      }
      if (currentEl) {
        currentEl.classList.add('gamepad-focused');
        this.lastFocusedElement = currentEl;
      }
    }

    // Volume Slider horizontal control via D-Pad Left/Right or Stick X
    if (currentEl && currentEl.type === 'range') {
      if (this.gamepadNavCooldown <= 0 && (navLeft || navRight)) {
        const step = 5;
        const currentVal = parseInt(currentEl.value, 10);
        const newVal = navLeft ? Math.max(0, currentVal - step) : Math.min(100, currentVal + step);
        if (newVal !== currentVal) {
          currentEl.value = newVal;
          currentEl.dispatchEvent(new Event('input', { bubbles: true }));
          this.audio.playUiHover();
          this.gamepadNavCooldown = 0.12;
        }
      }
    }

    // Button A (0) - Confirm / Click
    const btnA = Boolean(gp.buttons[0] && gp.buttons[0].pressed);
    if (btnA && !this.prevGpButtons[0]) {
      if (currentEl) {
        this.audio.playUiClick();
        currentEl.click();
      }
    }
    this.prevGpButtons[0] = btnA;

    // Button B (1) - Back / Cancel / Close Modal
    const btnB = Boolean(gp.buttons[1] && gp.buttons[1].pressed);
    if (btnB && !this.prevGpButtons[1]) {
      this.audio.playUiClick();
      if (isModal) {
        if (guideModal && guideModal.classList.contains('open')) {
          const btnClose = document.getElementById('btn-close-guide');
          if (btnClose) btnClose.click();
        } else if (optionsModal && optionsModal.classList.contains('open')) {
          const btnClose = document.getElementById('btn-close-options');
          if (btnClose) btnClose.click();
        } else if (garageModal && garageModal.classList.contains('open')) {
          const btnClose = document.getElementById('btn-close-garage');
          if (btnClose) btnClose.click();
        }
        this.gamepadMenuIndex = 0;
      } else if (this.inMainMenu) {
        const btnCareer = document.getElementById('btn-menu-career');
        if (btnCareer) btnCareer.click();
      }
    }
    this.prevGpButtons[1] = btnB;

    // Start Button (9)
    if (btnStart && !this.prevGpButtons[9]) {
      this.audio.playUiClick();
      if (isModal) {
        if (optionsModal && optionsModal.classList.contains('open')) {
          const btnClose = document.getElementById('btn-options-back');
          if (btnClose) btnClose.click();
        } else if (garageModal && garageModal.classList.contains('open')) {
          const btnClose = document.getElementById('btn-close-garage');
          if (btnClose) btnClose.click();
        } else if (guideModal && guideModal.classList.contains('open')) {
          const btnClose = document.getElementById('btn-close-guide');
          if (btnClose) btnClose.click();
        }
      } else if (this.inMainMenu) {
        if (currentEl) currentEl.click();
      }
    }
    this.prevGpButtons[9] = btnStart;
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

  updateDayNightCycle(dt) {
    this.cycleTime = (this.cycleTime + dt) % this.dayNightCycleDuration;
    const t = this.cycleTime;

    // Day is 0..60s (peak mid-day at 25-30s), Night is 60..120s (peak midnight at 85-90s)
    let dayFactor = 0; // 1 = full day, 0 = full night
    if (t < 50.0) {
      dayFactor = 1.0;
    } else if (t < 60.0) {
      // Dusk transition over 10s (50s to 60s)
      const p = (t - 50.0) / 10.0;
      dayFactor = 0.5 * (1 + Math.cos(Math.PI * p));
    } else if (t < 110.0) {
      dayFactor = 0.0;
    } else {
      // Dawn transition over 10s (110s to 120s)
      const p = (t - 110.0) / 10.0;
      dayFactor = 0.5 * (1 - Math.cos(Math.PI * p));
    }

    // Atmospheric colors
    const daySky = new THREE.Color(0x93c5fd);
    const nightSky = new THREE.Color(0x090e1a);
    const duskSky = new THREE.Color(0xd97706);

    const currentSky = new THREE.Color();
    if (t >= 50.0 && t < 60.0) {
      const p = (t - 50.0) / 10.0;
      currentSky.copy(daySky).lerp(duskSky, Math.sin(p * Math.PI));
      currentSky.lerp(nightSky, p);
    } else if (t >= 110.0) {
      const p = (t - 110.0) / 10.0;
      currentSky.copy(nightSky).lerp(duskSky, Math.sin(p * Math.PI));
      currentSky.lerp(daySky, p);
    } else if (dayFactor > 0.5) {
      currentSky.copy(daySky);
    } else {
      currentSky.copy(nightSky);
    }

    // Update Scene Sky & Fog
    if (this.scene.background && this.scene.background.isColor) {
      this.scene.background.copy(currentSky);
    } else {
      this.scene.background = currentSky.clone();
    }

    if (this.scene.fog) {
      this.scene.fog.color.copy(currentSky);
    }

    // Directional Sun / Moon
    if (this.sunLight) {
      const sunDay = new THREE.Color(0xfffaed);
      const sunNight = new THREE.Color(0x60a5fa);
      this.sunLight.color.copy(sunNight).lerp(sunDay, dayFactor);
      this.sunLight.intensity = THREE.MathUtils.lerp(0.2, 1.35, dayFactor);
    }

    // Hemisphere & Ambient GI
    if (this.hemiLight) {
      this.hemiLight.intensity = THREE.MathUtils.lerp(0.25, 1.25, dayFactor);
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = THREE.MathUtils.lerp(0.12, 0.40, dayFactor);
    }

    // Headlights turn on automatically as it gets darker (dayFactor < 0.45)
    const headlightsShouldBeOn = dayFactor < 0.45;
    if (this.vanModel && this.vanModel.setHeadlights) {
      this.vanModel.setHeadlights(headlightsShouldBeOn);
    }

    // HUD Day / Night Indicator
    const isNightNow = dayFactor < 0.5;
    if (this.uiDnIcon && this.uiDnText) {
      if (isNightNow) {
        const nightRemain = Math.max(1, Math.round(120.0 - t));
        this.uiDnIcon.innerText = '🌙';
        this.uiDnText.innerText = `NIGHT (${nightRemain}s)`;
        if (this.uiDayNightPill) {
          this.uiDayNightPill.style.background = 'rgba(99, 102, 241, 0.22)';
          this.uiDayNightPill.style.borderColor = 'rgba(129, 140, 248, 0.65)';
        }
      } else {
        const dayRemain = Math.max(1, Math.round(60.0 - t));
        this.uiDnIcon.innerText = '☀️';
        this.uiDnText.innerText = `DAY (${dayRemain}s)`;
        if (this.uiDayNightPill) {
          this.uiDayNightPill.style.background = 'rgba(0, 229, 255, 0.18)';
          this.uiDayNightPill.style.borderColor = 'rgba(0, 229, 255, 0.45)';
        }
      }
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

    const dt = Math.min(this.clock.getDelta(), 0.08);

    // Update Gamepad Menu Navigation (functions on main menu, sub-modals, and in-game)
    this.updateMenuGamepad(dt);

    // When on the main menu, silence all vehicle audio and skip simulation updates
    if (this.inMainMenu) {
      if (this.audio) this.audio.silenceEngine();
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // 0. Update Dynamic Day-Night Cycle (1 min Day, 1 min Night, Auto Headlights)
    this.updateDayNightCycle(dt);

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
    const isDonut = Boolean(this.input.handbrake && this.input.throttle > 0);
    const isSkidding = isDonut || ((this.input.handbrake || this.vehiclePhysics.isDrifting || this.vehiclePhysics.slipSpeed > 2.0) && Math.abs(this.vehiclePhysics.speed) > 1.2);
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
