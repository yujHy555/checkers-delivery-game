import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TextureGenerator } from '../utils/TextureGenerator.js';

export class VanModel {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.root = new THREE.Group();
    this.root.name = 'CheckersHyperVan';

    // Animation state
    this.sideDoorOpen = false;
    this.sideDoorSlide = 0;
    this.sideDoorOut = 0;

    this.rearDoorsOpen = false;
    this.rearDoorAngle = 0;

    this.cargoBags = [];
    this.customBody = null;
    this.fallbackBody = null;

    this.buildModel();
    this.scene.add(this.root);
  }

  buildModel() {
    // 1. Vehicle Container (handles terrain slope pitch and roll for BOTH wheels and chassis)
    this.vehicleGroup = new THREE.Group();
    this.root.add(this.vehicleGroup);

    // 2. Chassis Group (Base at axle height y = 0.355, responds to suspension & dynamic lean)
    this.chassisGroup = new THREE.Group();
    this.chassisGroup.position.y = 0.355;
    this.vehicleGroup.add(this.chassisGroup);

    // 3. Four Awesome Wheels (With Multi-Spoke Silver Alloy Rims & Radial Tires)
    // Matched to the wheel wells of the custom 3D Kei Van body (wheelbase 2.84m, track 1.56m)
    this.wheels = [];
    const wheelPositions = [
      { id: 'FL', x: -0.78, z: 1.42, isFront: true },
      { id: 'FR', x: 0.78, z: 1.42, isFront: true },
      { id: 'RL', x: -0.78, z: -1.42, isFront: false },
      { id: 'RR', x: 0.78, z: -1.42, isFront: false }
    ];

    const tireTex = TextureGenerator.createTireTexture();
    const rimTex = TextureGenerator.createWheelRimTexture();

    const tireGeo = new THREE.CylinderGeometry(0.355, 0.355, 0.28, 24);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ map: tireTex, roughness: 0.85 });

    const rimGeo = new THREE.CylinderGeometry(0.245, 0.245, 0.284, 24);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({ map: rimTex, roughness: 0.3, metalness: 0.75 });

    for (const wp of wheelPositions) {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(wp.x, 0.355, wp.z);

      const spinGroup = new THREE.Group();
      const tireMesh = new THREE.Mesh(tireGeo, tireMat);
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      tireMesh.castShadow = true;
      rimMesh.castShadow = true;

      spinGroup.add(tireMesh, rimMesh);
      steerPivot.add(spinGroup);

      this.vehicleGroup.add(steerPivot);
      this.wheels.push({
        id: wp.id,
        isFront: wp.isFront,
        steerPivot,
        spinGroup
      });
    }

    // 4. Front Headlights (High-intensity Night Beams + Forward Ground Flood)
    this.headlightL = new THREE.SpotLight(0xfff8ee, 0, 75, Math.PI / 4.2, 0.50, 1.1);
    this.headlightL.position.set(-0.65, 0.60, 2.25);
    this.headlightL.target.position.set(-0.65, 0.05, 24);
    this.chassisGroup.add(this.headlightL, this.headlightL.target);

    this.headlightR = new THREE.SpotLight(0xfff8ee, 0, 75, Math.PI / 4.2, 0.50, 1.1);
    this.headlightR.position.set(0.65, 0.60, 2.25);
    this.headlightR.target.position.set(0.65, 0.05, 24);
    this.chassisGroup.add(this.headlightR, this.headlightR.target);

    // Forward ground illuminator (brightens tarmac, curbs and scenery directly ahead of the van)
    this.headlightFlood = new THREE.PointLight(0xfffaed, 0, 32, 1.6);
    this.headlightFlood.position.set(0, 0.70, 3.2);
    this.chassisGroup.add(this.headlightFlood);

    // 5. Dual Rear Dynamic Brake Lights (PURE EMISSION, ZERO WHITE PLANE, ZERO BLACK HOUSING)
    // When brakes are OFF: completely invisible (NO dark/black box geometry over the taillights)
    // When brakes are ON: soft organic ruby-red glow positioned directly over the red lenses
    this.brakeLightsGroup = new THREE.Group();
    this.chassisGroup.add(this.brakeLightsGroup);

    this.brakeLightL = new THREE.PointLight(0xff0022, 0, 7.0, 2.0);
    this.brakeLightL.position.set(-0.765, 0.465, -2.28);
    this.brakeLightsGroup.add(this.brakeLightL);

    this.brakeLightR = new THREE.PointLight(0xff0022, 0, 7.0, 2.0);
    this.brakeLightR.position.set(0.765, 0.465, -2.28);
    this.brakeLightsGroup.add(this.brakeLightR);

    // Procedural soft glowing ruby-red lens texture (prevents white plane saturation / hard edges)
    const brakeCanvas = document.createElement('canvas');
    brakeCanvas.width = 128;
    brakeCanvas.height = 256;
    const bCtx = brakeCanvas.getContext('2d');
    bCtx.clearRect(0, 0, 128, 256);
    const grad = bCtx.createRadialGradient(64, 128, 8, 64, 128, 75);
    grad.addColorStop(0, 'rgba(255, 30, 45, 0.95)');
    grad.addColorStop(0.35, 'rgba(235, 10, 30, 0.75)');
    grad.addColorStop(0.70, 'rgba(200, 0, 20, 0.35)');
    grad.addColorStop(1, 'rgba(160, 0, 10, 0.0)');
    bCtx.fillStyle = grad;
    bCtx.fillRect(0, 0, 128, 256);
    this.brakeGlowTex = new THREE.CanvasTexture(brakeCanvas);

    // NormalBlending ensures rich ruby-red saturation without any white clipping plane
    this.brakeCoreMat = new THREE.MeshBasicMaterial({
      map: this.brakeGlowTex,
      color: 0xff1525,
      transparent: true,
      opacity: 0.90,
      blending: THREE.NormalBlending,
      depthWrite: false,
      toneMapped: false
    });

    const lensGeo = new THREE.PlaneGeometry(0.14, 0.34);
    lensGeo.rotateY(Math.PI); // Facing rearward (-Z)

    this.tailLensL = new THREE.Mesh(lensGeo, this.brakeCoreMat);
    this.tailLensL.position.set(-0.765, 0.465, -2.215);
    this.brakeLightsGroup.add(this.tailLensL);

    this.tailLensR = new THREE.Mesh(lensGeo, this.brakeCoreMat);
    this.tailLensR.position.set(0.765, 0.465, -2.215);
    this.brakeLightsGroup.add(this.tailLensR);

    // Initial state: INVISIBLE so the vehicle's printed rear lights are 100% visible and unblemished
    this.tailLensL.visible = false;
    this.tailLensR.visible = false;

    // 5b. Rear Running Position Lights (Warm White / Slight Yellow, stay on with headlights at night)
    this.rearRunningGroup = new THREE.Group();
    this.chassisGroup.add(this.rearRunningGroup);

    this.rearRunningLightL = new THREE.PointLight(0xfffae0, 0, 6.0, 2.0);
    this.rearRunningLightL.position.set(-0.765, 0.465, -2.28);
    this.rearRunningGroup.add(this.rearRunningLightL);

    this.rearRunningLightR = new THREE.PointLight(0xfffae0, 0, 6.0, 2.0);
    this.rearRunningLightR.position.set(0.765, 0.465, -2.28);
    this.rearRunningGroup.add(this.rearRunningLightR);

    const runningCanvas = document.createElement('canvas');
    runningCanvas.width = 128;
    runningCanvas.height = 256;
    const rCtx = runningCanvas.getContext('2d');
    rCtx.clearRect(0, 0, 128, 256);
    const rGrad = rCtx.createRadialGradient(64, 128, 6, 64, 128, 65);
    rGrad.addColorStop(0, 'rgba(255, 252, 220, 0.88)');
    rGrad.addColorStop(0.35, 'rgba(255, 240, 180, 0.60)');
    rGrad.addColorStop(0.70, 'rgba(255, 220, 140, 0.22)');
    rGrad.addColorStop(1, 'rgba(255, 200, 100, 0.0)');
    rCtx.fillStyle = rGrad;
    rCtx.fillRect(0, 0, 128, 256);
    this.rearRunningGlowTex = new THREE.CanvasTexture(runningCanvas);

    this.rearRunningMat = new THREE.MeshBasicMaterial({
      map: this.rearRunningGlowTex,
      color: 0xfffae0,
      transparent: true,
      opacity: 0.80,
      blending: THREE.NormalBlending,
      depthWrite: false,
      toneMapped: false
    });

    const runningLensGeo = new THREE.PlaneGeometry(0.12, 0.28);
    runningLensGeo.rotateY(Math.PI);

    this.rearRunningLensL = new THREE.Mesh(runningLensGeo, this.rearRunningMat);
    this.rearRunningLensL.position.set(-0.765, 0.465, -2.214);
    this.rearRunningGroup.add(this.rearRunningLensL);

    this.rearRunningLensR = new THREE.Mesh(runningLensGeo, this.rearRunningMat);
    this.rearRunningLensR.position.set(0.765, 0.465, -2.214);
    this.rearRunningGroup.add(this.rearRunningLensR);

    this.rearRunningLensL.visible = false;
    this.rearRunningLensR.visible = false;

    // 6. Temporary lightweight fallback body (ensures instant startup with zero blank frames while 60MB GLB loads)
    this.createFallbackBody();

    // 7. Load user's updated 3D van body from public/models/checkers_van_body_01.glb
    this.loadCustomModel();
  }

  createFallbackBody() {
    this.fallbackBody = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x00b4d8,
      roughness: 0.4,
      metalness: 0.08
    });
    const greenMat = new THREE.MeshStandardMaterial({
      color: 0x4cb824,
      roughness: 0.4,
      metalness: 0.08
    });

    const lowerBox = new THREE.Mesh(new THREE.BoxGeometry(1.80, 0.70, 4.40), bodyMat);
    lowerBox.position.set(0, 0.40, 0.04);
    lowerBox.castShadow = true;
    this.fallbackBody.add(lowerBox);

    const upperBox = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.90, 4.30), greenMat);
    upperBox.position.set(0, 1.15, -0.05);
    upperBox.castShadow = true;
    this.fallbackBody.add(upperBox);

    this.chassisGroup.add(this.fallbackBody);
  }

  loadCustomModel() {
    const loader = new GLTFLoader();
    loader.load(
      '/models/checkers_van_body_01.glb',
      (gltf) => {
        const model = gltf.scene;

        model.traverse((child) => {
          if (child === model) return;
          const name = (child.name || '').toLowerCase();
          const parentName = (child.parent?.name || '').toLowerCase();

          // Strict whitelist: ONLY permit the dedicated high-resolution 2K Kei Van shell (Cube_1, Cube_2, Cube_3)
          // Completely eliminates all overlapping meshes (Cube001, Cube002, node_0, meshes0, meshes0_1, Plane, wheels, characters)
          const isAllowedBody = name === 'cube' ||
                                parentName === 'cube' ||
                                (name.startsWith('cube_') && !name.includes('001') && !name.includes('002'));

          child.visible = isAllowedBody;

          if (child.isMesh) {
            if (isAllowedBody) {
              child.castShadow = true;
              child.receiveShadow = true;
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              for (const mat of mats) {
                if (!mat) continue;
                if (mat.map) {
                  // Maximum hardware anisotropic filtering & sRGB linear mipmapping for razor-sharp textures
                  mat.map.anisotropy = 16;
                  mat.map.colorSpace = THREE.SRGBColorSpace;
                  mat.map.generateMipmaps = true;
                  mat.map.minFilter = THREE.LinearMipmapLinearFilter;
                  mat.map.magFilter = THREE.LinearFilter;
                  mat.map.needsUpdate = true;
                }
                mat.roughness = 0.28;
                mat.metalness = 0.04;
                mat.needsUpdate = true;
              }
            } else {
              child.castShadow = false;
              child.receiveShadow = false;
            }
          }
        });

        // Align body mesh origin with chassis group (axle height y = 0.355m)
        model.position.set(0, -0.355, 0);
        this.chassisGroup.add(model);
        this.customBody = model;

        // Cleanly remove fallback body now that the custom 3D model is active
        if (this.fallbackBody) {
          this.chassisGroup.remove(this.fallbackBody);
          this.fallbackBody = null;
        }

        console.log('✅ Custom 3D Kei Van Body with crisp 2K textures successfully loaded!');
        if (this.options && this.options.onLoaded) {
          this.options.onLoaded(model);
        }
      },
      (xhr) => {
        if (this.options && this.options.onProgress) {
          this.options.onProgress(xhr);
        }
      },
      (err) => {
        console.warn('ℹ️ Could not load /models/checkers_van_body_01.glb, using fallback body:', err);
        if (this.options && this.options.onError) {
          this.options.onError(err);
        }
      }
    );
  }

  toggleSideDoor() {
    this.sideDoorOpen = !this.sideDoorOpen;
    return this.sideDoorOpen;
  }

  toggleRearDoors() {
    this.rearDoorsOpen = !this.rearDoorsOpen;
    return this.rearDoorsOpen;
  }

  setHeadlights(on) {
    this.headlightsOn = on;
    const spotIntensity = on ? 8.5 : 0.0;
    const floodIntensity = on ? 4.5 : 0.0;
    if (this.headlightL) this.headlightL.intensity = spotIntensity;
    if (this.headlightR) this.headlightR.intensity = spotIntensity;
    if (this.headlightFlood) this.headlightFlood.intensity = floodIntensity;

    // Rear running lights (warm white / slight yellow emission, modest reach)
    const rearRunningIntensity = on ? 1.6 : 0.0;
    if (this.rearRunningLightL) this.rearRunningLightL.intensity = rearRunningIntensity;
    if (this.rearRunningLightR) this.rearRunningLightR.intensity = rearRunningIntensity;
    if (this.rearRunningLensL) this.rearRunningLensL.visible = on;
    if (this.rearRunningLensR) this.rearRunningLensR.visible = on;
  }

  update(dt, vehiclePhysics, input = null) {
    // 1. Root position sits directly at the ground contact elevation
    this.root.position.copy(vehiclePhysics.position);
    this.root.rotation.y = vehiclePhysics.heading;

    // 2. Terrain Slope Alignment (applies to BOTH wheels and chassis!)
    this.vehicleGroup.rotation.x = vehiclePhysics.surfacePitch || 0;
    this.vehicleGroup.rotation.z = vehiclePhysics.surfaceRoll || 0;

    // 3. Dynamic Chassis Suspension Lean & Landing Compression
    this.chassisGroup.position.y = 0.355 - (vehiclePhysics.suspensionCompress || 0);
    this.chassisGroup.rotation.x = vehiclePhysics.dynamicPitch || 0;
    this.chassisGroup.rotation.z = vehiclePhysics.dynamicRoll || 0;

    // 4. Wheel Spin & Steering
    const rollDelta = (vehiclePhysics.speed / 0.355) * dt;

    for (const w of this.wheels) {
      w.spinGroup.rotation.x += rollDelta;
      if (w.isFront) {
        w.steerPivot.rotation.y = vehiclePhysics.steerAngle;
      }
    }

    // 5. Cockpit Steering Wheel
    if (this.steeringWheelPivot) {
      this.steeringWheelPivot.rotation.z = -vehiclePhysics.steerAngle * 2.5;
    }

    // 6. Dynamic Brake Lights
    const isBraking = Boolean(input && input.brake > 0.05);
    const isHandbraking = Boolean((input && input.handbrake) || vehiclePhysics.isDrifting);
    const isReversing = vehiclePhysics.speed < -0.15 || Boolean(input && input.brake > 0.05 && vehiclePhysics.speed <= 0.3);
    const isDecelBraking = Boolean(vehiclePhysics.isBrakingHard);

    const brakeActive = isBraking || isHandbraking || isReversing || isDecelBraking;

    // 6. Dynamic Brake Lights (Zero black housing, pure neon emission when active)
    if (this.tailLensL && this.tailLensR) {
      if (brakeActive) {
        this.tailLensL.visible = true;
        this.tailLensR.visible = true;
        if (this.brakeLightL) this.brakeLightL.intensity = 3.5;
        if (this.brakeLightR) this.brakeLightR.intensity = 3.5;
      } else {
        this.tailLensL.visible = false;
        this.tailLensR.visible = false;
        if (this.brakeLightL) this.brakeLightL.intensity = 0;
        if (this.brakeLightR) this.brakeLightR.intensity = 0;
      }
    }

    // 7. Animate Doors (if present)
    if (this.sideSlideDoor) {
      const targetSlide = this.sideDoorOpen ? 1.05 : 0;
      const targetOut = this.sideDoorOpen ? 0.08 : 0;
      this.sideDoorSlide = THREE.MathUtils.lerp(this.sideDoorSlide, targetSlide, 6.0 * dt);
      this.sideDoorOut = THREE.MathUtils.lerp(this.sideDoorOut, targetOut, 8.0 * dt);
      this.sideSlideDoor.position.x = 0.725 + this.sideDoorOut;
      this.sideSlideDoor.position.z = 0.15 - this.sideDoorSlide;
    }

    if (this.rearDoorLeftPivot && this.rearDoorRightPivot) {
      const targetRearAngle = this.rearDoorsOpen ? 2.1 : 0;
      this.rearDoorAngle = THREE.MathUtils.lerp(this.rearDoorAngle, targetRearAngle, 6.0 * dt);
      this.rearDoorLeftPivot.rotation.y = -this.rearDoorAngle;
      this.rearDoorRightPivot.rotation.y = this.rearDoorAngle;
    }
  }
}
