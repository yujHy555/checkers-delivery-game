import * as THREE from 'three';

export class DeliverySystem {
  constructor(scene, deliverySpots) {
    this.scene = scene;
    this.spots = deliverySpots || [];
    this.currentSpotIndex = 0;
    this.score = 0;
    this.deliveredCount = 0;
    this.deliveredBags = [];

    // Objective Beacon & Floating Arrow
    this.buildBeacon();

    // Particle Confetti for delivery celebration
    this.initConfetti();
  }

  buildBeacon() {
    this.beaconGroup = new THREE.Group();
    this.beaconGroup.name = 'DeliveryBeacon';

    // Glowing pulsing vertical ring
    const ringGeo = new THREE.RingGeometry(1.6, 2.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00bcd4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    this.pulseRing = new THREE.Mesh(ringGeo, ringMat);
    this.pulseRing.rotation.x = -Math.PI / 2;
    this.pulseRing.position.y = 0.05;
    this.beaconGroup.add(this.pulseRing);

    // Glowing vertical light cylinder
    const cylGeo = new THREE.CylinderGeometry(1.8, 1.8, 14, 16, 1, true);
    const cylMat = new THREE.MeshBasicMaterial({
      color: 0x00bcd4,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.lightCylinder = new THREE.Mesh(cylGeo, cylMat);
    this.lightCylinder.position.y = 7;
    this.beaconGroup.add(this.lightCylinder);

    // 3D Bouncing Downward Arrow
    const arrowGeo = new THREE.ConeGeometry(0.8, 1.8, 4);
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0xffd600,
      emissive: 0xffab00,
      roughness: 0.2
    });
    this.bounceArrow = new THREE.Mesh(arrowGeo, arrowMat);
    this.bounceArrow.rotation.x = Math.PI; // point downwards
    this.bounceArrow.position.y = 3.6;
    this.beaconGroup.add(this.bounceArrow);

    this.scene.add(this.beaconGroup);
    this.updateTargetSpot();
  }

  initConfetti() {
    this.confettiParticles = [];
    const confGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(150 * 3);
    const colors = new Float32Array(150 * 3);

    for (let i = 0; i < 150; i++) {
      pos[i * 3 + 1] = -999;
      // Vibrant Checkers Sixty60 colors (cyan, green, yellow, white)
      const c = [
        [0.0, 0.74, 0.83],
        [0.07, 0.72, 0.26],
        [1.0, 0.84, 0.0],
        [1.0, 1.0, 1.0]
      ][i % 4];
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
    }

    confGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    confGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.confettiMat = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 0.95
    });

    this.confettiMesh = new THREE.Points(confGeo, this.confettiMat);
    this.scene.add(this.confettiMesh);
  }

  triggerConfetti(pos) {
    this.confettiParticles = [];
    for (let i = 0; i < 150; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 5.0;
      this.confettiParticles.push({
        x: pos.x,
        y: pos.y + 0.5,
        z: pos.z,
        vx: Math.cos(angle) * speed,
        vy: 4.0 + Math.random() * 6.0,
        vz: Math.sin(angle) * speed,
        life: 0,
        maxLife: 1.5 + Math.random() * 0.8
      });
    }
  }

  getCurrentSpot() {
    return this.spots[this.currentSpotIndex];
  }

  updateTargetSpot() {
    const spot = this.getCurrentSpot();
    if (spot) {
      this.beaconGroup.position.copy(spot.position);
      this.beaconGroup.visible = true;
    } else {
      this.beaconGroup.visible = false;
    }
  }

  completeDelivery(bagModel) {
    const spot = this.getCurrentSpot();
    if (!spot) return;

    this.score += 500;
    this.deliveredCount++;
    this.triggerConfetti(spot.position);

    // Place bag permanently on porch
    if (bagModel) {
      const placedBag = bagModel.clone();
      placedBag.position.copy(spot.position);
      placedBag.position.y += 0.21;
      this.scene.add(placedBag);
      this.deliveredBags.push(placedBag);
    }

    // Advance to next spot
    this.currentSpotIndex = (this.currentSpotIndex + 1) % this.spots.length;
    this.updateTargetSpot();

    return {
      score: this.score,
      deliveredCount: this.deliveredCount,
      nextSpot: this.getCurrentSpot()
    };
  }

  update(dt, playerPos) {
    // Animate arrow and pulse ring
    const time = performance.now() * 0.003;
    if (this.bounceArrow) {
      this.bounceArrow.position.y = 3.2 + Math.sin(time * 2.5) * 0.5;
      this.bounceArrow.rotation.y += 2.0 * dt;
    }
    if (this.pulseRing) {
      const scale = 1.0 + Math.sin(time * 3) * 0.25;
      this.pulseRing.scale.set(scale, scale, 1);
    }

    // Update confetti
    if (this.confettiParticles.length > 0) {
      const posArr = this.confettiMesh.geometry.attributes.position.array;
      for (let i = 0; i < this.confettiParticles.length; i++) {
        const p = this.confettiParticles[i];
        p.life += dt;
        p.vy -= 9.8 * dt; // gravity
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;

        posArr[i * 3] = p.x;
        posArr[i * 3 + 1] = p.y;
        posArr[i * 3 + 2] = p.z;
      }
      this.confettiMesh.geometry.attributes.position.needsUpdate = true;

      // Filter dead
      this.confettiParticles = this.confettiParticles.filter(p => p.life < p.maxLife);
      if (this.confettiParticles.length === 0) {
        for (let i = 0; i < posArr.length; i += 3) posArr[i + 1] = -999;
        this.confettiMesh.geometry.attributes.position.needsUpdate = true;
      }
    }
  }
}
