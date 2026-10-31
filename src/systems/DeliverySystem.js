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

export class DeliverySystem {
  constructor(scene, deliverySpots, shadowGenerator = null, sunLight = null) {
    this.scene = scene;
    this.spots = deliverySpots || [];
    this.shadowGenerator = shadowGenerator;
    this.sunLight = sunLight;
    this.currentSpotIndex = 0;
    this.score = 0;
    this.deliveredCount = 0;
    this.deliveredBags = [];

    // Orient billboard bags toward the directional sun during the shadow map pass
    // so the PNG alpha cutout casts its full, true bag + handles silhouette onto the ground
    this.setupShadowPassOrientation();

    // Objective Beacon & Floating Arrow
    this.buildBeacon();

    // Celebration Confetti
    this.initConfetti();
  }

  setupShadowPassOrientation() {
    if (!this.shadowGenerator) return;
    const shadowMap = this.shadowGenerator.getShadowMap();
    if (!shadowMap) return;

    shadowMap.onBeforeRenderObservable.add(() => {
      if (this.deliveredBags.length === 0) return;
      const sunDir = this.sunLight ? this.sunLight.direction : new Vector3(-0.25, -0.92, 0.28).normalize();
      const sunYaw = Math.atan2(sunDir.x, sunDir.z);
      for (let i = 0; i < this.deliveredBags.length; i++) {
        const item = this.deliveredBags[i];
        if (item && item.mesh && !item.mesh.isDisposed()) {
          item.mesh.billboardMode = Mesh.BILLBOARDMODE_NONE;
          // Tilt plane toward the overhead directional sun so the PNG silhouette projects cleanly onto the ground
          item.mesh.rotation.set(Math.PI * 0.35, sunYaw, 0);
          item.mesh.computeWorldMatrix(true);
        }
      }
    });

    shadowMap.onAfterRenderObservable.add(() => {
      if (this.deliveredBags.length === 0) return;
      for (let i = 0; i < this.deliveredBags.length; i++) {
        const item = this.deliveredBags[i];
        if (item && item.mesh && !item.mesh.isDisposed()) {
          item.mesh.rotation.set(0, 0, 0);
          item.mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
          item.mesh.computeWorldMatrix(true);
        }
      }
    });
  }

  buildBeacon() {
    this.beaconGroup = new TransformNode('DeliveryBeacon', this.scene);

    // Glowing pulsing horizontal ring
    const ringMat = new StandardMaterial('beaconRingMat', this.scene);
    ringMat.diffuseColor = new Color3(0.0, 0.74, 0.83); // Cyan
    ringMat.emissiveColor = new Color3(0.0, 0.5, 0.6);
    ringMat.alpha = 0.8;
    ringMat.backFaceCulling = false;

    this.pulseRing = MeshBuilder.CreateTorus('pulseRing', {
      diameter: 3.8,
      thickness: 0.3,
      tessellation: 32
    }, this.scene);
    this.pulseRing.position.y = 0.08;
    this.pulseRing.material = ringMat;
    this.pulseRing.parent = this.beaconGroup;

    // Glowing vertical light cylinder
    const cylMat = new StandardMaterial('beaconCylMat', this.scene);
    cylMat.diffuseColor = new Color3(0.0, 0.74, 0.83);
    cylMat.emissiveColor = new Color3(0.0, 0.4, 0.5);
    cylMat.alpha = 0.25;
    cylMat.backFaceCulling = false;

    this.lightCylinder = MeshBuilder.CreateCylinder('lightCylinder', {
      diameter: 3.6,
      height: 14,
      tessellation: 24
    }, this.scene);
    this.lightCylinder.position.y = 7;
    this.lightCylinder.material = cylMat;
    this.lightCylinder.parent = this.beaconGroup;

    // 3D Bouncing Downward Arrow
    const arrowMat = new StandardMaterial('arrowMat', this.scene);
    arrowMat.diffuseColor = new Color3(1.0, 0.84, 0.0);
    arrowMat.emissiveColor = new Color3(1.0, 0.67, 0.0);
    arrowMat.roughness = 0.2;

    this.bounceArrow = MeshBuilder.CreateCylinder('bounceArrow', {
      diameterTop: 0,
      diameterBottom: 1.6,
      height: 1.8,
      tessellation: 4
    }, this.scene);
    this.bounceArrow.rotation.x = Math.PI; // point downwards
    this.bounceArrow.position.y = 3.6;
    this.bounceArrow.material = arrowMat;
    this.bounceArrow.parent = this.beaconGroup;

    this.updateTargetSpot();
  }

  initConfetti() {
    this.confettiParticles = [];
    this.confettiMeshes = [];

    // Signature Checkers Sixty60 white and turquoise celebration palette
    const colors = [
      new Color3(0.00, 0.90, 1.00), // Vibrant electric turquoise
      new Color3(1.00, 1.00, 1.00), // Pure brilliant white
      new Color3(0.00, 0.78, 0.88), // Deep Checkers Sixty60 cyan
      new Color3(0.88, 0.97, 1.00)  // Shimmering pearl white
    ];

    const mats = colors.map((col, idx) => {
      const mat = new StandardMaterial(`confettiMat_${idx}`, this.scene);
      mat.diffuseColor = col;
      mat.emissiveColor = col.scale(0.75); // Radiant festive shimmer
      mat.specularColor = new Color3(1.0, 1.0, 1.0);
      mat.specularPower = 32;
      mat.backFaceCulling = false; // Double-sided rendering so rotating ribbons look authentic
      return mat;
    });

    for (let i = 0; i < 72; i++) {
      // Alternate between squares and fluttering paper ribbons
      const isRibbon = (i % 2 === 0);
      const w = isRibbon ? 0.14 : 0.22;
      const h = isRibbon ? 0.28 : 0.22;
      const pMesh = MeshBuilder.CreatePlane(`confetti_${i}`, { width: w, height: h }, this.scene);
      pMesh.material = mats[i % 4];
      pMesh.setEnabled(false);
      this.confettiMeshes.push(pMesh);
    }
  }

  triggerConfetti(pos) {
    this.confettiParticles = [];
    for (let i = 0; i < this.confettiMeshes.length; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 5.5;
      const mesh = this.confettiMeshes[i];
      mesh.position.set(pos.x, pos.y + 0.8, pos.z);
      mesh.setEnabled(true);

      this.confettiParticles.push({
        mesh,
        x: pos.x,
        y: pos.y + 0.8,
        z: pos.z,
        vx: Math.cos(angle) * speed,
        vy: 4.5 + Math.random() * 6.5,
        vz: Math.sin(angle) * speed,
        rotSpeedX: (Math.random() - 0.5) * 10.0,
        rotSpeedY: (Math.random() - 0.5) * 10.0,
        rotSpeedZ: (Math.random() - 0.5) * 10.0,
        life: 0,
        maxLife: 1.8 + Math.random() * 0.9
      });
    }
  }

  getCurrentSpot() {
    return this.spots[this.currentSpotIndex];
  }

  updateTargetSpot() {
    const spot = this.getCurrentSpot();
    if (spot) {
      this.beaconGroup.position.set(spot.position.x, spot.position.y, spot.position.z);
      this.pulseRing.setEnabled(true);
      this.lightCylinder.setEnabled(true);
      this.bounceArrow.setEnabled(true);
    } else {
      this.pulseRing.setEnabled(false);
      this.lightCylinder.setEnabled(false);
      this.bounceArrow.setEnabled(false);
    }
  }

  createDeliveredBag(pos) {
    // Checkers Sixty60 Branded Delivery Bag Billboard with Real Alpha-Cutout Directional Shadow
    // Uses the transparent background PNG (/assets/checkers_delivery_bag.png), always faces the camera
    // during scene rendering, and casts a real directional shadow through the scene ShadowGenerator
    // taking the PNG's alpha channel into account.
    const bagMat = new StandardMaterial('deliveredBagMat', this.scene);
    const bagTex = new Texture('/assets/checkers_delivery_bag.png', this.scene);
    bagTex.hasAlpha = true;
    bagMat.diffuseTexture = bagTex;
    bagMat.emissiveTexture = bagTex;
    bagMat.emissiveColor = new Color3(1, 1, 1);
    bagMat.diffuseColor = new Color3(0, 0, 0); // Zero diffuse lighting modulation on the bag itself
    bagMat.specularColor = new Color3(0, 0, 0);
    bagMat.ambientColor = new Color3(0, 0, 0);
    bagMat.disableLighting = true; // 100% shadeless: renders pure source PNG pixels
    bagMat.useAlphaFromDiffuseTexture = true;
    bagMat.transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND;
    bagMat.alphaCutOff = 0.4; // Enables alpha-testing in the ShadowGenerator depth pass so transparent PNG pixels cast no shadow
    bagMat.backFaceCulling = false;

    // 0.90m x 0.92m plane matching the 296x303 PNG aspect ratio
    const bag = MeshBuilder.CreatePlane('deliveredBag', {
      width: 0.90,
      height: 0.92
    }, this.scene);
    bag.billboardMode = Mesh.BILLBOARDMODE_ALL;
    bag.material = bagMat;
    bag.receiveShadows = false; // Strictly guarantees the bag itself receives zero shadows
    bag.position.set(pos.x, pos.y + 0.68, pos.z); // Hovering just above the ground so its directional shadow lands right beneath it

    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(bag, false);
    }

    this.deliveredBags.push({
      mesh: bag,
      material: bagMat,
      texture: bagTex,
      baseY: pos.y + 0.68,
      phase: Math.random() * Math.PI * 2,
      createdAt: performance.now(),
      lifetime: 15.0, // Disappears after 15 seconds
      isDisposed: false
    });
  }

  completeDelivery(bagModel = null, vanPos = null, vanHeading = 0) {
    try {
      const spot = this.getCurrentSpot();
      if (!spot) {
        return {
          score: this.score,
          deliveredCount: this.deliveredCount,
          nextSpot: null
        };
      }

      this.score += 500;
      this.deliveredCount++;

      // Compute delivered bag position to the left or right of the vehicle
      // This ensures the van body never obscures the hovering Checkers bag!
      let spawnPos = spot.position;
      if (vanPos) {
        const cosH = Math.cos(vanHeading);
        const sinH = Math.sin(vanHeading);
        // Vehicle lateral right vector: +X in car local frame
        const vanRightX = cosH;
        const vanRightZ = -sinH;

        // Determine whether destination porch is to the left or right of the vehicle
        const toSpotX = spot.position.x - vanPos.x;
        const toSpotZ = spot.position.z - vanPos.z;
        const sideDot = toSpotX * vanRightX + toSpotZ * vanRightZ;
        const sideSign = sideDot >= 0 ? 1 : -1;

        // Offset 2.35m to the side (car half-width is 0.85m -> ~1.5m clear space beside car)
        const bagX = vanPos.x + vanRightX * (sideSign * 2.35);
        const bagZ = vanPos.z + vanRightZ * (sideSign * 2.35);
        const bagY = vanPos.y;
        spawnPos = new Vector3(bagX, bagY, bagZ);
      }

      this.triggerConfetti(spawnPos);

      // Place branded paper bag hovering with ground contact shadow
      this.createDeliveredBag(spawnPos);

      // Advance to next spot
      this.currentSpotIndex = (this.currentSpotIndex + 1) % this.spots.length;
      this.updateTargetSpot();

      return {
        score: this.score,
        deliveredCount: this.deliveredCount,
        nextSpot: this.getCurrentSpot()
      };
    } catch (err) {
      console.error('Error completing delivery:', err);
      return {
        score: this.score,
        deliveredCount: this.deliveredCount,
        nextSpot: this.getCurrentSpot()
      };
    }
  }

  update(dt, playerPos) {
    const time = performance.now() * 0.003;

    if (this.bounceArrow) {
      this.bounceArrow.position.y = 3.2 + Math.sin(time * 2.5) * 0.5;
      this.bounceArrow.rotation.y += 2.0 * dt;
    }
    if (this.pulseRing) {
      const scale = 1.0 + Math.sin(time * 3) * 0.25;
      this.pulseRing.scaling.set(scale, 1, scale);
    }

    // Update confetti
    if (this.confettiParticles.length > 0) {
      for (let i = 0; i < this.confettiParticles.length; i++) {
        const p = this.confettiParticles[i];
        p.life += dt;
        p.vy -= 9.8 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;

        p.mesh.position.set(p.x, p.y, p.z);
        p.mesh.rotation.x += p.rotSpeedX * dt;
        p.mesh.rotation.y += p.rotSpeedY * dt;
        p.mesh.rotation.z += (p.rotSpeedZ || 0) * dt;
      }

      this.confettiParticles = this.confettiParticles.filter(p => {
        if (p.life >= p.maxLife) {
          p.mesh.setEnabled(false);
          return false;
        }
        return true;
      });
    }

    // Hover floating, subtle bobbing animation & 15-second automatic disappearance
    try {
      const now = performance.now();
      for (let i = this.deliveredBags.length - 1; i >= 0; i--) {
        const item = this.deliveredBags[i];
        if (!item || item.isDisposed) {
          this.deliveredBags.splice(i, 1);
          continue;
        }

        const elapsed = (now - item.createdAt) * 0.001;

        // Disappear completely after 15 seconds (disposing mesh & materials cleanly via native Babylon API)
        if (elapsed >= item.lifetime) {
          try {
            if (item.mesh && !item.mesh.isDisposed()) {
              if (this.shadowGenerator) {
                this.shadowGenerator.removeShadowCaster(item.mesh, false);
              }
              item.mesh.dispose(false, true);
            }
          } catch (_) {}
          item.isDisposed = true;
          this.deliveredBags.splice(i, 1);
          continue;
        }

        // Smooth fade-out during the final 1.5 seconds (seconds 13.5 to 15.0)
        let alphaMult = 1.0;
        if (elapsed > item.lifetime - 1.5) {
          alphaMult = Math.max(0, (item.lifetime - elapsed) / 1.5);
        }

        if (item.mesh && !item.mesh.isDisposed()) {
          const bob = Math.sin(time * 2.8 + item.phase) * 0.06;
          item.mesh.position.y = item.baseY + bob;
          item.mesh.visibility = alphaMult;
        }
      }
    } catch (e) {
      console.warn('Delivered bags update warning:', e);
    }
  }
}
