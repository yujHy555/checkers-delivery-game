import * as THREE from 'three';

export class ArcadeVehicle {
  constructor(scene, options = {}) {
    this.scene = scene;

    // Dimensions
    this.length = 3.4;
    this.width = 1.5;
    this.height = 1.9;
    this.wheelRadius = 0.35;
    this.rideHeight = 0.38;

    // Position & Orientation
    this.position = new THREE.Vector3(options.x || 0, this.rideHeight, options.z || -40);
    this.velocity = new THREE.Vector3();
    this.heading = options.heading || 0;
    this.pitch = 0;
    this.angularVelocity = 0;
    this.speed = 0; // forward speed in m/s

    // Dynamic Suspension & Lean
    this.visualRoll = 0;
    this.visualPitch = 0;
    this.suspensionCompress = 0;

    // Driving Parameters
    this.maxSpeed = 38.0;
    this.reverseMaxSpeed = 14.0;
    this.accelRate = 34.0;
    this.brakeRate = 48.0;
    this.dragCoeff = 0.985;

    // Steering
    this.steerInput = 0;
    this.steerAngle = 0;
    this.maxSteerAngle = THREE.MathUtils.degToRad(33);
    this.steerResponse = 12.0;

    // Grip & Drift
    this.isDrifting = false;
    this.isBrakingHard = false;
    this.driftFactor = 0;
    this.lateralVelocity = 0;
    this.slipSpeed = 0;

    // Jump & Air
    this.isAirborne = false;
    this.airTime = 0;
    this.gravity = 22.0; // Realistic arc gravity

    // World Colliders
    this.colliders = [];

    // 1. Skid marks system
    this.initSkidmarks();

    // 2. Tire smoke particles
    this.initTireSmoke();

    // 3. Ground Contact Shadow (Roots vehicle to ground visually!)
    this.initContactShadow();
  }

  setColliders(colliders) {
    this.colliders = colliders || [];
  }

  initContactShadow() {
    // Generate Soft Rounded-Rect Ambient Occlusion Shadow Texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Multi-layer gaussian blur shadow
    ctx.clearRect(0, 0, 256, 256);
    
    // Core dark contact patch
    const grad = ctx.createRadialGradient(128, 128, 40, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.88)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.12)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(24, 16, 208, 224, 48);
    ctx.fill();

    const shadowTex = new THREE.CanvasTexture(canvas);
    const shadowGeo = new THREE.PlaneGeometry(2.2, 3.8);
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.82,
      depthWrite: false
    });

    this.shadowMesh = new THREE.Mesh(shadowGeo, this.shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = 0.02;
    this.scene.add(this.shadowMesh);
  }

  initSkidmarks() {
    this.maxSkidPoints = 800;
    this.skidGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxSkidPoints * 6);
    this.skidGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.skidMaterial = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.skidMesh = new THREE.Mesh(this.skidGeometry, this.skidMaterial);
    this.skidMesh.frustumCulled = false;
    this.scene.add(this.skidMesh);

    this.skidHistoryL = [];
    this.skidHistoryR = [];
  }

  initTireSmoke() {
    this.smokeParticles = [];
    this.maxSmoke = 45;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(235, 235, 235, 0.75)');
    grad.addColorStop(0.4, 'rgba(200, 200, 200, 0.35)');
    grad.addColorStop(1, 'rgba(200, 200, 200, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const smokeTex = new THREE.CanvasTexture(canvas);
    const smokeGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(this.maxSmoke * 3);
    const sizes = new Float32Array(this.maxSmoke);

    smokeGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    smokeGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    this.smokeMaterial = new THREE.PointsMaterial({
      map: smokeTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      size: 1.1
    });

    this.smokeMesh = new THREE.Points(smokeGeo, this.smokeMaterial);
    this.scene.add(this.smokeMesh);
  }

  spawnSmoke(pos) {
    if (this.smokeParticles.length >= this.maxSmoke) {
      this.smokeParticles.shift();
    }
    this.smokeParticles.push({
      x: pos.x + (Math.random() - 0.5) * 0.2,
      y: pos.y + 0.12,
      z: pos.z + (Math.random() - 0.5) * 0.2,
      vx: (Math.random() - 0.5) * 0.5,
      vy: 0.5 + Math.random() * 0.7,
      vz: (Math.random() - 0.5) * 0.5,
      size: 0.35,
      maxSize: 1.6,
      life: 0,
      maxLife: 0.6 + Math.random() * 0.3
    });
  }

  update(dt, input) {
    if (dt > 0.08) dt = 0.08;

    // 1. DIRECTION VECTORS
    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const right = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));

    // 2. STEERING INPUT
    this.steerInput = THREE.MathUtils.lerp(this.steerInput, input.steer, this.steerResponse * dt);
    this.steerAngle = this.steerInput * this.maxSteerAngle;

    // Current forward & lateral speeds
    this.speed = this.velocity.dot(forward);
    this.lateralVelocity = this.velocity.dot(right);
    this.slipSpeed = Math.abs(this.lateralVelocity);

    // Hard braking state
    this.isBrakingHard = input.brake > 0.35 && Math.abs(this.speed) > 2.5;

    // 3. GROUND / RAMP SAMPLING
    const groundInfo = this.sampleGround(this.position.x, this.position.z);
    const targetGroundY = groundInfo.height + this.rideHeight;

    if (this.position.y <= targetGroundY + 0.18) {
      // VEHICLE IS ON GROUND OR DRIVING ON A RAMP
      if (this.isAirborne) {
        this.isAirborne = false;
        this.airTime = 0;
        this.suspensionCompress = 0.16;
        if (this.velocity.y < -3.5 && window.gameApp && window.gameApp.audio) {
          window.gameApp.audio.playJumpLand();
        }
      }

      this.position.y = targetGroundY;

      // Incline pitch on ramp
      this.pitch = THREE.MathUtils.lerp(this.pitch, groundInfo.pitch, 16.0 * dt);

      // If driving on a ramp, vehicle gains upward vertical velocity!
      if (groundInfo.isOnRamp && this.speed > 1.0) {
        this.velocity.y = Math.sin(groundInfo.pitch) * this.speed;
      } else {
        this.velocity.y = 0;
      }

      // Aerodynamic downforce at speed
      const downforce = (Math.abs(this.speed) / this.maxSpeed) * 8.0;
      this.velocity.y -= downforce * dt;

    } else {
      // VEHICLE IS AIRBORNE (JUMPING OFF RAMP)
      this.isAirborne = true;
      this.airTime += dt;
      this.velocity.y -= this.gravity * dt;

      // Gradually level pitch in air
      this.pitch = THREE.MathUtils.lerp(this.pitch, 0, 3.5 * dt);
    }

    // 4. ACCELERATION & BRAKING (When on ground)
    if (!this.isAirborne) {
      if (input.throttle > 0) {
        if (this.speed < this.maxSpeed) {
          const accel = input.throttle * this.accelRate;
          this.velocity.addScaledVector(forward, accel * dt);
        }
      } else if (input.brake > 0) {
        if (this.speed > 0.8) {
          // Strong brake deceleration
          const brake = input.brake * this.brakeRate;
          this.velocity.addScaledVector(forward, -brake * dt);
        } else {
          // Reverse
          if (this.speed > -this.reverseMaxSpeed) {
            this.velocity.addScaledVector(forward, -input.brake * (this.accelRate * 0.6) * dt);
          }
        }
      } else {
        // Natural rolling friction
        this.velocity.multiplyScalar(Math.pow(this.dragCoeff, dt * 60.0));
      }

      // 5. DRIFT & TRACTION
      if (input.handbrake) {
        this.isDrifting = true;
        this.driftFactor = THREE.MathUtils.lerp(this.driftFactor, 1.0, 12.0 * dt);
        this.velocity.multiplyScalar(Math.pow(0.96, dt * 30.0));
      } else {
        this.driftFactor = THREE.MathUtils.lerp(this.driftFactor, 0.0, 6.0 * dt);
        if (this.driftFactor < 0.08) this.isDrifting = false;
      }

      // Lateral Grip (high grip keeps vehicle grounded, drift allows controlled slides)
      const gripRate = THREE.MathUtils.lerp(35.0, 5.5, this.driftFactor);
      const lateralDecel = -this.lateralVelocity * Math.min(1.0, gripRate * dt);
      this.velocity.addScaledVector(right, lateralDecel);

      // 6. STEERING & YAW
      let speedFactor = Math.abs(this.speed) / 12.0;
      if (speedFactor > 1.0) speedFactor = 1.0;
      if (speedFactor < 0.2) speedFactor = Math.abs(this.speed) * 0.8;

      const dirSign = this.speed >= -0.2 ? 1 : -1;
      const driftBonus = this.isDrifting ? 1.75 : 1.0;

      // Heading rotation
      const targetYawRate = this.steerInput * speedFactor * dirSign * 2.6 * driftBonus;
      this.angularVelocity = THREE.MathUtils.lerp(this.angularVelocity, targetYawRate, 14.0 * dt);
      this.heading += this.angularVelocity * dt;

    } else {
      // In air: slight gyroscopic steering
      this.heading += this.steerInput * 0.5 * dt;
    }

    // 7. INTEGRATE POSITION
    this.position.addScaledVector(this.velocity, dt);

    // 8. OBSTACLE COLLISIONS
    this.resolveCollisions();

    // 9. VISUAL CHASSIS LEAN (Subtle & grounded)
    const targetRoll = THREE.MathUtils.clamp(-this.angularVelocity * (this.speed * 0.016), -0.05, 0.05);
    const targetPitch = THREE.MathUtils.clamp(
      this.pitch - (input.throttle - input.brake) * 0.035,
      -0.45,
      0.45
    );

    this.visualRoll = THREE.MathUtils.lerp(this.visualRoll, targetRoll, 10.0 * dt);
    this.visualPitch = THREE.MathUtils.lerp(this.visualPitch, targetPitch, 12.0 * dt);
    this.suspensionCompress = THREE.MathUtils.lerp(this.suspensionCompress, 0, 8.0 * dt);

    // 10. UPDATE CONTACT SHADOW
    this.updateContactShadow(groundInfo.height);

    // 11. UPDATE ACCURATE SKID MARKS & SMOKE
    this.updateSkidsAndSmoke(dt, forward, right);
  }

  sampleGround(x, z) {
    let maxHeight = 0;
    let pitch = 0;
    let isOnRamp = false;

    for (const c of this.colliders) {
      if (c.type === 'ramp') {
        // Transform vehicle position into ramp's local 2D coordinate space
        const cosA = Math.cos(-c.angleY);
        const sinA = Math.sin(-c.angleY);
        const localX = (x - c.x) * cosA - (z - c.z) * sinA;
        const localZ = (x - c.x) * sinA + (z - c.z) * cosA;

        const hw = c.width / 2;
        const hd = c.depth / 2;

        // In ramp space: entrance is at localZ = -hd (height 0), top lip is at localZ = +hd (height c.height)
        if (Math.abs(localX) <= hw && localZ >= -hd && localZ <= hd) {
          const progress = (localZ + hd) / c.depth; // 0 to 1
          const h = progress * c.height;

          if (h > maxHeight) {
            maxHeight = h;
            pitch = Math.atan2(c.height, c.depth);
            isOnRamp = true;
          }
        }
      }
    }

    return { height: maxHeight, pitch, isOnRamp };
  }

  resolveCollisions() {
    const carRadius = 1.15;

    for (const c of this.colliders) {
      if (c.type === 'box') {
        const halfX = c.width / 2;
        const halfZ = c.depth / 2;

        const closestX = THREE.MathUtils.clamp(this.position.x, c.x - halfX, c.x + halfX);
        const closestZ = THREE.MathUtils.clamp(this.position.z, c.z - halfZ, c.z + halfZ);

        const distX = this.position.x - closestX;
        const distZ = this.position.z - closestZ;
        const distSq = distX * distX + distZ * distZ;

        if (distSq < carRadius * carRadius && distSq > 0.00001) {
          const dist = Math.sqrt(distSq);
          const overlap = carRadius - dist;
          const normalX = distX / dist;
          const normalZ = distZ / dist;

          this.position.x += normalX * overlap;
          this.position.z += normalZ * overlap;

          const dot = this.velocity.x * normalX + this.velocity.z * normalZ;
          if (dot < 0) {
            this.velocity.x -= dot * normalX * 1.3;
            this.velocity.z -= dot * normalZ * 1.3;
            this.velocity.multiplyScalar(0.75);
          }
        }
      } else if (c.type === 'ramp') {
        // If hitting the back wall of the ramp from behind
        const cosA = Math.cos(-c.angleY);
        const sinA = Math.sin(-c.angleY);
        const localX = (this.position.x - c.x) * cosA - (this.position.z - c.z) * sinA;
        const localZ = (this.position.x - c.x) * sinA + (this.position.z - c.z) * cosA;

        const hw = c.width / 2;
        const hd = c.depth / 2;

        // Check if hitting the tall back face from behind at low height
        if (Math.abs(localX) <= hw && localZ > hd && localZ < hd + 0.8 && this.position.y < c.height) {
          this.position.z -= 0.2;
          this.velocity.multiplyScalar(0.5);
        }
      }
    }
  }

  updateContactShadow(groundHeight) {
    if (!this.shadowMesh) return;

    // Contact shadow sits right on road surface underneath the car
    this.shadowMesh.position.x = this.position.x;
    this.shadowMesh.position.z = this.position.z;
    this.shadowMesh.position.y = groundHeight + 0.02;
    this.shadowMesh.rotation.z = -this.heading;

    // Height above ground
    const heightAbove = Math.max(0, this.position.y - this.rideHeight - groundHeight);

    // Fade and scale when jumping into air
    const opacity = THREE.MathUtils.clamp(0.82 - heightAbove * 0.22, 0.15, 0.82);
    const scale = 1.0 + Math.min(0.6, heightAbove * 0.12);

    this.shadowMat.opacity = opacity;
    this.shadowMesh.scale.set(scale, scale, 1);
  }

  updateSkidsAndSmoke(dt, forward, right) {
    // Skid conditions:
    // 1. Drifting / Handbrake
    // 2. High lateral slip
    // 3. HARD BRAKING (Leaves clear parallel tire marks!)
    const isBrakingSkid = this.isBrakingHard && !this.isAirborne;
    const isDriftSkid = !this.isAirborne && (this.isDrifting || this.slipSpeed > 3.0);
    const isSkidding = isBrakingSkid || isDriftSkid;

    // Left and Right tire ground contact positions
    const groundY = this.position.y - this.rideHeight + 0.02;

    const rlPos = this.position.clone()
      .addScaledVector(forward, -1.05)
      .addScaledVector(right, -0.65);
    rlPos.y = groundY;

    const rrPos = this.position.clone()
      .addScaledVector(forward, -1.05)
      .addScaledVector(right, 0.65);
    rrPos.y = groundY;

    if (isSkidding) {
      if (isDriftSkid) {
        this.spawnSmoke(rlPos);
        this.spawnSmoke(rrPos);
      }

      this.skidHistoryL.push(rlPos.x, rlPos.y, rlPos.z);
      this.skidHistoryR.push(rrPos.x, rrPos.y, rrPos.z);

      if (this.skidHistoryL.length > this.maxSkidPoints * 3) {
        this.skidHistoryL.splice(0, 3);
        this.skidHistoryR.splice(0, 3);
      }
      this.updateSkidGeometry();
    }

    // Update smoke points
    const posArr = this.smokeMesh.geometry.attributes.position.array;
    const sizeArr = this.smokeMesh.geometry.attributes.size.array;
    let idx = 0;

    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.smokeParticles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.size = THREE.MathUtils.lerp(p.size, p.maxSize, 3.0 * dt);

      posArr[idx * 3] = p.x;
      posArr[idx * 3 + 1] = p.y;
      posArr[idx * 3 + 2] = p.z;
      sizeArr[idx] = p.size;
      idx++;
    }

    for (let i = idx; i < this.maxSmoke; i++) {
      posArr[i * 3 + 1] = -999;
      sizeArr[i] = 0;
    }

    this.smokeMesh.geometry.attributes.position.needsUpdate = true;
    this.smokeMesh.geometry.attributes.size.needsUpdate = true;
  }

  updateSkidGeometry() {
    const count = Math.floor(this.skidHistoryL.length / 3);
    if (count < 2) return;

    const positions = this.skidGeometry.attributes.position.array;
    let pIdx = 0;
    const w = 0.14; // tire track width

    for (let i = 0; i < count - 1; i++) {
      const i3 = i * 3;
      const ni3 = (i + 1) * 3;

      const lx1 = this.skidHistoryL[i3], ly1 = this.skidHistoryL[i3 + 1], lz1 = this.skidHistoryL[i3 + 2];
      const lx2 = this.skidHistoryL[ni3], ly2 = this.skidHistoryL[ni3 + 1], lz2 = this.skidHistoryL[ni3 + 2];

      const rx1 = this.skidHistoryR[i3], ry1 = this.skidHistoryR[i3 + 1], rz1 = this.skidHistoryR[i3 + 2];
      const rx2 = this.skidHistoryR[ni3], ry2 = this.skidHistoryR[ni3 + 1], rz2 = this.skidHistoryR[ni3 + 2];

      // Left tire ribbon quad
      positions[pIdx++] = lx1 - w; positions[pIdx++] = ly1; positions[pIdx++] = lz1;
      positions[pIdx++] = lx1 + w; positions[pIdx++] = ly1; positions[pIdx++] = lz1;
      positions[pIdx++] = lx2 - w; positions[pIdx++] = ly2; positions[pIdx++] = lz2;

      positions[pIdx++] = lx1 + w; positions[pIdx++] = ly1; positions[pIdx++] = lz1;
      positions[pIdx++] = lx2 + w; positions[pIdx++] = ly2; positions[pIdx++] = lz2;
      positions[pIdx++] = lx2 - w; positions[pIdx++] = ly2; positions[pIdx++] = lz2;

      // Right tire ribbon quad
      positions[pIdx++] = rx1 - w; positions[pIdx++] = ry1; positions[pIdx++] = rz1;
      positions[pIdx++] = rx1 + w; positions[pIdx++] = ry1; positions[pIdx++] = rz1;
      positions[pIdx++] = rx2 - w; positions[pIdx++] = ry2; positions[pIdx++] = rz2;

      positions[pIdx++] = rx1 + w; positions[pIdx++] = ry1; positions[pIdx++] = rz1;
      positions[pIdx++] = rx2 + w; positions[pIdx++] = ry2; positions[pIdx++] = rz2;
      positions[pIdx++] = rx2 - w; positions[pIdx++] = ry2; positions[pIdx++] = rz2;
    }

    this.skidGeometry.attributes.position.needsUpdate = true;
    this.skidGeometry.setDrawRange(0, pIdx / 3);
  }

  reset(x = 0, z = -40, heading = 0) {
    this.position.set(x, this.rideHeight, z);
    this.velocity.set(0, 0, 0);
    this.heading = heading;
    this.pitch = 0;
    this.angularVelocity = 0;
    this.speed = 0;
    this.visualRoll = 0;
    this.visualPitch = 0;
    this.steerInput = 0;
    this.steerAngle = 0;
    this.isDrifting = false;
    this.isAirborne = false;
  }
}
