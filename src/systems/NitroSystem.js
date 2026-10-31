import {
  TransformNode,
  Mesh,
  MeshBuilder,
  Material,
  StandardMaterial,
  Texture,
  Color3,
  Vector3
} from '@babylonjs/core';

export class NitroSystem {
  constructor(scene, shadowGenerator = null, sunLight = null) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    this.sunLight = sunLight;

    this.pickupItems = [];
    this.nitroActive = false;
    this.nitroTimer = 0; // Remaining active boost seconds (5.0s on pickup)
    this.nitroDuration = 5.0;

    // Fixed locations for pickups in city and proving ground
    this.cityPickupCoords = [
      new Vector3(0, 0, 15),
      new Vector3(-45, 0, -20),
      new Vector3(45, 0, -20),
      new Vector3(0, 0, -95),
      new Vector3(-35, 0, 60),
      new Vector3(35, 0, 60)
    ];

    this.provingGroundCoords = [
      new Vector3(0, 0, 12),      // In front of the central ramp
      new Vector3(16, 0, -10),    // Mogul bumps lane
      new Vector3(-16, 0, -10),   // Washboards lane
      new Vector3(32, 0, 0),      // Havok crash lane
      new Vector3(-32, 0, 0)      // Tabletop lane
    ];

    this.setupShadowPassOrientation();
  }

  setupShadowPassOrientation() {
    if (!this.shadowGenerator) return;
    const shadowMap = this.shadowGenerator.getShadowMap();
    if (!shadowMap) return;

    shadowMap.onBeforeRenderObservable.add(() => {
      if (this.pickupItems.length === 0) return;
      const sunDir = this.sunLight ? this.sunLight.direction : new Vector3(-0.25, -0.92, 0.28).normalize();
      const sunYaw = Math.atan2(sunDir.x, sunDir.z);
      for (let i = 0; i < this.pickupItems.length; i++) {
        const item = this.pickupItems[i];
        if (item && item.mesh && !item.mesh.isDisposed() && item.active) {
          item.mesh.billboardMode = Mesh.BILLBOARDMODE_NONE;
          // Tilt bottle toward the overhead sun ray so its silhouette casts cleanly onto the ground
          item.mesh.rotation.set(Math.PI * 0.35, sunYaw, 0);
          item.mesh.computeWorldMatrix(true);
        }
      }
    });

    shadowMap.onAfterRenderObservable.add(() => {
      if (this.pickupItems.length === 0) return;
      for (let i = 0; i < this.pickupItems.length; i++) {
        const item = this.pickupItems[i];
        if (item && item.mesh && !item.mesh.isDisposed() && item.active) {
          item.mesh.rotation.set(0, 0, 0);
          item.mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
          item.mesh.computeWorldMatrix(true);
        }
      }
    });
  }

  loadLevelPickups(levelName = 'city') {
    this.clearPickups();
    const coords = levelName === 'proving_ground' ? this.provingGroundCoords : this.cityPickupCoords;
    for (let i = 0; i < coords.length; i++) {
      this.createNitroPickup(coords[i], i);
    }
  }

  createNitroPickup(pos, id) {
    // 1. Shaded nitro bottle billboard with alpha-aware directional shadow casting
    const mat = new StandardMaterial(`nitroMat_${id}`, this.scene);
    const tex = new Texture('/assets/nitro_bottle.png', this.scene);
    tex.hasAlpha = true;
    mat.diffuseTexture = tex;
    mat.emissiveTexture = tex;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.diffuseColor = new Color3(0, 0, 0);
    mat.specularColor = new Color3(0, 0, 0);
    mat.ambientColor = new Color3(0, 0, 0);
    mat.disableLighting = true; // 100% vibrant, unaffected by world lighting
    mat.useAlphaFromDiffuseTexture = true;
    mat.transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND;
    mat.alphaCutOff = 0.4;
    mat.backFaceCulling = false;

    // Aspect ratio: 155 / 495 ≈ 0.313 -> width 0.46m x height 1.47m
    const mesh = MeshBuilder.CreatePlane(`nitroPickup_${id}`, {
      width: 0.46,
      height: 1.47
    }, this.scene);
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    mesh.material = mat;
    mesh.receiveShadows = false;
    mesh.position.set(pos.x, pos.y + 0.88, pos.z);

    // Glowing #1bb1aa turquoise ground ring below bottle
    const ringMat = new StandardMaterial(`nitroRingMat_${id}`, this.scene);
    ringMat.diffuseColor = Color3.FromHexString('#1bb1aa');
    ringMat.emissiveColor = Color3.FromHexString('#1bb1aa');
    ringMat.disableLighting = true;
    ringMat.alpha = 0.75;
    ringMat.backFaceCulling = false;

    const ring = MeshBuilder.CreateTorus(`nitroRing_${id}`, {
      diameter: 1.1,
      thickness: 0.08,
      tessellation: 24
    }, this.scene);
    ring.position.set(pos.x, pos.y + 0.04, pos.z);
    ring.material = ringMat;

    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(mesh, false);
    }

    this.pickupItems.push({
      id,
      mesh,
      ring,
      mat,
      ringMat,
      tex,
      basePos: new Vector3(pos.x, pos.y + 0.88, pos.z),
      active: true,
      respawnTimer: 0,
      phase: id * 1.2
    });
  }

  clearPickups() {
    for (let i = 0; i < this.pickupItems.length; i++) {
      const item = this.pickupItems[i];
      if (item) {
        if (this.shadowGenerator && item.mesh) {
          try { this.shadowGenerator.removeShadowCaster(item.mesh, false); } catch (_) {}
        }
        if (item.mesh) {
          try { item.mesh.dispose(false, true); } catch (_) {}
        }
        if (item.ring) {
          try { item.ring.dispose(false, true); } catch (_) {}
        }
      }
    }
    this.pickupItems = [];
  }

  update(dt, vanPos, vehiclePhysics, audio = null) {
    const time = performance.now() * 0.003;

    // 1. Update Nitro Boost Duration & Vehicle Physics boost rate
    if (this.nitroActive) {
      this.nitroTimer -= dt;
      if (this.nitroTimer <= 0) {
        this.nitroTimer = 0;
        this.nitroActive = false;
      }
    }

    if (vehiclePhysics) {
      vehiclePhysics.isNitroActive = this.nitroActive;
      vehiclePhysics.nitroProgress = this.nitroTimer / this.nitroDuration;
    }

    // 2. Animate and Check Pickups
    for (let i = 0; i < this.pickupItems.length; i++) {
      const item = this.pickupItems[i];
      if (!item) continue;

      if (!item.active) {
        item.respawnTimer -= dt;
        if (item.respawnTimer <= 0) {
          item.active = true;
          item.mesh.setEnabled(true);
          item.ring.setEnabled(true);
          if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(item.mesh, false);
          }
        }
        continue;
      }

      // Gentle floating bob & ring pulsation
      const bob = Math.sin(time * 3.0 + item.phase) * 0.10;
      item.mesh.position.y = item.basePos.y + bob;

      const ringScale = 1.0 + Math.sin(time * 4.0 + item.phase) * 0.15;
      item.ring.scaling.set(ringScale, 1.0, ringScale);

      // Check proximity with van (radius 1.85m)
      if (vanPos) {
        const dx = vanPos.x - item.basePos.x;
        const dz = vanPos.z - item.basePos.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < 3.42) { // (1.85)^2 = 3.4225
          this.triggerPickup(item, vehiclePhysics, audio);
        }
      }
    }
  }

  triggerPickup(item, vehiclePhysics, audio = null) {
    item.active = false;
    item.respawnTimer = 10.0; // Respawns after 10 seconds
    item.mesh.setEnabled(false);
    item.ring.setEnabled(false);
    if (this.shadowGenerator) {
      try { this.shadowGenerator.removeShadowCaster(item.mesh, false); } catch (_) {}
    }

    // Activate 5-second controlled spurt of speed taking top speed up to 100/110 km/h (≈ 29.5 m/s)
    this.nitroActive = true;
    this.nitroTimer = this.nitroDuration;

    if (vehiclePhysics) {
      // Immediate energetic forward velocity kick in the direction of vehicle travel
      const forwardX = Math.sin(vehiclePhysics.heading);
      const forwardZ = Math.cos(vehiclePhysics.heading);
      const kickSpeed = Math.max(12.0, vehiclePhysics.speed + 6.5);
      vehiclePhysics.velocity.x = forwardX * kickSpeed;
      vehiclePhysics.velocity.z = forwardZ * kickSpeed;
      vehiclePhysics.speed = kickSpeed;
    }

    if (audio && audio.playNitroBoost) {
      audio.playNitroBoost();
    }
  }
}
