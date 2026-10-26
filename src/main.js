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

    // 1. Scene & WebGL Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x90caf9);
    this.scene.fog = new THREE.FogExp2(0x90caf9, 0.0035);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // AAA soft shadow filtering
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    // 2. Camera & Camera Manager (Starts in Third-Person Chase Cam)
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);
    this.cameraManager = new CameraManager(this.camera, this.renderer.domElement);

    // 3. World Environment with Solid Ramps & Slalom Area
    this.world = new CityWorld(this.scene);

    // 4. Arcade Vehicle Physics (Grounded, punchy, high maneuverability)
    this.vehiclePhysics = new ArcadeVehicle(this.scene, { x: 0, y: 0.38, z: -40, heading: 0 });
    this.vehiclePhysics.setColliders(this.world.colliders);

    // 5. Van Model
    this.vanModel = new VanModel(this.scene);

    // 6. SINGLE QUALITY AAA SHADOW SETUP
    this.setupAAAShadow();

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

    // Clock
    this.clock = new THREE.Clock();

    // Resize listener
    window.addEventListener('resize', () => this.onWindowResize());

    // Audio init on user interaction
    window.addEventListener('pointerdown', () => this.audio.init(), { once: true });
    window.addEventListener('keydown', () => this.audio.init(), { once: true });

    // Start loop
    this.animate();
  }

  setupAAAShadow() {
    // Ambient fill
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x445566, 0.85);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const ambient = new THREE.AmbientLight(0xdcf8ff, 0.35);
    this.scene.add(ambient);

    // SINGLE QUALITY AAA DIRECTIONAL SHADOW LIGHT
    this.sunLight = new THREE.DirectionalLight(0xfff8e7, 1.6);
    this.sunLight.castShadow = true;

    // Ultra-sharp 2048 shadow texture
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;

    // Tight 14x14m frustum locked to vehicle for razor-sharp shadow resolution (>140 px/m)
    const d = 7.0;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 5.0;
    this.sunLight.shadow.camera.far = 65.0;

    // Critical bias settings to eliminate both peter-panning and shadow acne
    this.sunLight.shadow.bias = -0.0001;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.shadow.radius = 1.6;

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

    this.input.onResetVehicle = () => {
      this.vehiclePhysics.reset(0, -40, 0);
      this.showToast('Van reset on center road!');
    };
  }

  cacheUIElements() {
    this.uiSpeed = document.getElementById('speed-value');
    this.uiScore = document.getElementById('score-value');
    this.uiOrder = document.getElementById('order-title');
    this.uiTargetDist = document.getElementById('order-dist');
    this.uiPrompt = document.getElementById('action-prompt');
    this.uiCamBtn = document.getElementById('btn-cam');
    this.uiMinimapPin = document.getElementById('minimap-target');
    this.uiMinimapVan = document.getElementById('minimap-player');

    if (this.uiCamBtn) {
      this.uiCamBtn.innerText = '📷 3RD CAM';
    }
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
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const dt = Math.min(this.clock.getDelta(), 0.08);

    // 1. Process Input
    this.input.update();

    // 2. Update Grounded Arcade Physics
    this.vehiclePhysics.update(dt, this.input);

    // 3. Update Visual Van Model & Suspension
    this.vanModel.update(dt, this.vehiclePhysics);

    // 4. Update Dynamic Camera
    this.cameraManager.update(dt, this.vanModel.root, this.vehiclePhysics);

    // 5. UPDATE SINGLE QUALITY AAA SHADOW (Locks to vehicle position)
    const vanPos = this.vanModel.root.position;
    if (this.sunLight) {
      this.sunLight.position.set(vanPos.x + 16, vanPos.y + 32, vanPos.z + 14);
      this.sunLight.target.position.set(vanPos.x, vanPos.y, vanPos.z);
      this.sunLight.target.updateMatrixWorld();
    }

    // 6. Update Delivery System
    this.deliverySystem.update(dt, vanPos);

    // 7. Audio Engine, Drift Screech & Brake Sound
    const kmh = Math.abs(this.vehiclePhysics.speed * 3.6);
    this.audio.updateEngine(this.vehiclePhysics.speed, this.input.throttle, this.vehiclePhysics.maxSpeed);
    this.audio.updateSkid(this.vehiclePhysics.isDrifting || this.vehiclePhysics.slipSpeed > 3.0, this.vehiclePhysics.slipSpeed);
    this.audio.updateBrake(this.vehiclePhysics.isBrakingHard, this.vehiclePhysics.speed);

    // 8. Update HUD
    if (this.uiSpeed) this.uiSpeed.innerText = Math.round(kmh);
    if (this.uiScore) this.uiScore.innerText = this.deliverySystem.score;

    const currentTarget = this.deliverySystem.getCurrentSpot();
    if (currentTarget) {
      const dist = Math.round(vanPos.distanceTo(currentTarget.position));
      if (this.uiOrder) this.uiOrder.innerText = `Order: ${currentTarget.name}`;
      if (this.uiTargetDist) this.uiTargetDist.innerText = `${dist}m away`;

      if (this.uiPrompt) {
        if (dist < 12.0) {
          this.uiPrompt.innerHTML = `<span class="key-pill">ENTER / E</span> Deliver Paper Bags!`;
          this.uiPrompt.style.display = 'block';
        } else {
          this.uiPrompt.style.display = 'none';
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
