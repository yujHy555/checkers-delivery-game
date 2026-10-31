import {
  Engine,
  Scene,
  FreeCamera,
  Vector2,
  Vector3,
  Color3,
  Color4,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  HDRCubeTexture,
  EXRCubeTexture,
  PhotoDome,
  ImageProcessingConfiguration,
  Texture,
  VertexBuffer,
  _HDRTextureLoader,
  HDRTools,
  ShaderMaterial,
  Effect,
  Tools,
  HavokPlugin,
  PhysicsAggregate,
  PhysicsShapeType
} from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import '@babylonjs/loaders';
import { ArcadeVehicle } from './physics/ArcadeVehicle.js';
import { VanModel } from './entities/VanModel.js';
import { CityWorld } from './world/CityWorld.js';
import { DeliverySystem } from './systems/DeliverySystem.js';
import { CameraManager } from './systems/CameraManager.js';
import { AudioSynth } from './systems/AudioSynth.js';
import { InputManager } from './systems/InputManager.js';
import { NitroSystem } from './systems/NitroSystem.js';
import { TextureGenerator } from './utils/TextureGenerator.js';

class GameApp {
  constructor() {
    // 0. Initialize Preloader IMMEDIATELY so bar & status animate without delay
    this.initPreloader();

    this.canvas = document.getElementById('renderCanvas');
    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      (window.innerWidth <= 960 && 'ontouchstart' in window);
    this.isMobile = isMobile;

    // 1. Babylon.js 3D Engine & Scene Setup
    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      powerPreference: 'high-performance',
      adaptToDeviceRatio: true
    });

    this.scene = new Scene(this.engine);
    this.scene.useRightHandedSystem = true;

    // 11:00 AM bright daylight atmosphere (fog disabled as requested)
    this.scene.clearColor = new Color4(0.70, 0.82, 0.93, 1.0);
    this.scene.fogMode = Scene.FOGMODE_NONE;

    // 2. Camera Manager (Starts in Third-Person Chase Cam)
    this.camera = new FreeCamera('mainCam', new Vector3(0, 2.45, -6.4), this.scene);
    this.camera.layerMask = 0x0FFFFFFF;
    this.camera.minZ = 0.1; // 10cm near clipping plane prevents geometry near camera from clipping open
    this.camera.maxZ = 1200; // Maximizes depth buffer precision across the entire scene to eliminate z-fighting
    this.cameraManager = new CameraManager(this.camera, this.canvas);

    // 3. World Environment (Single seamlessly-tiled 4K photo road floor with PBR & normal mapping)
    this.world = new CityWorld(this.scene);
    this.cameraManager.setColliders(this.world.colliders);

    // Track pre-compilation readiness of both level grounds so level start is 100% instant
    this.levelGroundsReady = false;

    // 4. Arcade Vehicle Physics (Spawn at origin on seamless road floor)
    this.vehiclePhysics = new ArcadeVehicle(this.scene, { x: 0, y: 0.355, z: 0, heading: 0 });
    this.vehiclePhysics.setColliders(this.world.colliders);

    // 4b. Havok Physics V2 (WASM) Initialization for World Colliders & Vehicle Chassis/Raycast
    this.initHavok();

    // 5. Van Model (Asynchronously loads custom 3D Kei Van body)
    this.vanModel = new VanModel(this.scene, {
      onProgress: (xhr) => this.onVanProgress(xhr),
      onLoaded: () => this.onVanLoaded(),
      onError: (err) => this.onVanLoadError(err)
    });

    // Immediate initial pose sync
    this.vanModel.update(0, this.vehiclePhysics, null);
    this.cameraManager.snap(this.vanModel.root, this.vehiclePhysics);

    // 6. Global Illumination Lighting & Directional Sun Shadows
    this.setupLighting();

    // 7. Delivery Mission System
    this.deliverySystem = new DeliverySystem(this.scene, this.world.deliverySpots, this.shadowGenerator, this.sunLight);

    // 7b. Nitro Pickup & Speed Boost System (5s spurt to 100-110 km/h with animated turquoise aura)
    this.nitroSystem = new NitroSystem(this.scene, this.shadowGenerator, this.sunLight);
    this.nitroSystem.loadLevelPickups('city');
    this.nitroSystem.onPickupCollected = () => {
      this.showCollectionPopup('nitro', {
        tag: 'SPEED BOOST',
        title: 'NITROS +5 SEC',
        icon: '/assets/nitro_bottle.png',
        color: '#1bb1aa'
      });
    };

    // 8. Audio Synthesizer (Web Audio API)
    this.audio = new AudioSynth();

    // 9. Input Manager
    this.input = new InputManager();

    // Setup Callbacks
    this.setupInputCallbacks();

    // UI Cache
    this.cacheUIElements();

    // Menu State: Start in Main Menu with engine audio strictly silenced
    this.inMainMenu = true;

    // Permanent Daytime (Day-to-night cycle removed as requested)
    this.setupPermanentDaytime();

    // Resize listener
    window.addEventListener('resize', () => this.engine.resize());

    // Audio unlock on first interaction
    const unlockAudio = () => {
      this.audio.resume();
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    // Initialize UI Audio, Fullscreen Toggle, and Menu Navigation
    this.initUiAudio();
    this.initFullscreenToggle();
    this.initMenuNavigation();
    this.initMenuGamepadNavigation();

    // Start Babylon.js Render Loop
    this.lastTime = performance.now();
    this.engine.runRenderLoop(() => this.renderFrame());
  }

  async initHavok() {
    try {
      const havokInstance = await HavokPhysics({ locateFile: () => '/wasm/HavokPhysics.wasm' });
      this.havokPlugin = new HavokPlugin(true, havokInstance);
      this.scene.enablePhysics(new Vector3(0, -22.0, 0), this.havokPlugin);
      this.world.initHavokPhysics(PhysicsAggregate, PhysicsShapeType);
      this.vehiclePhysics.initHavokVehicle(this.havokPlugin, PhysicsAggregate, PhysicsShapeType);
      console.log('✅ Havok Physics V2 (WASM) initialized for world & van!');
    } catch (err) {
      console.warn('ℹ️ Havok WASM initialization fallback:', err);
    }
  }

  setupLighting() {
    // 1. Soft Ambient Sky Fill from HDRI Environment (Balanced for bright, clear vehicle illumination)
    this.hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), this.scene);
    this.hemiLight.diffuse = new Color3(0.85, 0.90, 0.98); // Natural, clear sky ambient fill
    this.hemiLight.groundColor = new Color3(0.12, 0.12, 0.15); // Deep, clean ground bounce allows shadows to be noticeably darker
    this.hemiLight.intensity = 0.28;

    // 2. High-Precision Environment Sun Light with Advanced Contact Hardening Soft Shadows
    // Primary celestial key light casting bright, natural direct sunlight across the entire level
    // High-elevation overhead sun illuminates all sides of the car so the shadow is cast purely onto the ground
    this.sunLight = new DirectionalLight('sunLight', new Vector3(-0.25, -0.92, 0.28).normalize(), this.scene);
    this.sunLight.diffuse = new Color3(1.0, 0.98, 0.92); // Warm white-gold sunlight
    this.sunLight.intensity = 3.4;
    this.sunLight.position.set(13, 46, -14);

    // Focused 28m x 28m ortho bounds centered on van for deep, razor-crisp shadows on road, bumps, and ramps
    this.sunLight.autoUpdateExtends = false;
    this.sunLight.orthoLeft = -14;
    this.sunLight.orthoRight = 14;
    this.sunLight.orthoTop = 14;
    this.sunLight.orthoBottom = -14;
    this.sunLight.shadowMinZ = 1;
    this.sunLight.shadowMaxZ = 120;

    // 3. High-Quality Percentage Closer Filtering (PCF) Soft Shadow Generator
    // PCF guarantees deep, consistent, unbroken shadows across all terrain shapes: asphalt, speed bumps, and ramps
    const shadowRes = this.isMobile ? 1024 : 2048;
    this.shadowGenerator = new ShadowGenerator(shadowRes, this.sunLight);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;
    this.shadowGenerator.transparencyShadow = true;
    this.shadowGenerator.enableSoftTransparentShadow = true;
    this.shadowGenerator.bias = 0.0002;
    this.shadowGenerator.normalBias = 0.0005;
    this.shadowGenerator.darkness = 0.0; // Deepest, pitch-dark shadow intensity (0 = 100% black shadow core)

    // 4. Image-Based Lighting & GI from Referenced HDRIs (Preloaded & optimized for both City & Proving Ground at startup)
    this.hdrCache = {};
    this.domeCache = {};
    this.currentHdrPath = null;
    this.preloadAllEnvironmentHDRs();
    this.setEnvironmentHDR('/assets/canary_wharf_2k.hdr');

    // 5. Direct Forward ACES Tone Mapping (Zero post-processing passes, rock-solid frame rate & peak performance)
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.scene.imageProcessingConfiguration.exposure = 1.10;
    this.scene.imageProcessingConfiguration.contrast = 1.25;

    this.attachVanShadowCasters();
  }

  preloadAllEnvironmentHDRs() {
    this.hdrsReadyCount = 0;
    this.totalHdrsToPreload = 2;
    this.allHdrsReady = false;

    // Preload both City and Proving Ground HDRIs in parallel during startup so switching levels is 100% instantaneous!
    const hdrConfigs = [
      { path: '/assets/canary_wharf_2k.hdr', iblPath: '/assets/canary_wharf_ibl.hdr' },
      { path: '/assets/modern_evening_street_2k.hdr', iblPath: '/assets/modern_evening_street_ibl.hdr' }
    ];

    for (const cfg of hdrConfigs) {
      this.ensureHDRLoaded(cfg.path, cfg.iblPath);
    }

    // Pre-compile BOTH the City Asphalt Road PBR Material AND Proving Ground Grid PBR Material
    // on the actual ground mesh during the initial startup preloader screen.
    // This strictly eliminates any ground-pop or late material loading when starting levels!
    const groundCompiles = [];
    if (this.world && this.world.ground) {
      if (this.world.roadPBRMat) {
        groundCompiles.push(this.world.roadPBRMat.forceCompilationAsync(this.world.ground).catch(() => {}));
      }
      if (this.world.gridPBRMat) {
        groundCompiles.push(this.world.gridPBRMat.forceCompilationAsync(this.world.ground).catch(() => {}));
      }
    }
    Promise.all(groundCompiles).then(() => {
      this.levelGroundsReady = true;
      this.tryFinishPreloader();
    });
  }

  ensureHDRLoaded(hdrPath, iblPathOverride = null) {
    if (!this.hdrCache) this.hdrCache = {};
    if (!this.domeCache) this.domeCache = {};

    const isProvingHdr = hdrPath.includes('modern_evening_street') || hdrPath.includes('highway_bridge');
    const iblPath = iblPathOverride || (isProvingHdr ? '/assets/modern_evening_street_ibl.hdr' : '/assets/canary_wharf_ibl.hdr');

    if (!this.hdrCache[hdrPath]) {
      // Ultra-fast 32KB 128x64 IBL HDR source -> 64x64 cubemap prefiltered in <2ms on CPU/GPU
      const isExr = iblPath.toLowerCase().endsWith('.exr');
      this.hdrCache[hdrPath] = isExr
        ? new EXRCubeTexture(iblPath, this.scene, 64, false, true, false, true)
        : new HDRCubeTexture(iblPath, this.scene, 64, false, true, false, true);
    }

    if (!this.domeCache[hdrPath]) {
      // Diameter 1000m (radius 500m) keeps all vertices comfortably inside the camera maxZ (1200m)
      // preventing any far-plane clipping against the sky clearColor!
      const dome = new PhotoDome(`skyDome_${hdrPath}`, hdrPath, {
        resolution: 32,
        size: 1000,
        useDirectMapping: true
      }, this.scene);
      dome.mesh.isPickable = false;
      dome.mesh.applyFog = false;
      dome.mesh.infiniteDistance = true;
      dome.mesh.alwaysSelectAsActiveMesh = true;

      // Position dome slightly lowered on Y so the horizon matches eye level
      dome.mesh.position.y = isProvingHdr ? -10 : -4;

      // Crucial: The PhotoDome is a pure emissive unlit 360 sky sphere.
      // Exclude it from all scene dynamic lights so shader compilation does not hit
      // WebGL2's GL_MAX_VERTEX_UNIFORM_BUFFERS limit (which previously caused shader compilation failure and clipping)!
      for (const l of this.scene.lights) {
        if (!l.excludedMeshes.includes(dome.mesh)) {
          l.excludedMeshes.push(dome.mesh);
        }
      }
      this.scene.onNewLightAddedObservable.add((newLight) => {
        if (!newLight.excludedMeshes.includes(dome.mesh)) {
          newLight.excludedMeshes.push(dome.mesh);
        }
      });

      if (dome.material) {
        dome.material.fovMultiplier = 1.0;
      }

      const tex = dome.photoTexture;
      if (tex) {
        // Natural 1:1 equirectangular spherical mapping with zero tiling or repetition
        tex.wrapU = Texture.CLAMP_ADDRESSMODE;
        tex.wrapV = Texture.CLAMP_ADDRESSMODE;
        tex.uScale = 1.0;
        tex.vScale = 1.0;
        tex.uOffset = 0.0;
        tex.vOffset = 0.0;
        tex.getTextureMatrix();

        tex.onLoadObservable.addOnce(() => {
          const markHdrReady = () => {
            this.hdrsReadyCount = (this.hdrsReadyCount || 0) + 1;
            if (this.hdrsReadyCount >= (this.totalHdrsToPreload || 2)) {
              this.allHdrsReady = true;
              this.tryFinishPreloader();
            }
          };
          if (dome.material && dome.mesh) {
            // Pre-compile the PhotoDome GPU shader while still on the loading screen so level start is 0ms!
            dome.material.forceCompilationAsync(dome.mesh).then(markHdrReady).catch(markHdrReady);
          } else {
            markHdrReady();
          }
        });
      }

      // Start hidden until activated by setEnvironmentHDR
      dome.mesh.setEnabled(false);
      dome.mesh.isVisible = false;
      this.domeCache[hdrPath] = dome;
    }
  }

  setEnvironmentHDR(hdrPath = '/assets/canary_wharf_4k.hdr') {
    if (this.currentHdrPath === hdrPath) return;
    this.currentHdrPath = hdrPath;

    try {
      this.ensureHDRLoaded(hdrPath);

      this.scene.environmentTexture = this.hdrCache[hdrPath];
      this.scene.environmentIntensity = 1.35;

      // Hide all cached PhotoDomes first
      for (const key of Object.keys(this.domeCache)) {
        const d = this.domeCache[key];
        if (d && d.mesh) {
          d.mesh.setEnabled(false);
          d.mesh.isVisible = false;
        }
      }

      this.skyDome = this.domeCache[hdrPath];
      if (this.skyDome && this.skyDome.mesh) {
        this.skyDome.mesh.setEnabled(true);
        this.skyDome.mesh.isVisible = true;
      }
    } catch (err) {
      console.warn('Could not load HDRI/EXR texture:', hdrPath, err);
    }
  }

  attachVanShadowCasters() {
    if (!this.shadowGenerator || !this.vanModel || !this.vanModel.root) return;
    const shadowMap = this.shadowGenerator.getShadowMap();
    if (shadowMap && shadowMap.renderList) {
      shadowMap.renderList = shadowMap.renderList.filter(m => m && !m.isDisposed());
    }
    const meshes = this.vanModel.root.getChildMeshes();
    for (const m of meshes) {
      if (m && !m.isDisposed()) {
        const name = (m.name || '').toLowerCase();
        // Exclude speed lines and underbody AO shadow quads from casting directional shadows
        if (name.includes('speedline') || name.startsWith('sl_') || name.includes('chassisbelly')) continue;

        m.receiveShadows = false; // Strictly guarantees the vehicle NEVER receives any shadow
        if (m.isEnabled()) {
          this.shadowGenerator.addShadowCaster(m, true);
        }
      }
    }
  }

  initPreloader() {
    this.preloaderOverlay = document.getElementById('preloader-overlay');
    this.preloaderFill = document.getElementById('preloader-bar-fill');
    this.preloaderStatus = document.getElementById('preloader-status-text');
    this.preloaderPct = document.getElementById('preloader-percent-text');
    this.modelLoaded = false;

    // Immediately show 15% progress
    this.simulatedProgress = 15;
    this.updatePreloaderUI(15, 'Starting Checkers Sixty60 Engine...');

    this.progressInterval = setInterval(() => {
      if (!this.modelLoaded && this.simulatedProgress < 90) {
        this.simulatedProgress += Math.random() * 5 + 2;
        this.updatePreloaderUI(Math.floor(this.simulatedProgress), 'Downloading Sixty60 Delivery Van...');
      }
    }, 200);

    // Safety timeout: transition smoothly into the game if network pauses or takes > 6s
    this.safetyTimeout = setTimeout(() => {
      if (!this.preloaderDismissed) {
        console.log('ℹ️ Preloader safety fallback activated - proceeding to game');
        this.modelLoaded = true;
        this.allHdrsReady = true;
        this.tryFinishPreloader();
      }
    }, 6000);
  }

  onVanProgress(xhr) {
    const total = xhr.total || 60029200;
    const loaded = xhr.loaded || 0;
    if (total > 0 && loaded > 0) {
      const pct = Math.min(Math.round((loaded / total) * 100), 98);
      const loadedMB = (loaded / (1024 * 1024)).toFixed(1);
      const totalMB = (total / (1024 * 1024)).toFixed(1);
      this.simulatedProgress = Math.max(this.simulatedProgress, pct);
      this.updatePreloaderUI(this.simulatedProgress, `Loading HD Delivery Van (${loadedMB}MB / ${totalMB}MB)...`);
    }
  }

  onVanLoaded() {
    this.modelLoaded = true;
    this.attachVanShadowCasters();
    this.tryFinishPreloader();
  }

  tryFinishPreloader() {
    if (this.preloaderDismissed) return;
    if (!this.modelLoaded) return;
    if (!this.allHdrsReady || !this.levelGroundsReady) {
      this.updatePreloaderUI(98, 'Pre-compiling Level Grounds & HDRIs...');
      return;
    }

    this.preloaderDismissed = true;
    if (this.progressInterval) clearInterval(this.progressInterval);
    if (this.safetyTimeout) clearTimeout(this.safetyTimeout);
    this.updatePreloaderUI(100, 'Van, Grounds & HDRIs Ready! Welcome to Checkers Hyper Sixty60!');

    setTimeout(() => {
      if (this.preloaderOverlay) {
        this.preloaderOverlay.style.pointerEvents = 'none';
        this.preloaderOverlay.classList.add('fade-out');
        setTimeout(() => {
          this.preloaderOverlay.style.display = 'none';
          this.refreshMenuFocus();
        }, 550);
      }
    }, 200);
  }

  onVanLoadError(err) {
    console.warn('Van loading error:', err);
    this.modelLoaded = true;
    if (this.progressInterval) clearInterval(this.progressInterval);
    if (this.safetyTimeout) clearTimeout(this.safetyTimeout);
    this.updatePreloaderUI(100, 'Ready!');
    this.attachVanShadowCasters();
    setTimeout(() => {
      if (this.preloaderOverlay) {
        this.preloaderOverlay.style.pointerEvents = 'none';
        this.preloaderOverlay.classList.add('fade-out');
        setTimeout(() => {
          this.preloaderOverlay.style.display = 'none';
          this.refreshMenuFocus();
        }, 250);
      }
    }, 200);
  }

  updatePreloaderUI(pct, text) {
    if (this.preloaderFill) this.preloaderFill.style.width = `${pct}%`;
    if (this.preloaderPct) this.preloaderPct.textContent = `${pct}%`;
    if (this.preloaderStatus && text) this.preloaderStatus.textContent = text;
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
      const now = performance.now();
      if (this.lastDeliveryTime && (now - this.lastDeliveryTime < 800)) return; // 800ms debounce

      const currentTarget = this.deliverySystem.getCurrentSpot();
      if (!currentTarget) return;

      const vanPos = this.vanModel.root.position;
      const dist = Vector3.Distance(vanPos, currentTarget.position);
      if (dist < 12.0) {
        this.lastDeliveryTime = now;
        this.audio.playDeliveryChime();
        const vanHeading = this.vehiclePhysics ? this.vehiclePhysics.heading : 0;
        const result = this.deliverySystem.completeDelivery(null, vanPos, vanHeading);
        if (result) {
          this.showDeliveryCelebration(result);
        }
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
      if (this.isProvingGround) {
        const sp = this.lastProvingStation || { x: 0, z: -24, heading: 0 };
        this.vehiclePhysics.reset(sp.x, sp.z, sp.heading);
      } else {
        this.vehiclePhysics.reset(2.4, -35, 0);
      }
      if (this.world && this.world.resetCones) {
        this.world.resetCones();
      }
      this.vanModel.update(0, this.vehiclePhysics, null);
      this.cameraManager.snap(this.vanModel.root, this.vehiclePhysics);
      this.showToast(this.isProvingGround ? '🔄 Van & Havok Crates reset!' : 'Van reset on center road!');
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

    // Circular Collection HUD Device (Bag & Nitros)
    this.uiCollectionDevice = document.getElementById('hud-collection-device');
    this.uiCollectionIcon = document.getElementById('hud-device-icon');
    this.uiCollectionTag = document.getElementById('hud-device-tag');
    this.uiCollectionTitle = document.getElementById('hud-device-title');
    this.uiCollectionTimerBar = document.getElementById('hud-device-timer-bar');
    this.deviceTimeout = null;
    this.deviceExitTimeout = null;

    if (this.uiCamBtn) {
      if (this.isMobile) {
        this.uiCamBtn.style.display = 'none';
      } else {
        this.uiCamBtn.innerText = '📷 3RD CAM';
      }
    }

    // Controls Guide Modal
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
      if (guideModal) guideModal.classList.remove('open');
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
    if (bgDusk) bgDusk.classList.add('active');
    if (bgMorning) bgMorning.classList.remove('active');

    // Smoothly transition between the main background image and the sunrise version every 10 seconds
    if (this.menuBgInterval) clearInterval(this.menuBgInterval);
    this.menuBgInterval = setInterval(() => {
      if (bgDusk && bgMorning) {
        const isDuskActive = bgDusk.classList.contains('active');
        bgDusk.classList.toggle('active', !isDuskActive);
        bgMorning.classList.toggle('active', isDuskActive);
      }
    }, 10000);

    const btnMenuCareer = document.getElementById('btn-menu-career');
    const btnMenuNew = document.getElementById('btn-menu-new');
    const btnMenuFreeroam = document.getElementById('btn-menu-freeroam');
    const btnMenuProving = document.getElementById('btn-menu-proving');
    const btnMenuGarage = document.getElementById('btn-menu-garage');
    const btnMenuOptions = document.getElementById('btn-menu-options');
    const btnMenuFullscreen = document.getElementById('btn-menu-fullscreen');
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
    const btnOptFullscreen = document.getElementById('btn-opt-fullscreen');
    const btnTopFullscreen = document.getElementById('btn-top-fullscreen');

    this.isFreeRoam = false;
    this.isProvingGround = false;
    this.initProvingGroundUI();

    const startDriving = (mode = 'career') => {
      console.log('🏁 Starting game in mode:', mode);
      this.inMainMenu = false;
      if (mainMenu) {
        mainMenu.classList.add('hidden');
        mainMenu.style.display = 'none';
      }
      if (garageModal) garageModal.classList.remove('open');
      if (optionsModal) optionsModal.classList.remove('open');
      this.audio.resume();

      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      document.querySelectorAll('.gamepad-focused, .menu-nav-focused').forEach(el => {
        el.classList.remove('gamepad-focused', 'menu-nav-focused');
      });
      this.lastFocusedElement = null;
      this.gamepadMenuIndex = 0;
      this.menuFocusIndex = 0;

      const pgUI = document.getElementById('proving-ground-ui');

      if (mode === 'proving_ground') {
        this.isFreeRoam = true;
        this.isProvingGround = true;
        this.setEnvironmentHDR('/assets/modern_evening_street_2k.hdr');
        if (this.world.currentLevel !== 'proving_ground') {
          this.world.loadLevel('proving_ground');
        }
        if (this.nitroSystem) {
          this.nitroSystem.loadLevelPickups('proving_ground');
        }
        if (this.deliverySystem && this.deliverySystem.beaconGroup) {
          this.deliverySystem.beaconGroup.setEnabled(false);
        }
        if (pgUI) pgUI.classList.add('visible');
        this.vehiclePhysics.reset(0, -24, 0);
        this.showToast('🧪 PROVING GROUND: 1m×1m Grid & 6 Live Physics Stations Ready!');
        if (this.uiOrder) this.uiOrder.innerText = 'Level: Physics Proving Ground';
        if (this.uiTargetDist) this.uiTargetDist.innerText = '1m × 1m Lab Grid';
      } else {
        this.isProvingGround = false;
        this.setEnvironmentHDR('/assets/canary_wharf_2k.hdr');
        if (this.nitroSystem) {
          this.nitroSystem.loadLevelPickups('city');
        }
        if (pgUI) pgUI.classList.remove('visible');
        if (this.world.currentLevel !== 'city') {
          this.world.loadLevel('city');
        }
        if (this.deliverySystem && this.deliverySystem.beaconGroup) {
          this.deliverySystem.beaconGroup.setEnabled(mode !== 'freeroam');
        }

        if (mode === 'freeroam') {
          this.isFreeRoam = true;
          this.showToast('🏁 FREE ROAM: Explore city streets & stunt ramps!');
          if (this.uiOrder) this.uiOrder.innerText = 'Free Roam Mode';
          if (this.uiTargetDist) this.uiTargetDist.innerText = 'Explore Circuit';
        } else if (mode === 'new') {
          this.isFreeRoam = false;
          this.vehiclePhysics.reset(2.4, -35, 0);
          if (this.world && this.world.resetCones) this.world.resetCones();
          this.deliverySystem.score = 0;
          this.showToast('🚀 NEW GAME: Delivery Mission Started!');
        } else {
          this.isFreeRoam = false;
          this.showToast('⚡ CAREER: Sixty60 Delivery Run in progress!');
        }
      }

      this.vanModel.update(0, this.vehiclePhysics, null);
      this.cameraManager.snap(this.vanModel.root, this.vehiclePhysics);
    };

    const openMainMenu = () => {
      this.inMainMenu = true;
      this.audio.silenceEngine();
      if (mainMenu) {
        mainMenu.style.display = 'flex';
        mainMenu.classList.remove('hidden');
      }
      this.refreshMenuFocus();
    };

    if (btnMenuCareer) btnMenuCareer.addEventListener('click', () => startDriving('career'));
    if (btnMenuNew) btnMenuNew.addEventListener('click', () => startDriving('new'));
    if (btnMenuFreeroam) btnMenuFreeroam.addEventListener('click', () => startDriving('freeroam'));
    if (btnMenuProving) btnMenuProving.addEventListener('click', () => startDriving('proving_ground'));

    if (btnMenuGarage) {
      btnMenuGarage.addEventListener('click', () => {
        if (garageModal) {
          garageModal.classList.add('open');
          this.refreshMenuFocus();
        }
      });
    }
    if (btnCloseGarage) {
      btnCloseGarage.addEventListener('click', () => {
        if (garageModal) {
          garageModal.classList.remove('open');
          this.refreshMenuFocus();
        }
      });
    }
    if (btnGarageDrive) {
      btnGarageDrive.addEventListener('click', () => {
        startDriving('career');
      });
    }

    if (btnMenuOptions) {
      btnMenuOptions.addEventListener('click', () => {
        if (optionsModal) {
          optionsModal.classList.add('open');
          this.refreshMenuFocus();
        }
      });
    }
    if (btnCloseOptions) {
      btnCloseOptions.addEventListener('click', () => {
        if (optionsModal) {
          optionsModal.classList.remove('open');
          this.refreshMenuFocus();
        }
      });
    }
    if (btnOptionsBack) {
      btnOptionsBack.addEventListener('click', () => {
        if (optionsModal) {
          optionsModal.classList.remove('open');
          this.refreshMenuFocus();
        }
      });
    }

    if (btnMenuFullscreen) {
      btnMenuFullscreen.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }
    if (btnTopFullscreen) {
      btnTopFullscreen.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }
    if (btnOptFullscreen) {
      btnOptFullscreen.addEventListener('click', () => {
        this.toggleFullscreen();
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

    const btnOptFlares = document.getElementById('btn-opt-flares');
    if (btnOptFlares) {
      btnOptFlares.innerText = '⚡ PERFORMANCE: MAX';
      btnOptFlares.addEventListener('click', () => {
        this.showToast('Post-processing & lens flares disabled for maximum performance');
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
        if (window.confirm('Quit Checkers Sixty60 delivery run and reset session?')) {
          window.location.reload();
        }
      });
    }

    if (btnOpenMainMenu) {
      btnOpenMainMenu.addEventListener('click', () => {
        openMainMenu();
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
        if (mainMenu) {
          if (mainMenu.classList.contains('hidden')) {
            openMainMenu();
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

  toggleFullscreen() {
    const isFullscreen = Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    if (!isFullscreen) {
      const docEl = document.documentElement || document.body;
      const rfs = docEl.requestFullscreen ||
                  docEl.webkitRequestFullscreen ||
                  docEl.mozRequestFullScreen ||
                  docEl.msRequestFullscreen;
      if (rfs) {
        try {
          const res = rfs.call(docEl);
          if (res && res.then) {
            res.then(() => {
              this.updateFullscreenButtons(true);
              this.showToast('🖥️ Fullscreen: Enabled (Press F or click to exit)');
            }).catch((err) => {
              console.warn('Fullscreen request rejected:', err);
              const canvasContainer = document.getElementById('canvas-container') || document.body;
              if (canvasContainer && canvasContainer.requestFullscreen && canvasContainer !== docEl) {
                canvasContainer.requestFullscreen().then(() => {
                  this.updateFullscreenButtons(true);
                  this.showToast('🖥️ Fullscreen: Enabled');
                }).catch(() => {
                  this.showToast('🖥️ Fullscreen requires user click or browser permission');
                });
              } else {
                this.showToast('🖥️ Fullscreen requires user click or browser permission');
              }
            });
          } else {
            this.updateFullscreenButtons(true);
            this.showToast('🖥️ Fullscreen: Enabled');
          }
        } catch (err) {
          console.warn('Fullscreen execution error:', err);
          this.showToast('🖥️ Fullscreen blocked by browser');
        }
      } else {
        this.showToast('🖥️ Fullscreen not supported by this browser');
      }
    } else {
      const efs = document.exitFullscreen ||
                  document.webkitExitFullscreen ||
                  document.mozCancelFullScreen ||
                  document.msExitFullscreen;
      if (efs) {
        try {
          const res = efs.call(document);
          if (res && res.then) {
            res.then(() => {
              this.updateFullscreenButtons(false);
              this.showToast('🖥️ Fullscreen: Exited');
            }).catch(() => {});
          } else {
            this.updateFullscreenButtons(false);
            this.showToast('🖥️ Fullscreen: Exited');
          }
        } catch (_) {}
      }
    }
  }

  updateFullscreenButtons(isFs) {
    const text = isFs ? '🗗 WINDOWED [F]' : '🖥️ FULLSCREEN [F]';
    const btnMenuFs = document.getElementById('btn-menu-fullscreen');
    if (btnMenuFs) {
      const span = btnMenuFs.querySelector('span');
      if (span) span.textContent = text;
      else btnMenuFs.textContent = text;
    }
    const btnTopFs = document.getElementById('btn-top-fullscreen');
    if (btnTopFs) btnTopFs.textContent = text;
    const btnOptFs = document.getElementById('btn-opt-fullscreen');
    if (btnOptFs) btnOptFs.textContent = text;
  }

  initFullscreenToggle() {
    const onFsChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      this.updateFullscreenButtons(isFs);
    };

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('mozfullscreenchange', onFsChange);
    document.addEventListener('MSFullscreenChange', onFsChange);

    // Capture phase listener ensures key F triggers unconditionally anywhere in the application
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if ((e.code === 'KeyF' || e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        this.toggleFullscreen();
      }
    }, true);
  }

  getActiveMenuContainer() {
    const guideModal = document.getElementById('controls-guide-modal');
    const optionsModal = document.getElementById('options-modal');
    const garageModal = document.getElementById('garage-modal');
    const mainMenu = document.getElementById('main-menu-screen');

    if (guideModal && guideModal.classList.contains('open')) return guideModal;
    if (optionsModal && optionsModal.classList.contains('open')) return optionsModal;
    if (garageModal && garageModal.classList.contains('open')) return garageModal;
    if (this.inMainMenu && mainMenu && !mainMenu.classList.contains('hidden') && mainMenu.style.display !== 'none') return mainMenu;
    return null;
  }

  getMenuInteractiveElements(container) {
    if (!container) return [];
    return Array.from(
      container.querySelectorAll('button, input[type="range"]')
    ).filter(el => el.offsetParent !== null && !el.disabled && el.style.display !== 'none');
  }

  setMenuFocus(index, playSound = false) {
    const container = this.getActiveMenuContainer();
    if (!container) return;
    const elements = this.getMenuInteractiveElements(container);
    if (elements.length === 0) return;

    // Clear previous focused elements anywhere in DOM
    document.querySelectorAll('.gamepad-focused, .menu-nav-focused').forEach(el => {
      el.classList.remove('gamepad-focused', 'menu-nav-focused');
    });

    const clampedIndex = (index % elements.length + elements.length) % elements.length;
    this.menuFocusIndex = clampedIndex;
    this.gamepadMenuIndex = clampedIndex;

    const targetEl = elements[clampedIndex];
    if (targetEl) {
      targetEl.classList.add('gamepad-focused', 'menu-nav-focused');
      this.lastFocusedElement = targetEl;
      if (typeof targetEl.focus === 'function') {
        try { targetEl.focus({ preventScroll: true }); } catch (_) {}
      }
      if (playSound && this.audio) {
        try { this.audio.playUiHover(); } catch (_) {}
      }
    }
  }

  refreshMenuFocus(preferredIndex = 0) {
    const container = this.getActiveMenuContainer();
    if (!container) return;
    this.setMenuFocus(preferredIndex, false);
  }

  navigateMenu(direction, playSound = true) {
    const container = this.getActiveMenuContainer();
    if (!container) return;
    const elements = this.getMenuInteractiveElements(container);
    if (elements.length === 0) return;

    let currentIndex = elements.indexOf(this.lastFocusedElement);
    if (currentIndex === -1) currentIndex = this.menuFocusIndex || 0;

    const newIndex = currentIndex + direction;
    this.setMenuFocus(newIndex, playSound);
  }

  initMenuNavigation() {
    this.menuFocusIndex = 0;

    window.addEventListener('keydown', (e) => {
      const container = this.getActiveMenuContainer();
      if (!container) return;

      const elements = this.getMenuInteractiveElements(container);
      if (elements.length === 0) return;

      const activeEl = this.lastFocusedElement || elements[this.menuFocusIndex || 0];
      const isSlider = activeEl && activeEl.type === 'range';

      // 1. Arrow Right / D / Tab (next)
      if (e.code === 'ArrowRight' || e.code === 'KeyD' || (!e.shiftKey && e.code === 'Tab')) {
        if (isSlider && (e.code === 'ArrowRight' || e.code === 'KeyD')) {
          const step = 5;
          const currentVal = parseInt(activeEl.value, 10);
          const newVal = Math.min(100, currentVal + step);
          activeEl.value = newVal;
          activeEl.dispatchEvent(new Event('input', { bubbles: true }));
          if (this.audio) this.audio.playUiHover();
          e.preventDefault();
          return;
        }
        e.preventDefault();
        this.navigateMenu(1, true);
        return;
      }

      // 2. Arrow Left / A / Shift+Tab (prev)
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || (e.shiftKey && e.code === 'Tab')) {
        if (isSlider && (e.code === 'ArrowLeft' || e.code === 'KeyA')) {
          const step = 5;
          const currentVal = parseInt(activeEl.value, 10);
          const newVal = Math.max(0, currentVal - step);
          activeEl.value = newVal;
          activeEl.dispatchEvent(new Event('input', { bubbles: true }));
          if (this.audio) this.audio.playUiHover();
          e.preventDefault();
          return;
        }
        e.preventDefault();
        this.navigateMenu(-1, true);
        return;
      }

      // 3. Arrow Down / S (next element)
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        this.navigateMenu(1, true);
        return;
      }

      // 4. Arrow Up / W (prev element)
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        this.navigateMenu(-1, true);
        return;
      }

      // 5. Enter / Space (trigger focused button)
      if (e.code === 'Enter' || e.code === 'Space') {
        if (activeEl && typeof activeEl.click === 'function') {
          e.preventDefault();
          if (this.audio) this.audio.playUiClick();
          activeEl.click();
        }
        return;
      }
    }, true);
  }

  initUiAudio() {
    let lastHoveredBtn = null;
    let lastHoverTime = 0;

    document.addEventListener('pointerenter', (e) => {
      const btn = e.target.closest('button, .menu-btn, .btn-top-action, .btn-drive-start, .guide-tab-btn, .guide-btn-close, input[type="range"]');
      if (btn && btn !== lastHoveredBtn) {
        const now = performance.now();
        if (now - lastHoverTime > 35) {
          try { this.audio.playUiHover(); } catch (_) {}
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

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, .menu-btn, .btn-top-action, .btn-drive-start, .guide-tab-btn, .guide-btn-close');
      if (btn) {
        try { this.audio.playUiClick(); } catch (_) {}
        btn.classList.remove('gamepad-focused');
      }
    });
  }

  initMenuGamepadNavigation() {
    this.gamepadMenuIndex = 0;
    this.gamepadNavCooldown = 0;
    this.gpNavActive = false;
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
    const guideModal = document.getElementById('controls-guide-modal');
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

    const btnStart = Boolean(gp.buttons[9] && gp.buttons[9].pressed);
    if (!activeContainer) {
      if (this.lastFocusedElement) {
        this.lastFocusedElement.classList.remove('gamepad-focused', 'menu-nav-focused');
        this.lastFocusedElement = null;
      }
      this.lastActiveContainer = null;
      if (btnStart && !this.prevGpButtons[9]) {
        this.inMainMenu = true;
        this.audio.silenceEngine();
        this.audio.playUiClick();
        if (mainMenu) mainMenu.classList.remove('hidden');
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        document.querySelectorAll('.gamepad-focused, .menu-nav-focused').forEach(el => el.classList.remove('gamepad-focused', 'menu-nav-focused'));
        this.lastFocusedElement = null;
        this.gamepadMenuIndex = 0;
        this.refreshMenuFocus();
      }
      this.prevGpButtons[9] = btnStart;
      return;
    }

    if (this.lastActiveContainer !== activeContainer) {
      document.querySelectorAll('.gamepad-focused, .menu-nav-focused').forEach(el => el.classList.remove('gamepad-focused', 'menu-nav-focused'));
      this.lastFocusedElement = null;
      this.gamepadMenuIndex = 0;
      this.lastActiveContainer = activeContainer;
      this.refreshMenuFocus();
    }

    const interactiveElements = Array.from(
      activeContainer.querySelectorAll('button, input[type="range"]')
    ).filter(el => el.offsetParent !== null && !el.disabled && el.style.display !== 'none');

    if (interactiveElements.length === 0) return;

    if (this.gamepadMenuIndex < 0 || this.gamepadMenuIndex >= interactiveElements.length) {
      this.gamepadMenuIndex = 0;
    }

    const stickY = gp.axes[1] || 0;
    const stickX = gp.axes[0] || 0;
    const dpadUp = Boolean(gp.buttons[12] && gp.buttons[12].pressed);
    const dpadDown = Boolean(gp.buttons[13] && gp.buttons[13].pressed);
    const dpadLeft = Boolean(gp.buttons[14] && gp.buttons[14].pressed);
    const dpadRight = Boolean(gp.buttons[15] && gp.buttons[15].pressed);

    const navThreshold = 0.28;
    const navUp = dpadUp || (stickY < -navThreshold);
    const navDown = dpadDown || (stickY > navThreshold);
    const navLeft = dpadLeft || (stickX < -navThreshold);
    const navRight = dpadRight || (stickX > navThreshold);

    const isNavActive = navUp || navDown || navLeft || navRight;
    const currentEl = interactiveElements[this.gamepadMenuIndex];
    const isSlider = currentEl && currentEl.type === 'range';

    let shouldStepPrev = false;
    let shouldStepNext = false;

    if (isSlider) {
      if (navLeft || navRight) {
        if (!this.gpNavActive || this.gamepadNavCooldown <= 0) {
          const step = 5;
          const currentVal = parseInt(currentEl.value, 10);
          const newVal = navLeft ? Math.max(0, currentVal - step) : Math.min(100, currentVal + step);
          if (newVal !== currentVal) {
            currentEl.value = newVal;
            currentEl.dispatchEvent(new Event('input', { bubbles: true }));
            this.audio.playUiHover();
          }
          this.gamepadNavCooldown = this.gpNavActive ? 0.08 : 0.22;
          this.gpNavActive = true;
        }
      } else if (navUp) {
        shouldStepPrev = true;
      } else if (navDown) {
        shouldStepNext = true;
      }
    } else {
      // Normal buttons: fully supports both horizontal Left/Right and vertical Up/Down
      if (navLeft || navUp) {
        shouldStepPrev = true;
      } else if (navRight || navDown) {
        shouldStepNext = true;
      }
    }

    if (shouldStepPrev || shouldStepNext) {
      // Immediate edge-triggered step on first press; fast auto-repeat while held
      if (!this.gpNavActive || this.gamepadNavCooldown <= 0) {
        if (shouldStepPrev) {
          this.gamepadMenuIndex = (this.gamepadMenuIndex - 1 + interactiveElements.length) % interactiveElements.length;
        } else {
          this.gamepadMenuIndex = (this.gamepadMenuIndex + 1) % interactiveElements.length;
        }
        this.audio.playUiHover();
        this.gamepadNavCooldown = this.gpNavActive ? 0.11 : 0.22;
        this.gpNavActive = true;
      }
    }

    if (!isNavActive) {
      this.gpNavActive = false;
      this.gamepadNavCooldown = 0;
    }

    const activeEl = interactiveElements[this.gamepadMenuIndex];
    if (this.lastFocusedElement !== activeEl) {
      if (this.lastFocusedElement) {
        this.lastFocusedElement.classList.remove('gamepad-focused', 'menu-nav-focused');
      }
      if (activeEl) {
        activeEl.classList.add('gamepad-focused', 'menu-nav-focused');
        this.lastFocusedElement = activeEl;
        this.menuFocusIndex = this.gamepadMenuIndex;
      }
    }

    const btnA = Boolean(gp.buttons[0] && gp.buttons[0].pressed);
    if (btnA && !this.prevGpButtons[0]) {
      if (activeEl) {
        this.audio.playUiClick();
        activeEl.click();
      }
    }
    this.prevGpButtons[0] = btnA;

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
        if (activeEl) activeEl.click();
      }
    }
    this.prevGpButtons[9] = btnStart;
  }

  showDeliveryCelebration(result) {
    // Show circular collection device with Bag icon (stays 5s or updates with latest item)
    this.showCollectionPopup('bag', {
      tag: 'BAG DELIVERED',
      title: '+500 POINTS',
      icon: '/assets/checkers_delivery_bag.png',
      color: '#ffeb3b'
    });

    const banner = document.getElementById('celebration-banner');
    if (banner) {
      const count = (result && typeof result.deliveredCount === 'number') ? result.deliveredCount : 1;
      banner.innerHTML = `
        <div style="font-size: 28px; font-weight: 900; color: #ffeb3b; text-shadow: 0 0 12px #ff9800;">
          DELIVERED IN A FLASH! ⚡
        </div>
        <div style="font-size: 18px; margin-top: 6px; color: #ffffff;">
          +500 POINTS &bull; Total Deliveries: ${count}
        </div>
      `;
      banner.classList.add('active');
      if (this.celebrationTimer) clearTimeout(this.celebrationTimer);
      this.celebrationTimer = setTimeout(() => banner.classList.remove('active'), 3000);
    }
  }

  showCollectionPopup(type, config) {
    if (!this.uiCollectionDevice || !this.uiCollectionIcon) return;

    // If an existing popup is active, immediately cancel previous timers to show latest item
    if (this.deviceTimeout) clearTimeout(this.deviceTimeout);
    if (this.deviceExitTimeout) clearTimeout(this.deviceExitTimeout);

    // Apply configuration for latest collected item
    this.uiCollectionIcon.src = config.icon;
    if (this.uiCollectionTag) {
      this.uiCollectionTag.textContent = config.tag;
      this.uiCollectionTag.style.color = config.color;
    }
    if (this.uiCollectionTitle) {
      this.uiCollectionTitle.textContent = config.title;
    }
    this.uiCollectionDevice.style.setProperty('--device-color', config.color);

    // Re-trigger the pop-on entrance animation
    this.uiCollectionDevice.classList.remove('active', 'exiting');
    void this.uiCollectionDevice.offsetWidth; // Force CSS reflow
    this.uiCollectionDevice.classList.add('active');

    // Reset and trigger the 5.0s timer ring countdown animation
    if (this.uiCollectionTimerBar) {
      this.uiCollectionTimerBar.style.animation = 'none';
      void this.uiCollectionTimerBar.offsetWidth;
      this.uiCollectionTimerBar.style.animation = 'deviceTimerDrain 5.0s linear forwards';
    }

    // Stays visible for 5.0 seconds, then plays cool transition out
    this.deviceTimeout = setTimeout(() => {
      this.uiCollectionDevice.classList.remove('active');
      this.uiCollectionDevice.classList.add('exiting');
      this.deviceExitTimeout = setTimeout(() => {
        this.uiCollectionDevice.classList.remove('exiting');
      }, 450);
    }, 5000);
  }

  updateMinimap(playerPos, playerRot, targetPos) {
    if (!this.uiMinimapVan || !this.uiMinimapPin) return;
    const container = this.uiMinimapVan.parentElement;
    if (!container) return;

    // Dynamically query container size so the locator is 100% adaptive across all viewports & resolutions
    const w = container.clientWidth || 120;
    const h = container.clientHeight || 120;
    const centerX = w / 2;
    const centerY = h / 2;

    // Level map boundary is 500m x 500m (half-size: 250m from center origin)
    // Scale so the full 250m ground plane boundary fits neatly inside the circular radar
    const mapRadius = Math.min(w, h) * 0.44;
    const levelHalfSize = 250;
    const mapScale = mapRadius / levelHalfSize;

    // In 3D space: +X = East (right), +Z = North (forward => -Y on screen)
    const rawVx = centerX + playerPos.x * mapScale;
    const rawVy = centerY - playerPos.z * mapScale;
    const vx = Math.max(6, Math.min(w - 6, rawVx));
    const vy = Math.max(6, Math.min(h - 6, rawVy));

    this.uiMinimapVan.style.left = `${vx}px`;
    this.uiMinimapVan.style.top = `${vy}px`;
    // Heading: 0 = North (facing +Z, up on map). Heading increases clockwise.
    const headingDeg = playerRot * (180 / Math.PI);
    this.uiMinimapVan.style.transform = `translate(-50%, -50%) rotate(${headingDeg}deg)`;

    // Delivery Target
    if (targetPos) {
      const rawTx = centerX + targetPos.x * mapScale;
      const rawTy = centerY - targetPos.z * mapScale;
      const tx = Math.max(6, Math.min(w - 6, rawTx));
      const ty = Math.max(6, Math.min(h - 6, rawTy));
      this.uiMinimapPin.style.left = `${tx}px`;
      this.uiMinimapPin.style.top = `${ty}px`;
      this.uiMinimapPin.style.display = 'block';
    } else {
      this.uiMinimapPin.style.display = 'none';
    }

    // Active Nitros on Map Locator
    if (this.nitroSystem && this.nitroSystem.pickupItems) {
      if (!this.minimapNitroBlips) {
        this.minimapNitroBlips = [];
      }
      const items = this.nitroSystem.pickupItems;
      while (this.minimapNitroBlips.length < items.length) {
        const blip = document.createElement('div');
        blip.className = 'minimap-nitro-blip';
        container.appendChild(blip);
        this.minimapNitroBlips.push(blip);
      }

      for (let i = 0; i < this.minimapNitroBlips.length; i++) {
        const blip = this.minimapNitroBlips[i];
        if (i < items.length && items[i] && items[i].active) {
          const item = items[i];
          const rawNx = centerX + item.basePos.x * mapScale;
          const rawNy = centerY - item.basePos.z * mapScale;
          const nx = Math.max(6, Math.min(w - 6, rawNx));
          const ny = Math.max(6, Math.min(h - 6, rawNy));
          blip.style.left = `${nx}px`;
          blip.style.top = `${ny}px`;
          blip.style.display = 'block';
        } else {
          blip.style.display = 'none';
        }
      }
    }
  }

  setupPermanentDaytime() {
    // Clear atmosphere with fog disabled as requested
    this.scene.fogMode = Scene.FOGMODE_NONE;

    if (this.sunLight) {
      this.sunLight.diffuse.set(1.0, 0.98, 0.92);
      this.sunLight.intensity = 3.4;
    }
    if (this.hemiLight) {
      this.hemiLight.intensity = 0.28;
    }
    if (this.vanModel && this.vanModel.setHeadlights) {
      this.vanModel.setHeadlights(false);
    }
    if (this.uiDayNightPill) {
      this.uiDayNightPill.style.display = 'none';
    }
  }

  renderFrame() {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.08);
    this.lastTime = now;

    this.updateMenuGamepad(dt);

    // Keep PhotoDome centered on camera with subtle horizon grounding so the skyline sits naturally on the ground plane
    if (this.skyDome) {
      this.skyDome.position.set(
        this.camera.position.x,
        this.camera.position.y - 8,
        this.camera.position.z
      );
      if (this.skyDome.mesh) {
        this.skyDome.mesh.position.set(0, 0, 0);
      }
    }

    if (this.inMainMenu) {
      if (this.audio) this.audio.silenceEngine();
      this.scene.render();
      return;
    }

    // 1. Process Input
    this.input.update();

    if (!this.audio.initialized || this.audio.ctx?.state === 'suspended') {
      if (this.input.throttle > 0 || this.input.brake > 0 || this.input.steer !== 0 || this.input.handbrake) {
        this.audio.resume();
      }
    }

    // 2. Update Grounded Arcade Physics
    this.vehiclePhysics.update(dt, this.input);

    // 3. Update Visual Van Model & Suspension
    this.vanModel.update(dt, this.vehiclePhysics, this.input);

    // 4. Update Dynamic Camera (Includes high-speed subtle wobble when kmh > 60)
    this.cameraManager.update(dt, this.vanModel.root, this.vehiclePhysics);

    // 5. Update Sun Position (Follows vehicle to cast deep, crisp shadows without clipping)
    const vanPos = this.vanModel.root.position;
    if (this.sunLight) {
      this.sunLight.position.set(
        vanPos.x - this.sunLight.direction.x * 50,
        vanPos.y - this.sunLight.direction.y * 50,
        vanPos.z - this.sunLight.direction.z * 50
      );
    }

    // 6. Update Delivery System
    this.deliverySystem.update(dt, vanPos);

    // 6b. Update Nitro Pickups and Speed Boost System
    if (this.nitroSystem) {
      this.nitroSystem.update(dt, vanPos, this.vehiclePhysics, this.audio);
    }

    // 7. Update Dynamic World Elements (Traffic Cone Physics & Collisions)
    if (this.world && this.world.update) {
      this.world.update(dt, this.vehiclePhysics, this.audio);
    }

    // 8. Audio Engine & Skid Sound (Strictly disabled when reversing)
    const kmh = Math.abs(this.vehiclePhysics.speed * 3.6);
    this.audio.updateEngine(this.vehiclePhysics.speed, this.input.throttle, this.vehiclePhysics.maxSpeed);
    const isReversing = (this.vehiclePhysics.speed < -0.05) || (this.input.brake > 0 && !this.input.throttle && this.vehiclePhysics.speed <= 0.25);
    const isDonut = !isReversing && Boolean(this.input.handbrake && this.input.throttle > 0);
    const isSkidding = !isReversing && (isDonut || ((this.input.handbrake || this.vehiclePhysics.isDrifting || this.vehiclePhysics.slipSpeed > 2.0) && this.vehiclePhysics.speed > 1.2));
    this.audio.updateSkid(isSkidding, Math.max(3.5, this.vehiclePhysics.slipSpeed));
    this.audio.updateBrake(!isReversing && (this.vehiclePhysics.isBrakingHard || (this.input.brake > 0.35 && this.vehiclePhysics.speed > 1.8)), this.vehiclePhysics.speed);

    // 9. Update HUD
    if (this.uiSpeed) this.uiSpeed.innerText = Math.round(kmh);
    if (this.uiScore) this.uiScore.innerText = this.deliverySystem.score;

    const currentTarget = this.deliverySystem.getCurrentSpot();
    if (this.isProvingGround) {
      if (this.uiOrder) this.uiOrder.innerText = 'Level: Physics Proving Ground';
      if (this.uiTargetDist) this.uiTargetDist.innerText = '1m × 1m Lab Grid';
      if (this.uiPrompt) this.uiPrompt.style.display = 'none';
      if (this.uiMobileDeliverBtn) this.uiMobileDeliverBtn.style.display = 'none';
      this.updateProvingGroundUI();
    } else if (this.isFreeRoam) {
      if (this.uiOrder) this.uiOrder.innerText = 'Mode: Free Roam';
      if (this.uiTargetDist) this.uiTargetDist.innerText = 'Full Circuit Open';
      if (this.uiPrompt) this.uiPrompt.style.display = 'none';
      if (this.uiMobileDeliverBtn) this.uiMobileDeliverBtn.style.display = 'none';
    } else if (currentTarget) {
      const dist = Math.round(Vector3.Distance(vanPos, currentTarget.position));
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
    } else {
      if (this.uiOrder) this.uiOrder.innerText = 'Track: Seamless 4K Photo Road';
      if (this.uiTargetDist) this.uiTargetDist.innerText = 'HDRI & Advanced Lighting Active';
      if (this.uiPrompt) this.uiPrompt.style.display = 'none';
      if (this.uiMobileDeliverBtn) this.uiMobileDeliverBtn.style.display = 'none';
    }

    // 10. Update Minimap
    this.updateMinimap(vanPos, this.vehiclePhysics.heading, (!this.isFreeRoam && currentTarget) ? currentTarget.position : null);

    // 11. Render Scene
    this.scene.render();
  }

  initProvingGroundUI() {
    this.pgPassedTests = {
      1: false, // Smooth Ramp & Belly Guard
      2: false, // 4-Wheel Twist (Mogul Bumps)
      3: false, // Shock Chatter (Washboards)
      4: false, // Tabletop Cliff Drop & Sparks
      5: false, // Canyon Gap Double Jump
      6: false  // Havok Crash Wall & Clean Reverse
    };

    const pgUI = document.getElementById('proving-ground-ui');
    const btnMin = document.getElementById('btn-pg-minimize');
    if (btnMin && pgUI) {
      btnMin.addEventListener('click', () => {
        const isMin = pgUI.classList.toggle('minimized');
        btnMin.innerText = isMin ? 'Expand' : 'Minimize';
      });
    }

    const btnResetCrates = document.getElementById('btn-pg-reset-crates');
    if (btnResetCrates) {
      btnResetCrates.addEventListener('click', () => {
        if (this.world && this.world.spawnHavokCrashCrates) {
          this.world.spawnHavokCrashCrates(32.0, 20.0);
          this.showToast('🔄 Havok Crash Crates restacked!');
        }
      });
    }

    const stations = {
      ramp: { x: 0, z: -26, heading: 0, msg: '📍 Station 1: Smooth Crest Ramp — Drive forward!' },
      moguls: { x: -16, z: -27, heading: 0, msg: '📍 Station 2: 4-Wheel Twist Moguls — Watch each wheel flex!' },
      washboards: { x: 16, z: -27, heading: 0, msg: '📍 Station 3: Washboard Chatter — Test shock absorbers!' },
      tabletop: { x: 0, z: 18, heading: 0, msg: '📍 Station 4: Tabletop Cliff Ledge — Drive up & drop off the 2m cliff!' },
      canyon: { x: -32, z: -12, heading: 0, msg: '📍 Station 5: Canyon Gap Jump — Hit full speed (W) to clear the gap!' },
      crates: { x: 32, z: -22, heading: 0, msg: '📍 Station 6: Bollard Slalom & Havok Crash Wall — Smash the stack!' }
    };

    document.querySelectorAll('.pg-tp-btn[data-tp]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-tp');
        const st = stations[key];
        if (st && this.vehiclePhysics) {
          this.lastProvingStation = st;
          this.vehiclePhysics.reset(st.x, st.z, st.heading);
          this.vanModel.update(0, this.vehiclePhysics, null);
          this.cameraManager.snap(this.vanModel.root, this.vehiclePhysics);
          this.showToast(st.msg);
        }
      });
    });
  }

  updateProvingGroundUI() {
    const t = this.vehiclePhysics && this.vehiclePhysics.telemetry;
    if (!t) return;

    // 1. Plain-English Live Summary Banner
    const summaryEl = document.getElementById('pg-live-summary');
    const airBadge = document.getElementById('pg-air-badge');
    const cratesKnocked = (this.world && this.world.cratesKnockedCount) || 0;

    if (summaryEl) {
      if (t.activeSparks > 0) {
        summaryEl.innerText = `⚡ Heavy Landing! Shocks absorbed the hit & ${t.activeSparks} wheel-level sparks burst!`;
      } else if (t.isAirborne) {
        summaryEl.innerText = `🚀 Airborne Jump! Flying ${t.airHeightM}m high (${t.airTimeSec}s hangtime) — shocks extended ready to land.`;
      } else if (t.isReversing) {
        summaryEl.innerText = `⏪ Reversing cleanly at ${t.speedKmh} km/h — tire skid marks & smoke automatically disabled.`;
      } else if (t.isOnRamp) {
        const dirText = t.noseTiltDeg > 3 ? `climbing uphill (${t.noseTiltDeg}°)` : (t.noseTiltDeg < -3 ? `going downhill (${t.noseTiltDeg}°)` : 'crossing smooth crest');
        summaryEl.innerText = `📐 On Ramp (${dirText}) — all tires planted & ${t.bellyClearanceCm} cm of safe room under belly!`;
      } else if (t.isOnCurb || Math.abs(t.sideTiltDeg) >= 3) {
        summaryEl.innerText = `⚖️ Uneven Bumps! Left & Right shocks flexing separately (${Math.abs(t.sideTiltDeg)}° side tilt) to keep van balanced.`;
      } else if (t.isDrifting) {
        summaryEl.innerText = `💨 Power-Sliding! Rear tires drifting smoothly across the 1m×1m grid.`;
      } else if (t.speedKmh > 2) {
        summaryEl.innerText = `🟢 Cruising smoothly at ${t.speedKmh} km/h — all 4 tires gripping the 1m×1m grid.`;
      } else {
        summaryEl.innerText = `🟢 Ready on 1m×1m Grid — Drive forward or click any "📍 Go" button below to test!`;
      }
    }

    if (airBadge) {
      if (t.isAirborne) {
        airBadge.innerText = `🚀 In Air (${t.airHeightM}m)`;
        airBadge.style.color = '#fbbf24';
      } else if (t.isOnRamp) {
        airBadge.innerText = '📐 On Ramp';
        airBadge.style.color = '#00e5ff';
      } else if (t.isOnCurb) {
        airBadge.innerText = '⚖️ On Bumps';
        airBadge.style.color = '#38bdf8';
      } else {
        airBadge.innerText = '🟢 All 4 Planted';
        airBadge.style.color = '#4ade80';
      }
    }

    // 2. Update 4 Individual Wheel Cards
    const updateWheelCard = (idPrefix, wData) => {
      if (!wData) return;
      const pill = document.getElementById(`pg-w-${idPrefix}-pill`);
      const bar = document.getElementById(`pg-w-${idPrefix}-bar`);
      const sub = document.getElementById(`pg-w-${idPrefix}-sub`);

      if (pill) {
        if (wData.contact === 'air') {
          pill.innerText = 'In Air';
          pill.style.color = '#fbbf24';
          pill.style.borderColor = 'rgba(251, 191, 36, 0.5)';
          pill.style.background = 'rgba(251, 191, 36, 0.18)';
        } else if (wData.contact === 'ramp') {
          pill.innerText = 'On Ramp';
          pill.style.color = '#00e5ff';
          pill.style.borderColor = 'rgba(0, 229, 255, 0.5)';
          pill.style.background = 'rgba(0, 229, 255, 0.18)';
        } else if (wData.contact === 'bump') {
          pill.innerText = 'Flexing';
          pill.style.color = '#fde047';
          pill.style.borderColor = 'rgba(253, 224, 71, 0.5)';
          pill.style.background = 'rgba(253, 224, 71, 0.18)';
        } else {
          pill.innerText = 'Planted';
          pill.style.color = '#4ade80';
          pill.style.borderColor = 'rgba(74, 222, 128, 0.45)';
          pill.style.background = 'rgba(34, 197, 94, 0.18)';
        }
      }
      if (bar) {
        const pct = Math.max(12, Math.min(100, 50 + wData.flexCm * 5));
        bar.style.width = `${pct}%`;
      }
      if (sub) {
        sub.innerText = `Ground: +${wData.heightCm} cm • Flex: ${wData.flexCm >= 0 ? '+' : ''}${wData.flexCm} cm`;
      }
    };

    updateWheelCard('fl', t.wheels.FL);
    updateWheelCard('fr', t.wheels.FR);
    updateWheelCard('rl', t.wheels.RL);
    updateWheelCard('rr', t.wheels.RR);

    // 3. Belly Clearance & Tilt Meters
    const bellyVal = document.getElementById('pg-belly-val');
    const bellyBar = document.getElementById('pg-belly-bar');
    if (bellyVal) {
      bellyVal.innerText = `${t.bellyClearanceCm} cm (Safe — Zero Clipping)`;
      bellyVal.style.color = t.bellyClearanceCm >= 12 ? '#4ade80' : '#fbbf24';
    }
    if (bellyBar) {
      const pct = Math.max(10, Math.min(100, Math.round((t.bellyClearanceCm / 48) * 100)));
      bellyBar.style.width = `${pct}%`;
    }

    const tiltVal = document.getElementById('pg-tilt-val');
    if (tiltVal) {
      const pitchLabel = t.noseTiltDeg > 2 ? `Nose Up +${t.noseTiltDeg}°` : (t.noseTiltDeg < -2 ? `Nose Down ${t.noseTiltDeg}°` : 'Level 0°');
      const rollLabel = t.sideTiltDeg > 2 ? `Lean Right +${t.sideTiltDeg}°` : (t.sideTiltDeg < -2 ? `Lean Left ${t.sideTiltDeg}°` : 'Flat 0°');
      tiltVal.innerText = `${pitchLabel} • ${rollLabel}`;
    }

    const shockVal = document.getElementById('pg-shock-val');
    if (shockVal) {
      const rideDesc = Math.abs(t.shockBounceCm) >= 4 ? `Absorbing Impact (${t.shockBounceCm} cm)` : (t.isOnCurb ? 'Filtering Bumps' : 'Smooth Ride');
      shockVal.innerText = `Shocks: ${rideDesc} • Active Sparks: ${t.activeSparks}`;
    }

    const crateCountEl = document.getElementById('pg-crate-count');
    if (crateCountEl) {
      crateCountEl.innerText = `${cratesKnocked}/15`;
    }

    // 4. Evaluate 6 Interactive Checklist Tests
    const vx = this.vehiclePhysics.position.x;
    const vz = this.vehiclePhysics.position.z;

    if (t.isOnRamp && t.bellyClearanceCm >= 10) {
      this.pgPassedTests[1] = true;
    }
    if (t.isOnCurb && Math.abs(t.sideTiltDeg) >= 3) {
      this.pgPassedTests[2] = true;
    }
    if (t.isOnCurb && vx > 8 && t.speedKmh >= 10) {
      this.pgPassedTests[3] = true;
    }
    if (t.activeSparks > 0) {
      this.pgPassedTests[4] = true;
    }
    if (t.isAirborne && vx < -22 && vz > 10) {
      this.pgPassedTests[5] = true;
    }
    if (cratesKnocked > 0 || (t.isReversing && t.speedKmh >= 8)) {
      this.pgPassedTests[6] = true;
    }

    let passedCount = 0;
    for (let i = 1; i <= 6; i++) {
      if (this.pgPassedTests[i]) {
        passedCount++;
        const card = document.getElementById(`pg-test-card-${i}`);
        const icon = document.getElementById(`pg-test-icon-${i}`);
        if (card && !card.classList.contains('passed')) card.classList.add('passed');
        if (icon && icon.innerText !== '✅') icon.innerText = '✅';
      }
    }

    const counterEl = document.getElementById('pg-pass-counter');
    if (counterEl) {
      counterEl.innerText = `${passedCount} / 6 Passed`;
      counterEl.style.color = passedCount === 6 ? '#4ade80' : '#fbbf24';
    }
  }
}

// Start Game Robust Bootstrap (handles both before and after DOMContentLoaded)
function startCheckersGame() {
  if (!window.gameApp) {
    try {
      window.gameApp = new GameApp();
    } catch (err) {
      console.error('Fatal GameApp initialization error:', err);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startCheckersGame);
} else {
  startCheckersGame();
}
