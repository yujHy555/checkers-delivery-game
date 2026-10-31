import {
  TransformNode,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
  Color3,
  Vector3,
  SpotLight,
  PointLight,
  Texture,
  DynamicTexture,
  FresnelParameters,
  Engine,
  SceneLoader
} from '@babylonjs/core';
import '@babylonjs/loaders';
import { TextureGenerator } from '../utils/TextureGenerator.js';

export class VanModel {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;

    this.root = new TransformNode('CheckersHyperVan', this.scene);

    // Animation state
    this.sideDoorOpen = false;
    this.rearDoorsOpen = false;

    this.cargoBags = [];
    this.customBody = null;
    this.fallbackBody = null;
    this.headlightsOn = false;

    this.buildModel();
  }

  buildModel() {
    // 1. Vehicle Container (handles terrain slope pitch & roll for both wheels & chassis)
    this.vehicleGroup = new TransformNode('VehicleGroup', this.scene);
    this.vehicleGroup.parent = this.root;

    // 2. Chassis Group (Base at axle height y = 0.355, responds to suspension & dynamic lean)
    this.chassisGroup = new TransformNode('ChassisGroup', this.scene);
    this.chassisGroup.position.y = 0.355;
    this.chassisGroup.parent = this.vehicleGroup;

    // 3. Four Wheels with Alloy Rims & Radial Tires
    this.wheels = [];
    const wheelPositions = [
      { id: 'FL', x: -0.78, z: 1.42, isFront: true },
      { id: 'FR', x: 0.78, z: 1.42, isFront: true },
      { id: 'RL', x: -0.78, z: -1.42, isFront: false },
      { id: 'RR', x: 0.78, z: -1.42, isFront: false }
    ];

    const tireTex = TextureGenerator.createTireTexture(this.scene);
    tireTex.anisotropicFilteringLevel = 16;
    tireTex.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);

    const rimTex = TextureGenerator.createWheelRimTexture(this.scene);
    rimTex.anisotropicFilteringLevel = 16;
    rimTex.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);

    const tireMat = new StandardMaterial('tireMat', this.scene);
    tireMat.diffuseTexture = tireTex;
    tireMat.roughness = 0.85;
    tireMat.specularColor = new Color3(0.05, 0.05, 0.05);

    const rimMat = new StandardMaterial('rimMat', this.scene);
    rimMat.diffuseTexture = rimTex;
    rimMat.roughness = 0.3;
    rimMat.specularColor = new Color3(0.7, 0.7, 0.7);

    for (const wp of wheelPositions) {
      const steerPivot = new TransformNode(`steer_${wp.id}`, this.scene);
      steerPivot.position.set(wp.x, 0.355, wp.z);
      steerPivot.parent = this.vehicleGroup;

      const spinGroup = new TransformNode(`spin_${wp.id}`, this.scene);
      spinGroup.parent = steerPivot;

      const tireMesh = MeshBuilder.CreateCylinder(`tire_${wp.id}`, {
        diameter: 0.71,
        height: 0.28,
        tessellation: 24
      }, this.scene);
      tireMesh.rotation.z = Math.PI / 2;
      tireMesh.material = tireMat;
      tireMesh.receiveShadows = false;
      tireMesh.parent = spinGroup;

      const rimMesh = MeshBuilder.CreateCylinder(`rim_${wp.id}`, {
        diameter: 0.49,
        height: 0.284,
        tessellation: 24
      }, this.scene);
      rimMesh.rotation.z = Math.PI / 2;
      rimMesh.material = rimMat;
      rimMesh.receiveShadows = false;
      rimMesh.parent = spinGroup;

      this.wheels.push({
        id: wp.id,
        isFront: wp.isFront,
        steerPivot,
        spinGroup,
        tireMesh,
        rimMesh
      });
    }

    // 4. Front Headlights (High-intensity Night Beams + Forward Ground Flood)
    // Offset upward and outward to match real kei van headlight housing coordinates
    this.headlightL = new SpotLight(
      'headlightL',
      new Vector3(-0.76, 0.74, 2.25),
      new Vector3(0, -0.05, 1).normalize(),
      Math.PI / 4.2,
      2,
      this.scene
    );
    this.headlightL.diffuse = new Color3(1.0, 0.97, 0.93);
    this.headlightL.intensity = 0;
    this.headlightL.range = 75;
    this.headlightL.parent = this.chassisGroup;

    this.headlightR = new SpotLight(
      'headlightR',
      new Vector3(0.76, 0.74, 2.25),
      new Vector3(0, -0.05, 1).normalize(),
      Math.PI / 4.2,
      2,
      this.scene
    );
    this.headlightR.diffuse = new Color3(1.0, 0.97, 0.93);
    this.headlightR.intensity = 0;
    this.headlightR.range = 75;
    this.headlightR.parent = this.chassisGroup;

    this.headlightFlood = new PointLight(
      'headlightFlood',
      new Vector3(0, 0.76, 3.2),
      this.scene
    );
    this.headlightFlood.diffuse = new Color3(1.0, 0.98, 0.93);
    this.headlightFlood.intensity = 0;
    this.headlightFlood.range = 32;
    this.headlightFlood.parent = this.chassisGroup;

    // 5. Dual Rear Dynamic Brake Lights (PointLights positioned up and wider on rear corner pillars)
    this.brakeLightL = new PointLight(
      'brakeLightL',
      new Vector3(-0.85, 0.70, -2.26),
      this.scene
    );
    this.brakeLightL.diffuse = new Color3(1.0, 0.07, 0.13);
    this.brakeLightL.intensity = 0;
    this.brakeLightL.range = 5.0;
    this.brakeLightL.parent = this.chassisGroup;

    this.brakeLightR = new PointLight(
      'brakeLightR',
      new Vector3(0.85, 0.70, -2.26),
      this.scene
    );
    this.brakeLightR.diffuse = new Color3(1.0, 0.07, 0.13);
    this.brakeLightR.intensity = 0;
    this.brakeLightR.range = 5.0;
    this.brakeLightR.parent = this.chassisGroup;

    // 5b. Rear Running Position Lights (Warm backlight glow on outer rear edges)
    this.rearRunningLightL = new PointLight(
      'rearRunningLightL',
      new Vector3(-0.88, 0.74, -2.26),
      this.scene
    );
    this.rearRunningLightL.diffuse = new Color3(1.0, 0.96, 0.82);
    this.rearRunningLightL.intensity = 0;
    this.rearRunningLightL.range = 2.8;
    this.rearRunningLightL.parent = this.chassisGroup;

    this.rearRunningLightR = new PointLight(
      'rearRunningLightR',
      new Vector3(0.88, 0.74, -2.26),
      this.scene
    );
    this.rearRunningLightR.diffuse = new Color3(1.0, 0.96, 0.82);
    this.rearRunningLightR.intensity = 0;
    this.rearRunningLightR.range = 2.8;
    this.rearRunningLightR.parent = this.chassisGroup;

    // Exclude wheel and tire meshes from the brake and running lights so tires don't glow red
    for (const w of this.wheels) {
      if (w.tireMesh) {
        this.brakeLightL.excludedMeshes.push(w.tireMesh);
        this.brakeLightR.excludedMeshes.push(w.tireMesh);
        this.rearRunningLightL.excludedMeshes.push(w.tireMesh);
        this.rearRunningLightR.excludedMeshes.push(w.tireMesh);
      }
      if (w.rimMesh) {
        this.brakeLightL.excludedMeshes.push(w.rimMesh);
        this.brakeLightR.excludedMeshes.push(w.rimMesh);
        this.rearRunningLightL.excludedMeshes.push(w.rimMesh);
        this.rearRunningLightR.excludedMeshes.push(w.rimMesh);
      }
    }

    // 6. Temporary fallback body for zero blank frames
    this.createFallbackBody();

    // 7. Load custom 3D Kei Van GLB model
    this.loadCustomModel();

    // 8. Reactive Anime White Speed Lines (>= 70 km/h)
    this.initAnimeSpeedLines();

    // 9. Asphalt-Style Dual Rear Blue Exhaust Nitro Jets & Ground Flame Trails
    this.initNitroTrails();
  }

  createFallbackBody() {
    this.fallbackBody = new TransformNode('FallbackBody', this.scene);
    this.fallbackBody.parent = this.chassisGroup;

    const bodyMat = new StandardMaterial('fallbackBodyMat', this.scene);
    bodyMat.diffuseColor = new Color3(0.0, 0.70, 0.85); // cyan
    bodyMat.specularColor = new Color3(0, 0, 0);
    bodyMat.roughness = 0.9;

    const greenMat = new StandardMaterial('fallbackGreenMat', this.scene);
    greenMat.diffuseColor = new Color3(0.30, 0.72, 0.14); // green
    greenMat.specularColor = new Color3(0, 0, 0);
    greenMat.roughness = 0.9;

    const lowerBox = MeshBuilder.CreateBox('fallbackLower', {
      width: 1.80,
      height: 0.70,
      depth: 4.40
    }, this.scene);
    lowerBox.position.set(0, 0.40, 0.04);
    lowerBox.material = bodyMat;
    lowerBox.receiveShadows = false;
    lowerBox.parent = this.fallbackBody;

    const upperBox = MeshBuilder.CreateBox('fallbackUpper', {
      width: 1.76,
      height: 0.90,
      depth: 4.30
    }, this.scene);
    upperBox.position.set(0, 1.15, -0.05);
    upperBox.material = greenMat;
    upperBox.receiveShadows = false;
    upperBox.parent = this.fallbackBody;
  }

  async loadCustomModel() {
    try {
      const result = await SceneLoader.ImportMeshAsync(
        '',
        '/models/',
        'checkers_van_body_01.glb',
        this.scene,
        (evt) => {
          if (this.options && this.options.onProgress) {
            this.options.onProgress(evt);
          }
        }
      );

      const meshes = result.meshes;
      const rootNode = meshes[0];

      // Whitelist only primary Kei Van body shell meshes (Cube, Cube_1, Cube_2, Cube_3)
      for (const mesh of meshes) {
        if (mesh === rootNode) continue;
        const name = (mesh.name || '').toLowerCase();
        const parentName = (mesh.parent?.name || '').toLowerCase();

        const isAllowedBody = name === 'cube' ||
                              parentName === 'cube' ||
                              (name.startsWith('cube_') && !name.includes('001') && !name.includes('002'));

        mesh.setEnabled(isAllowedBody);
        mesh.isVisible = isAllowedBody;
        mesh.receiveShadows = false; // Strictly guarantees the vehicle NEVER receives any shadow

        if (isAllowedBody && mesh.material) {
          // Maximize texture crispness with 16x anisotropic filtering and trilinear mipmapping
          const enhanceTexture = (tex) => {
            if (tex) {
              tex.anisotropicFilteringLevel = 16;
              tex.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
            }
          };

          const mat = mesh.material;
          enhanceTexture(mat.albedoTexture);
          enhanceTexture(mat.diffuseTexture);
          enhanceTexture(mat.bumpTexture);
          enhanceTexture(mat.metallicTexture);
          enhanceTexture(mat.roughnessTexture);
          enhanceTexture(mat.ambientTexture);
          enhanceTexture(mat.emissiveTexture);
          enhanceTexture(mat.opacityTexture);

          if (mat instanceof PBRMaterial || mat.getClassName() === 'PBRMaterial') {
            mat.transparencyMode = 0; // Strictly opaque: writes depth to Z-buffer so far-side speed lines are occluded when vehicle turns
            // Clean matte finish with zero specular reflections, while receiving bright ambient daylight irradiance
            if (mat.clearCoat) {
              mat.clearCoat.isEnabled = false;
              mat.clearCoat.intensity = 0.0;
            }
            mat.environmentIntensity = 0.65; // Bright ambient daylight irradiance from HDRI so the vehicle is never too dark
            mat.specularIntensity = 0.0; // Zero specular shine / reflections
            mat.roughness = 0.90; // Clean matte non-reflective body
            mat.metallic = 0.0; // Pure non-metallic dielectric body
            mat.directIntensity = 1.25; // Bright, clean direct sunlight illumination
            // Disable any baked ambient occlusion texture channel to prevent shadows occluding the car body
            mat.ambientTextureStrength = 0.0;
            mat.useAmbientOcclusionFromMetallicTextureRed = false;
          } else if (mat.specularColor) {
            mat.specularColor.set(0, 0, 0);
          }
        }
      }

      rootNode.parent = this.chassisGroup;
      rootNode.position.set(0, -0.355, 0);
      this.customBody = rootNode;

      // Dispose fallback body now that custom model is loaded
      if (this.fallbackBody) {
        this.fallbackBody.dispose();
        this.fallbackBody = null;
      }

      console.log('✅ Custom 3D Kei Van Body loaded into Babylon.js scene!');
      if (this.options && this.options.onLoaded) {
        this.options.onLoaded(rootNode);
      }
    } catch (err) {
      console.warn('ℹ️ Could not load /models/checkers_van_body_01.glb, keeping fallback body:', err);
      if (this.options && this.options.onError) {
        this.options.onError(err);
      }
    }
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

    const rearRunningIntensity = on ? 0.35 : 0.0;
    if (this.rearRunningLightL) this.rearRunningLightL.intensity = rearRunningIntensity;
    if (this.rearRunningLightR) this.rearRunningLightR.intensity = rearRunningIntensity;
  }

  initAnimeSpeedLines() {
    this.speedLinesGroup = new TransformNode('AnimeSpeedLines', this.scene);
    this.speedLinesGroup.parent = this.chassisGroup;
    this.speedLinesGroup.setEnabled(false);

    const speedLineTex = TextureGenerator.createAnimeSpeedLineTexture(this.scene);
    const speedLineMat = new StandardMaterial('animeSpeedLineMat', this.scene);
    speedLineMat.diffuseTexture = speedLineTex;
    speedLineMat.opacityTexture = speedLineTex;
    speedLineMat.useAlphaFromDiffuseTexture = true;
    speedLineMat.diffuseColor = new Color3(1.0, 1.0, 1.0);
    speedLineMat.emissiveColor = new Color3(1.0, 1.0, 1.0);
    speedLineMat.specularColor = new Color3(0, 0, 0);
    speedLineMat.disableLighting = true;
    speedLineMat.backFaceCulling = false;
    speedLineMat.disableDepthWrite = true; // Alpha blending with standard depth testing (allows car body to occlude far-side lines)
    speedLineMat.freeze(); // Freeze material bindings and shaders to eliminate render stutter

    this.speedLines = [];
    const count = 16; // Lean, optimized count (8 left side, 8 right side)

    for (let i = 0; i < count; i++) {
      const node = new TransformNode(`speedLine_${i}`, this.scene);
      node.parent = this.speedLinesGroup;

      // Horizontal crossed plane (anchored at front tip: position.z = -0.5 so tip is at local z=0 and trails backward)
      const hPlane = MeshBuilder.CreatePlane(`sl_h_${i}`, { width: 1.0, height: 1.0 }, this.scene);
      hPlane.rotation.y = -Math.PI / 2;
      hPlane.position.z = -0.5;
      hPlane.material = speedLineMat;
      hPlane.isPickable = false;
      hPlane.doNotSyncBoundingInfo = true;
      hPlane.alwaysSelectAsActiveMesh = true;
      hPlane.parent = node;

      // Vertical crossed plane (perpendicular cross-ribbon for 360-degree visibility, anchored at front tip)
      const vPlane = MeshBuilder.CreatePlane(`sl_v_${i}`, { width: 1.0, height: 1.0 }, this.scene);
      vPlane.rotation.y = -Math.PI / 2;
      vPlane.rotation.z = Math.PI / 2;
      vPlane.position.z = -0.5;
      vPlane.material = speedLineMat;
      vPlane.isPickable = false;
      vPlane.doNotSyncBoundingInfo = true;
      vPlane.alwaysSelectAsActiveMesh = true;
      vPlane.parent = node;

      // 8 lines on Left side, 8 lines on Right side
      const isRight = (i >= 8);

      const sl = {
        node,
        isRight,
        x: 0,
        y: 0,
        z: 0,
        baseLength: 1.5 + Math.random() * 0.8,
        baseThickness: 0.024 + Math.random() * 0.016,
        speedMult: 0.95 + Math.random() * 0.35
      };

      this.resetSpeedLine(sl, false);
      // Pre-scatter initial Z positions along vehicle flank [from front wheel arch to rear axle]
      sl.z = 1.3 - Math.random() * 2.8;
      node.position.set(sl.x, sl.y, sl.z);

      this.speedLines.push(sl);
    }
  }

  resetSpeedLine(sl, atFront = true) {
    sl.speedMult = 0.95 + Math.random() * 0.35;
    sl.baseLength = 1.5 + Math.random() * 0.8;
    sl.baseThickness = 0.024 + Math.random() * 0.016;

    if (atFront) {
      // Anchored strictly behind the front bumper (+2.15) at front wheel arch/fender (+1.1 to +1.4)
      sl.z = 1.1 + Math.random() * 0.35;
    }

    // Wide on both sides of the car (x = ± [1.65, 2.20])
    const sideSign = sl.isRight ? 1 : -1;
    sl.x = sideSign * (1.65 + Math.random() * 0.55);

    // A bit lower: skimming low near road and lower tire/rim level (local y in [-0.26, -0.10] => world y ~ 0.095m to 0.255m)
    sl.y = -0.26 + Math.random() * 0.16;
  }

  updateAnimeSpeedLines(dt, vehiclePhysics) {
    if (!this.speedLinesGroup || !this.speedLines) return;

    // Trigger reactive anime speed lines only at 70 km/h and above (70 km/h ≈ 19.44 m/s)
    const speedKmh = Math.abs(vehiclePhysics.speed) * 3.6;
    if (speedKmh < 70.0) {
      if (this.speedLinesGroup.isEnabled()) {
        this.speedLinesGroup.setEnabled(false);
      }
      return;
    }

    if (!this.speedLinesGroup.isEnabled()) {
      this.speedLinesGroup.setEnabled(true);
    }

    // Dynamic length growth: stretches with speed, but kept contained so it does not stream too far back
    const speedExcess = Math.max(0.0, speedKmh - 70.0);
    const lengthMultiplier = 1.0 + Math.min(1.0, speedExcess / 25.0) * 0.65; // 1.0x at 70 km/h up to 1.65x at 95 km/h
    const thicknessMultiplier = 1.0 + Math.min(1.0, speedExcess / 25.0) * 0.35;
    const streamVelocity = Math.abs(vehiclePhysics.speed) * 2.8;

    for (let i = 0; i < 16; i++) {
      const sl = this.speedLines[i];
      sl.z -= streamVelocity * sl.speedMult * dt;

      // Reactive length scaling based on van speed
      const currentLength = sl.baseLength * lengthMultiplier;
      const tailZ = sl.z - currentLength;

      // Reset when the tail reaches just past the rear of the car (~1m behind rear bumper at -2.2)
      if (tailZ < -3.2) {
        this.resetSpeedLine(sl, true);
      }

      // Classic anime rapid strobing jitter
      const currentThickness = sl.baseThickness * thicknessMultiplier;
      const jitter = 0.88 + 0.24 * Math.random();

      sl.node.position.set(sl.x, sl.y, sl.z);
      sl.node.scaling.set(
        currentThickness * jitter,
        currentThickness * jitter,
        currentLength * jitter
      );
    }
  }

  initNitroTrails() {
    this.nitroTrailsGroup = new TransformNode('NitroTrailsGroup', this.scene);
    this.nitroTrailsGroup.parent = this.chassisGroup;

    // Dual exhaust nozzles on lower rear bumper (Left: -0.45m, Right: +0.45m, Y: 0.16m, Z: -2.26m)
    const exhaustX = 0.45;
    const exhaustY = 0.16;
    const exhaustZ = -2.26;

    // 0. Soft Lightsaber Longitudinal Feathering Gradient (U=0 nozzle to U=1 tail)
    const featherDt = new DynamicTexture('nitroFeatherTex', 256, this.scene, false);
    const fCtx = featherDt.getContext();
    const fGrad = fCtx.createLinearGradient(0, 0, 256, 0);
    fGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    fGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.95)');
    fGrad.addColorStop(0.65, 'rgba(255, 255, 255, 0.65)');
    fGrad.addColorStop(0.85, 'rgba(255, 255, 255, 0.25)');
    fGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    fCtx.fillStyle = fGrad;
    fCtx.fillRect(0, 0, 256, 256);
    featherDt.hasAlpha = true;
    featherDt.update();

    // 1. Core high-energy beam tube material (Hex: #1bb1aa with hyper-bright incandescent center and soft lightsaber edge)
    const coreMat = new StandardMaterial('nitroTubeCoreMat', this.scene);
    coreMat.diffuseTexture = featherDt;
    coreMat.opacityTexture = featherDt;
    coreMat.diffuseColor = Color3.FromHexString('#1bb1aa');
    coreMat.emissiveColor = new Color3(0.40, 0.98, 0.95); // High-intensity luminous core
    coreMat.specularColor = new Color3(0, 0, 0);
    coreMat.alpha = 0.95;
    coreMat.alphaMode = Engine.ALPHA_ADD;
    coreMat.disableLighting = true;
    coreMat.backFaceCulling = false;

    // Soft lightsaber silhouette edge falloff for core beam
    coreMat.opacityFresnelParameters = new FresnelParameters();
    coreMat.opacityFresnelParameters.leftColor = new Color3(0.02, 0.02, 0.02); // Glancing edge fades to transparent
    coreMat.opacityFresnelParameters.rightColor = new Color3(1.0, 1.0, 1.0);  // Center facing camera is opaque
    coreMat.opacityFresnelParameters.power = 1.6;
    coreMat.opacityFresnelParameters.bias = 0.04;

    coreMat.emissiveFresnelParameters = new FresnelParameters();
    coreMat.emissiveFresnelParameters.leftColor = new Color3(0, 0, 0);
    coreMat.emissiveFresnelParameters.rightColor = new Color3(0.40, 0.98, 0.95);
    coreMat.emissiveFresnelParameters.power = 1.4;
    coreMat.emissiveFresnelParameters.bias = 0.05;

    // 2. Volumetric plasma sheath material (Soft lightsaber outer envelope in pure #1bb1aa)
    const sheathMat = new StandardMaterial('nitroTubeSheathMat', this.scene);
    sheathMat.diffuseTexture = featherDt;
    sheathMat.opacityTexture = featherDt;
    sheathMat.diffuseColor = Color3.FromHexString('#1bb1aa');
    sheathMat.emissiveColor = Color3.FromHexString('#1bb1aa');
    sheathMat.specularColor = new Color3(0, 0, 0);
    sheathMat.alpha = 0.72;
    sheathMat.alphaMode = Engine.ALPHA_ADD;
    sheathMat.disableLighting = true;
    sheathMat.backFaceCulling = false;

    // Soft lightsaber silhouette edge falloff: glancing edges smoothly fade to zero opacity & emission
    sheathMat.opacityFresnelParameters = new FresnelParameters();
    sheathMat.opacityFresnelParameters.leftColor = new Color3(0, 0, 0); // 0 at grazing angle
    sheathMat.opacityFresnelParameters.rightColor = new Color3(1.0, 1.0, 1.0);
    sheathMat.opacityFresnelParameters.power = 2.4;
    sheathMat.opacityFresnelParameters.bias = 0.0;

    sheathMat.emissiveFresnelParameters = new FresnelParameters();
    sheathMat.emissiveFresnelParameters.leftColor = new Color3(0, 0, 0); // Zero outer edge cutoff
    sheathMat.emissiveFresnelParameters.rightColor = Color3.FromHexString('#1bb1aa');
    sheathMat.emissiveFresnelParameters.power = 2.0;
    sheathMat.emissiveFresnelParameters.bias = 0.0;

    // 3. Exhaust nozzle supersonic shock diamonds (accent rings near exhaust tip)
    const ringMat = new StandardMaterial('nitroShockRingMat', this.scene);
    ringMat.diffuseColor = Color3.FromHexString('#1bb1aa');
    ringMat.emissiveColor = new Color3(0.35, 0.96, 0.93);
    ringMat.specularColor = new Color3(0, 0, 0);
    ringMat.alpha = 0.88;
    ringMat.alphaMode = Engine.ALPHA_ADD;
    ringMat.disableLighting = true;
    ringMat.backFaceCulling = false;

    ringMat.opacityFresnelParameters = new FresnelParameters();
    ringMat.opacityFresnelParameters.leftColor = new Color3(0.05, 0.05, 0.05);
    ringMat.opacityFresnelParameters.rightColor = new Color3(1.0, 1.0, 1.0);
    ringMat.opacityFresnelParameters.power = 1.8;

    // 4. Ground Wash Neon Aura beneath van in #1bb1aa
    const underglowDt = new DynamicTexture('nitroUnderglowTex', 256, this.scene, false);
    const uCtx = underglowDt.getContext();
    const grad = uCtx.createRadialGradient(128, 128, 15, 128, 128, 122);
    grad.addColorStop(0, 'rgba(27, 177, 170, 0.95)');
    grad.addColorStop(0.35, 'rgba(27, 177, 170, 0.65)');
    grad.addColorStop(0.70, 'rgba(27, 177, 170, 0.25)');
    grad.addColorStop(1.0, 'rgba(27, 177, 170, 0.0)');
    uCtx.fillStyle = grad;
    uCtx.fillRect(0, 0, 256, 256);
    underglowDt.hasAlpha = true;
    underglowDt.update();

    const underglowMat = new StandardMaterial('nitroUnderglowMat', this.scene);
    underglowMat.diffuseTexture = underglowDt;
    underglowMat.emissiveTexture = underglowDt;
    underglowMat.diffuseColor = Color3.FromHexString('#1bb1aa');
    underglowMat.emissiveColor = Color3.FromHexString('#1bb1aa');
    underglowMat.alphaMode = Engine.ALPHA_ADD;
    underglowMat.disableLighting = true;
    underglowMat.backFaceCulling = false;
    underglowMat.disableDepthWrite = true;

    this.underglowPlane = MeshBuilder.CreatePlane('nitroUnderglowPlane', {
      width: 2.9,
      height: 4.9
    }, this.scene);
    this.underglowPlane.rotation.x = Math.PI / 2;
    this.underglowPlane.position.set(0, -0.32, 0);
    this.underglowPlane.material = underglowMat;
    this.underglowPlane.isPickable = false;
    this.underglowPlane.receiveShadows = false;
    this.underglowPlane.parent = this.nitroTrailsGroup;
    this.underglowMat = underglowMat;

    this.nitroJets = [];
    const nozzleOffsets = [-exhaustX, exhaustX];

    // Build 6 segment points along -Z for high-fidelity curved jet streams
    const numPoints = 8;
    const createInitialPath = (x) => {
      const pts = [];
      for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        pts.push(new Vector3(x, exhaustY, exhaustZ - t * 2.8));
      }
      return pts;
    };

    // Radius tapering functions: sleek lightsaber plasma needle tail with zero blunt edge
    const coreRadiusFn = (index, distance) => {
      const t = index / (numPoints - 1);
      return Math.max(0.001, 0.052 * Math.pow(1.0 - t, 0.70));
    };

    const sheathRadiusFn = (index, distance) => {
      const t = index / (numPoints - 1);
      return Math.max(0.002, 0.145 * Math.pow(1.0 - t, 0.65));
    };

    for (let s = 0; s < 2; s++) {
      const nx = nozzleOffsets[s];
      const initialPath = createInitialPath(nx);

      // Core electric beam tube
      const coreTube = MeshBuilder.CreateTube(`nitroCoreTube_${s}`, {
        path: initialPath,
        radiusFunction: coreRadiusFn,
        sideOrientation: Mesh.DOUBLESIDE,
        cap: Mesh.NO_CAP,
        updatable: true
      }, this.scene);
      coreTube.material = coreMat;
      coreTube.receiveShadows = false;
      coreTube.parent = this.nitroTrailsGroup;

      // Volumetric plasma sheath tube
      const sheathTube = MeshBuilder.CreateTube(`nitroSheathTube_${s}`, {
        path: initialPath,
        radiusFunction: sheathRadiusFn,
        sideOrientation: Mesh.DOUBLESIDE,
        cap: Mesh.NO_CAP,
        updatable: true
      }, this.scene);
      sheathTube.material = sheathMat;
      sheathTube.receiveShadows = false;
      sheathTube.parent = this.nitroTrailsGroup;

      // Shock diamonds (3 concentric supersonic plasma discs near nozzle exit)
      const shockDiamonds = [];
      for (let d = 0; d < 3; d++) {
        const ring = MeshBuilder.CreateTorus(`nitroShock_${s}_${d}`, {
          diameter: 0.18 - d * 0.035,
          thickness: 0.032,
          tessellation: 16
        }, this.scene);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(nx, exhaustY, exhaustZ - 0.22 - d * 0.28);
        ring.material = ringMat;
        ring.receiveShadows = false;
        ring.parent = this.nitroTrailsGroup;
        shockDiamonds.push(ring);
      }

      this.nitroJets.push({
        side: s,
        nx,
        baseY: exhaustY,
        baseZ: exhaustZ,
        numPoints,
        coreTube,
        sheathTube,
        coreRadiusFn,
        sheathRadiusFn,
        shockDiamonds,
        path: initialPath
      });
    }

    this.nitroTrailsGroup.setEnabled(false);
  }

  updateNitroTrails(dt, vehiclePhysics) {
    if (!this.nitroTrailsGroup) return;

    const isActive = Boolean(vehiclePhysics && vehiclePhysics.isNitroActive);
    if (!isActive) {
      if (this.nitroTrailsGroup.isEnabled()) {
        this.nitroTrailsGroup.setEnabled(false);
      }
      return;
    }

    if (!this.nitroTrailsGroup.isEnabled()) {
      this.nitroTrailsGroup.setEnabled(true);
    }

    const t = performance.now() * 0.028; // High-frequency energetic plasma pulse
    const flicker1 = Math.sin(t * 5.2);
    const flicker2 = Math.cos(t * 6.7);
    const jitterStream = 0.94 + 0.14 * Math.random();

    // Stream length dynamically responds to vehicle speed (elongates from 2.4m to 3.6m at 110 km/h)
    const speedRatio = Math.min(1.0, Math.max(0.0, (Math.abs(vehiclePhysics.speed * 3.6) - 50.0) / 60.0));
    const totalJetLength = (2.4 + speedRatio * 1.2) * jitterStream;

    // Lateral exhaust flex when cornering
    const lateralDrift = -(vehiclePhysics.lateralVelocity || 0) * 0.028;

    for (let i = 0; i < this.nitroJets.length; i++) {
      const jet = this.nitroJets[i];
      const pts = jet.path;
      const nPts = jet.numPoints;

      for (let p = 0; p < nPts; p++) {
        const frac = p / (nPts - 1);
        const zPos = jet.baseZ - frac * totalJetLength;
        // Natural aerodynamic slight upward kick & lateral slip curl towards tail
        const yPerturb = Math.sin(t * 4.0 + p * 0.8) * 0.018 * frac;
        const xPerturb = Math.cos(t * 3.5 + p * 0.9) * 0.022 * frac + (lateralDrift * frac * frac);

        pts[p].set(
          jet.nx + xPerturb,
          jet.baseY + yPerturb - frac * 0.04, // Stays above road plane
          zPos
        );
      }

      // Recompute tube vertices in place with zero garbage collection
      MeshBuilder.CreateTube(null, {
        path: pts,
        radiusFunction: jet.coreRadiusFn,
        instance: jet.coreTube
      });

      MeshBuilder.CreateTube(null, {
        path: pts,
        radiusFunction: jet.sheathRadiusFn,
        instance: jet.sheathTube
      });

      // Animate shock diamonds pulsation
      for (let d = 0; d < jet.shockDiamonds.length; d++) {
        const r = jet.shockDiamonds[d];
        const pulse = 1.0 + Math.sin(t * 6.0 + d * 1.8) * 0.16;
        r.scaling.set(pulse, pulse, pulse);
        r.position.z = jet.baseZ - 0.20 - d * 0.28 - (flicker1 * 0.025);
      }
    }

    // Pulse animated neon turquoise underglow pool (#1bb1aa)
    if (this.underglowPlane && this.underglowMat) {
      const pulse = 1.0 + Math.sin(t * 6.5) * 0.08;
      this.underglowPlane.scaling.set(pulse, 1.0, pulse);
      this.underglowMat.alpha = 0.70 + Math.sin(t * 8.0) * 0.22;
    }
  }

  update(dt, vehiclePhysics, input = null) {
    // 1. Root position sits directly at ground contact elevation
    this.root.position.set(
      vehiclePhysics.position.x,
      vehiclePhysics.position.y,
      vehiclePhysics.position.z
    );
    this.root.rotation.y = vehiclePhysics.heading;

    // 2. Terrain Slope Alignment (applies to both wheels and chassis)
    this.vehicleGroup.rotation.x = vehiclePhysics.surfacePitch || 0;
    this.vehicleGroup.rotation.z = vehiclePhysics.surfaceRoll || 0;

    // 3. Dynamic Suspension Lean & Landing Compression
    const comp = vehiclePhysics.suspensionOffset !== undefined ? vehiclePhysics.suspensionOffset : (vehiclePhysics.suspensionCompress || 0);
    const pitchOffset = vehiclePhysics.suspensionPitchOffset || 0;
    const wobbleRoll = vehiclePhysics.chassisWobbleRoll || 0;
    this.chassisGroup.position.y = 0.355 - comp;
    this.chassisGroup.rotation.x = (vehiclePhysics.dynamicPitch || 0) + pitchOffset;
    this.chassisGroup.rotation.z = (vehiclePhysics.dynamicRoll || 0) + wobbleRoll;

    // 4. Wheel Spin, Steering & In-Air Suspension Droop
    const rollDelta = (vehiclePhysics.speed / 0.355) * dt;
    const wheelDroop = vehiclePhysics.isAirborne ? -0.035 : 0;

    for (const w of this.wheels) {
      const indOffset = (vehiclePhysics.wheelOffsets && vehiclePhysics.wheelOffsets[w.id]) || 0;
      w.steerPivot.position.y = 0.355 + wheelDroop + indOffset;
      w.spinGroup.rotation.x += rollDelta;
      if (w.isFront) {
        w.steerPivot.rotation.y = vehiclePhysics.steerAngle;
      }
    }

    // 5. Dynamic Brake Lights: strictly controlled by user input
    // Lights turn ON when brake, handbrake, or reverse buttons are pressed/held, and OFF immediately upon release.
    const isBrakeOrReversePressed = Boolean(input && input.brake > 0.05);
    const isHandbrakePressed = Boolean(input && input.handbrake);
    const brakeActive = isBrakeOrReversePressed || isHandbrakePressed;
    const brakeIntensity = brakeActive ? 2.5 : 0.0;
    if (this.brakeLightL) this.brakeLightL.intensity = brakeIntensity;
    if (this.brakeLightR) this.brakeLightR.intensity = brakeIntensity;

    // 6. Reactive Anime Speed Lines (>= 70 km/h)
    this.updateAnimeSpeedLines(dt, vehiclePhysics);

    // 7. Asphalt-Style Dual Rear Blue Exhaust Nitro Jets & Ground Flame Trails
    this.updateNitroTrails(dt, vehiclePhysics);
  }
}
