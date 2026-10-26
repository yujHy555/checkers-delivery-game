import * as THREE from 'three';
import { ArcadeVehicle } from './physics/ArcadeVehicle.js';
import { VanModel } from './entities/VanModel.js';
import { CharacterDriver } from './entities/CharacterDriver.js';
import { CityWorld } from './world/CityWorld.js';
import { DeliverySystem } from './systems/DeliverySystem.js';
import { CameraManager } from './systems/CameraManager.js';
import { AudioSynth } from './systems/AudioSynth.js';
import { InputManager } from './systems/InputManager.js';
import { CustomModelLoader } from './utils/CustomModelLoader.js';

class GameApp {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // 1. Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // bright blue sky
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.005);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
    this.cameraManager = new CameraManager(this.camera, this.renderer.domElement);

    // 3. Lighting
    this.setupLighting();

    // 4. World & Environment
    this.world = new CityWorld(this.scene);

    // 5. Arcade Vehicle Physics
    this.vehiclePhysics = new ArcadeVehicle(this.scene, { x: 0, y: 1.2, z: -35, heading: 0 });
    this.vehiclePhysics.setColliders(this.world.colliders);

    // 6. Van Model
    this.vanModel = new VanModel(this.scene);

    // 7. Character Driver (Mixamo Rigged)
    this.character = new CharacterDriver(this.scene);

    // 8. Delivery System
    this.deliverySystem = new DeliverySystem(this.scene, this.world.deliverySpots);

    // 9. Audio Synth
    this.audio = new AudioSynth();

    // 10. Input Manager
    this.input = new InputManager();

    // 11. Custom GLTF/GLB Drag-Drop Loader
    this.customLoader = new CustomModelLoader(this.scene, this.character, this.vanModel);

    // Connect Input Callbacks
    this.setupInputCallbacks();

    // UI elements
    this.cacheUIElements();

    // Clock
    this.clock = new THREE.Clock();

    // Resize listener
    window.addEventListener('resize', () => this.onWindowResize());

    // First user click starts AudioContext
    window.addEventListener('pointerdown', () => this.audio.init(), { once: true });
    window.addEventListener('keydown', () => this.audio.init(), { once: true });

    // Start loop
    this.animate();
  }

  setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x3d4849, 0.85);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff8e7, 1.4);
    dirLight.position.set(60, 90, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 250;
    dirLight.shadow.camera.left = -70;
    dirLight.shadow.camera.right = 70;
    dirLight.shadow.camera.top = 70;
    dirLight.shadow.camera.bottom = -70;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // Ambient fill
    const ambient = new THREE.AmbientLight(0xdcf8ff, 0.45);
    this.scene.add(ambient);
  }

  setupInputCallbacks() {
    // Enter / Exit Van
    this.input.onEnterExit = () => {
      this.audio.playDoorSlide();
      if (this.character.state === 'DRIVING') {
        this.character.exitVan(this.vanModel);
        this.showToast('Exited Van. Deliver the groceries on foot!');
      } else if (this.character.state === 'ON_FOOT') {
        const dist = this.character.root.position.distanceTo(this.vanModel.root.position);
        if (dist < 4.5) {
          this.character.enterVan(this.vanModel);
          this.showToast('Entered Van. Drive in a Flash!');
        } else {
          this.showToast('Too far from van to enter!');
        }
      }
    };

    // Toggle Side Slide Door
    this.input.onToggleSideDoor = () => {
      this.audio.playDoorSlide();
      const isOpen = this.vanModel.toggleSideDoor();
      this.showToast(isOpen ? 'Side Sliding Door: OPEN' : 'Side Sliding Door: CLOSED');
    };

    // Toggle Rear Swing Doors
    this.input.onToggleRearDoors = () => {
      this.audio.playDoorSlide();
      const isOpen = this.vanModel.toggleRearDoors();
      this.showToast(isOpen ? 'Rear Barn Doors: OPEN' : 'Rear Barn Doors: CLOSED');
    };

    // Action: Pick up / Deliver Bag
    this.input.onActionDeliver = () => {
      if (this.character.state === 'ON_FOOT') {
        const vanPos = this.vanModel.root.position;
        const charPos = this.character.root.position;
        const distToVan = charPos.distanceTo(vanPos);

        const currentTarget = this.deliverySystem.getCurrentSpot();
        const distToTarget = currentTarget ? charPos.distanceTo(currentTarget.position) : 999;

        if (this.character.carryingBag) {
          // Check if at doorstep destination
          if (distToTarget < 5.0) {
            this.audio.playDeliveryChime();
            const result = this.deliverySystem.completeDelivery(this.vanModel.cargoBags[0]);
            this.character.setCarryingBag(false);
            this.showDeliveryCelebration(result);
          } else {
            this.showToast('Walk to the glowing porch marker to deliver!');
          }
        } else {
          // Grab bag from van
          if (distToVan < 4.0) {
            this.character.setCarryingBag(true);
            this.showToast('Picked up Sixty60 Paper Bag! Carry it to the doorstep.');
          } else {
            this.showToast('Approach the van cargo doors to grab a bag!');
          }
        }
      } else {
        // In van: quick drive-by delivery if parked right at target
        const currentTarget = this.deliverySystem.getCurrentSpot();
        const dist = currentTarget ? this.vanModel.root.position.distanceTo(currentTarget.position) : 999;
        if (dist < 10.0) {
          this.audio.playDeliveryChime();
          const result = this.deliverySystem.completeDelivery(this.vanModel.cargoBags[0]);
          this.showDeliveryCelebration(result);
        } else {
          this.showToast('Pull up to the driveway, then press E to step out and deliver!');
        }
      }
    };

    // Toggle Camera
    this.input.onToggleCamera = () => {
      const mode = this.cameraManager.toggleMode();
      this.showToast(`Camera: ${mode === 'ISOMETRIC' ? '3D Isometric' : 'Third-Person Chase'}`);
      if (this.uiCamBtn) {
        this.uiCamBtn.innerText = mode === 'ISOMETRIC' ? '📷 ISO' : '📷 3RD';
      }
    };

    // Reset Vehicle
    this.input.onResetVehicle = () => {
      this.vehiclePhysics.reset(0, -35, 0);
      this.showToast('Van reset to main road!');
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
  }

  showToast(text) {
    const toast = document.getElementById('toast-msg');
    if (toast) {
      toast.innerText = text;
      toast.classList.add('visible');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
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
          +500 POINTS &bull; Deliveries: ${result.deliveredCount}
        </div>
      `;
      banner.classList.add('active');
      setTimeout(() => banner.classList.remove('active'), 3200);
    }
  }

  updateMinimap(playerPos, playerRot, targetPos) {
    if (!this.uiMinimapVan || !this.uiMinimapPin) return;

    // Map size: 300x300 world coords to 120x120 minimap px
    const mapScale = 120 / 240;
    const centerX = 60;
    const centerY = 60;

    // Van indicator
    const vx = centerX + playerPos.x * mapScale;
    const vy = centerY + playerPos.z * mapScale;
    this.uiMinimapVan.style.left = `${vx}px`;
    this.uiMinimapVan.style.top = `${vy}px`;
    this.uiMinimapVan.style.transform = `translate(-50%, -50%) rotate(${playerRot}rad)`;

    // Target indicator
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
    const isOnFoot = this.character.state === 'ON_FOOT';

    // 1. Process Input
    this.input.update(isOnFoot);

    // 2. Physics & Van Update
    if (!isOnFoot) {
      this.vehiclePhysics.update(dt, this.input);
    } else {
      // While on foot, van holds handbrake / deceleration
      this.vehiclePhysics.update(dt, { steer: 0, throttle: 0, brake: 1.0, handbrake: true });
    }
    this.vanModel.update(dt, this.vehiclePhysics);

    // 3. Character Update
    this.character.update(dt, this.input, this.vanModel);

    // 4. Custom Drag-Drop Loader update
    this.customLoader.update(dt);

    // 5. Active Focus Object for Camera
    const focusObj = isOnFoot ? this.character.root : this.vanModel.root;
    this.cameraManager.update(dt, focusObj, this.vehiclePhysics, isOnFoot);

    // 6. Delivery System Update
    const activePos = focusObj.position;
    this.deliverySystem.update(dt, activePos);

    // 7. Audio Synth update
    const kmh = Math.abs(this.vehiclePhysics.speed * 3.6);
    this.audio.updateEngine(this.vehiclePhysics.speed, this.input.throttle, this.vehiclePhysics.maxSpeed);
    this.audio.updateSkid(this.vehiclePhysics.isDrifting || this.vehiclePhysics.slipVelocity > 3.5, this.vehiclePhysics.slipVelocity);

    // 8. Update HUD & Prompts
    if (this.uiSpeed) this.uiSpeed.innerText = Math.round(kmh);
    if (this.uiScore) this.uiScore.innerText = this.deliverySystem.score;

    const currentTarget = this.deliverySystem.getCurrentSpot();
    if (currentTarget) {
      const dist = Math.round(activePos.distanceTo(currentTarget.position));
      if (this.uiOrder) this.uiOrder.innerText = `Order: ${currentTarget.name}`;
      if (this.uiTargetDist) this.uiTargetDist.innerText = `${dist}m away`;
    }

    // Dynamic Context Action Prompt
    if (this.uiPrompt) {
      if (isOnFoot) {
        const distToVan = activePos.distanceTo(this.vanModel.root.position);
        const distToTarget = currentTarget ? activePos.distanceTo(currentTarget.position) : 999;

        if (this.character.carryingBag && distToTarget < 5.0) {
          this.uiPrompt.innerHTML = `<span class="key-pill">ENTER</span> Place Delivery Bag at Doorstep!`;
          this.uiPrompt.style.display = 'block';
        } else if (!this.character.carryingBag && distToVan < 4.0) {
          this.uiPrompt.innerHTML = `<span class="key-pill">Q / ENTER</span> Grab Delivery Bag from Van &bull; <span class="key-pill">E</span> Drive`;
          this.uiPrompt.style.display = 'block';
        } else if (distToVan < 4.5) {
          this.uiPrompt.innerHTML = `<span class="key-pill">E</span> Enter Van &bull; <span class="key-pill">G</span> Rear Doors &bull; <span class="key-pill">H</span> Side Door`;
          this.uiPrompt.style.display = 'block';
        } else {
          this.uiPrompt.style.display = 'none';
        }
      } else {
        const distToTarget = currentTarget ? activePos.distanceTo(currentTarget.position) : 999;
        if (distToTarget < 12.0) {
          this.uiPrompt.innerHTML = `<span class="key-pill">E</span> Exit Van to Deliver on Foot &bull; <span class="key-pill">ENTER</span> Quick Delivery`;
          this.uiPrompt.style.display = 'block';
        } else {
          this.uiPrompt.style.display = 'none';
        }
      }
    }

    // Update Minimap
    const playerHeading = isOnFoot ? this.character.heading : this.vehiclePhysics.heading;
    this.updateMinimap(activePos, playerHeading, currentTarget ? currentTarget.position : null);

    // 9. Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Start Game on DOM Load
window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new GameApp();
});
