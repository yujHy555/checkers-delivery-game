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
    this.wheelBaseHalf = 1.05; // front & rear axle offset

    // Position & Orientation
    this.position = new THREE.Vector3(options.x || 0, this.rideHeight, options.z || -40);
    this.velocity = new THREE.Vector3();
    this.heading = options.heading || 0;
    this.pitch = 0;
    this.angularVelocity = 0;
    this.speed = 0; // forward speed in m/s

    // Dynamic Suspension & Visual Lean
    this.visualRoll = 0;
    this.visualPitch = 0;
    this.suspensionCompress = 0;

    // Arcade Driving Parameters (High Maneuverability & Punch)
    this.maxSpeed = 38.0; // ~137 km/h
    this.reverseMaxSpeed = 14.0;
    this.accelRate = 36.0; // Snappy, punchy acceleration
    this.brakeRate = 55.0; // Strong responsive brakes
    this.dragCoeff = 0.982; // Natural rolling resistance

    // Steering
    this.steerInput = 0;
    this.steerAngle = 0;
    this.maxSteerAngle = THREE.MathUtils.degToRad(35);
    this.steerResponse = 16.0; // Instant sharp steering

    // Grip & Drift
    this.isDrifting = false;
    this.isBrakingHard = false;
    this.driftFactor = 0;
    this.lateralVelocity = 0;
    this.slipSpeed = 0;

    // Jump & Air
    this.isAirborne = false;
    this.airTime = 0;
    this.gravity = 24.0;

    // Ramp state
    this.wasOnRamp = false;
    this.lastRampPitch = 0;

    // World Colliders
    this.colliders = [];

    // Skid marks system (accurate tire ribbons)
    this.initSkidmarks();

    // Tire smoke particles
    this.initTireSmoke();
  }

  setColliders(colliders) {
    this.colliders = colliders || [];
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

    // Forward and Lateral speeds
    this.speed = this.velocity.dot(forward);
    this.lateralVelocity = this.velocity.dot(right);
    this.slipSpeed = Math.abs(this.lateralVelocity);

    // Hard braking detection
    this.isBrakingHard = input.brake > 0.35 && Math.abs(this.speed) > 2.5;

    // 3. TWO-POINT AXLE GROUND & RAMP SAMPLING (Front Axle & Rear Axle)
    const frontPos = this.position.clone().addScaledVector(forward, this.wheelBaseHalf);
    const rearPos = this.position.clone().addScaledVector(forward, -this.wheelBaseHalf);

    const frontGround = this.samplePointGround(frontPos.x, frontPos.z);
    const rearGround = this.samplePointGround(rearPos.x, rearPos.z);
    const centerGround = this.samplePointGround(this.position.x, this.position.z);

    // Maximum ground elevation underneath car footprint
    const groundElevation = Math.max(
      centerGround.height,
      (frontGround.height + rearGround.height) / 2
    );

    const targetGroundY = groundElevation + this.rideHeight;
    const isOnRamp = frontGround.isOnRamp || rearGround.isOnRamp || centerGround.isOnRamp;

    // Compute ground slope pitch from front and rear axle heights
    const targetGroundPitch = Math.atan2(frontGround.height - rearGround.height, this.wheelBaseHalf * 2);

    // 4. VERTICAL GROUND & RAMP DYNAMICS
    if (this.position.y <= targetGroundY + 0.15) {
      // VEHICLE IS ON GROUND OR ON A RAMP
      if (this.isAirborne) {
        this.isAirborne = false;
        this.airTime = 0;
        this.suspensionCompress = 0.18;
        if (this.velocity.y < -3.5 && window.gameApp && window.gameApp.audio) {
          window.gameApp.audio.playJumpLand();
        }
      }

      // Hard clamp so vehicle can NEVER sink or go through ramps!
      this.position.y = Math.max(targetGroundY, this.position.y);
      this.pitch = THREE.MathUtils.lerp(this.pitch, targetGroundPitch, 18.0 * dt);

      if (isOnRamp) {
        this.wasOnRamp = true;
        this.lastRampPitch = Math.max(targetGroundPitch, 0.28);
        // Vertical velocity while driving up the ramp
        if (this.speed > 1.0) {
          this.velocity.y = Math.sin(this.lastRampPitch) * this.speed;
        } else {
          this.velocity.y = 0;
        }
      } else {
        // Just left the ramp at high speed -> LAUNCH INTO AIR!
        if (this.wasOnRamp && this.speed > 4.0 && !frontGround.isOnRamp && !rearGround.isOnRamp) {
          this.isAirborne = true;
          // Launch upward impulse!
          this.velocity.y = Math.sin(this.lastRampPitch) * this.speed * 1.25;
          this.wasOnRamp = false;
        } else {
          this.wasOnRamp = false;
          this.velocity.y = 0;
        }
      }

      // Downforce keeping car planted at speed
      const downforce = (Math.abs(this.speed) / this.maxSpeed) * 10.0;
      this.velocity.y -= downforce * dt;

    } else {
      // VEHICLE IS AIRBORNE (JUMPING)
      this.isAirborne = true;
      this.airTime += dt;
      this.velocity.y -= this.gravity * dt;

      // Ensure vehicle does not penetrate any ramp below it while airborne
      if (this.position.y < targetGroundY) {
        this.position.y = targetGroundY;
        this.velocity.y = 0;
        this.isAirborne = false;
      }

      // Smoothly level pitch while airborne
      this.pitch = THREE.MathUtils.lerp(this.pitch, 0, 3.0 * dt);
    }

    // 5. ACCELERATION & BRAKING (When on ground)
    if (!this.isAirborne) {
      if (input.throttle > 0) {
        if (this.speed < this.maxSpeed) {
          const accel = input.throttle * this.accelRate;
          this.velocity.addScaledVector(forward, accel * dt);
        }
      } else if (input.brake > 0) {
        if (this.speed > 0.8) {
          // Sharp brake
          const brake = input.brake * this.brakeRate;
          this.velocity.addScaledVector(forward, -brake * dt);
        } else {
          // Reverse
          if (this.speed > -this.reverseMaxSpeed) {
            this.velocity.addScaledVector(forward, -input.brake * (this.accelRate * 0.65) * dt);
          }
        }
      } else {
        // Rolling drag
        this.velocity.multiplyScalar(Math.pow(this.dragCoeff, dt * 60.0));
      }

      // 6. DRIFT & TRACTION
      if (input.handbrake) {
        this.isDrifting = true;
        this.driftFactor = THREE.MathUtils.lerp(this.driftFactor, 1.0, 14.0 * dt);
        this.velocity.multiplyScalar(Math.pow(0.96, dt * 30.0));
      } else {
        this.driftFactor = THREE.MathUtils.lerp(this.driftFactor, 0.0, 7.0 * dt);
        if (this.driftFactor < 0.08) this.isDrifting = false;
      }

      // Lateral Grip (high grip keeps car tight and maneuverable, drift gives smooth power slides)
      const gripRate = THREE.MathUtils.lerp(38.0, 5.0, this.driftFactor);
      const lateralDecel = -this.lateralVelocity * Math.min(1.0, gripRate * dt);
      this.velocity.addScaledVector(right, lateralDecel);

      // 7. STEERING & YAW (NO ROTATION ON THE SPOT WHEN NOT MOVING!)
      // When speed < 0.4 m/s (stopped), speedFactor is STRICTLY 0!
      const absSpeed = Math.abs(this.speed);
      let speedFactor = 0;
      if (absSpeed > 0.4) {
        // High maneuverability: reaches full steering response by 6 m/s
        speedFactor = Math.min(1.0, (absSpeed - 0.4) / 5.5);
      }

      const dirSign = this.speed >= -0.2 ? 1 : -1;
      const driftBonus = this.isDrifting ? 1.8 : 1.0;

      // Yaw rotation (only when moving)
      const targetYawRate = this.steerInput * speedFactor * dirSign * 3.2 * driftBonus;
      this.angularVelocity = THREE.MathUtils.lerp(this.angularVelocity, targetYawRate, 16.0 * dt);
      this.heading += this.angularVelocity * dt;

    } else {
      // In air: slight gyroscopic stabilization
      this.heading += this.steerInput * 0.4 * dt;
    }

    // 8. INTEGRATE POSITION
    this.position.addScaledVector(this.velocity, dt);

    // 9. OBSTACLE COLLISIONS
    this.resolveCollisions();

    // 10. VISUAL CHASSIS LEAN (Subtle & grounded)
    const targetRoll = THREE.MathUtils.clamp(-this.angularVelocity * (this.speed * 0.015), -0.05, 0.05);
    const targetPitch = THREE.MathUtils.clamp(
      this.pitch - (input.throttle - input.brake) * 0.035,
      -0.45,
      0.45
    );

    this.visualRoll = THREE.MathUtils.lerp(this.visualRoll, targetRoll, 12.0 * dt);
    this.visualPitch = THREE.MathUtils.lerp(this.visualPitch, targetPitch, 14.0 * dt);
    this.suspensionCompress = THREE.MathUtils.lerp(this.suspensionCompress, 0, 8.0 * dt);

    // 11. UPDATE ACCURATE SKID MARKS & SMOKE
    this.updateSkidsAndSmoke(dt, forward, right);
  }

  samplePointGround(x, z) {
    let maxHeight = 0;
    let isOnRamp = false;

    for (const c of this.colliders) {
      if (c.type === 'ramp') {
        const cosA = Math.cos(-c.angleY);
        const sinA = Math.sin(-c.angleY);
        const localX = (x - c.x) * cosA - (z - c.z) * sinA;
        const localZ = (x - c.x) * sinA + (z - c.z) * cosA;

        const hw = c.width / 2;
        const hd = c.depth / 2;

        if (Math.abs(localX) <= hw && localZ >= -hd && localZ <= hd) {
          const progress = (localZ + hd) / c.depth; // 0 to 1
          const h = progress * c.height;

          if (h > maxHeight) {
            maxHeight = h;
            isOnRamp = true;
          }
        }
      }
    }

    return { height: maxHeight, isOnRamp };
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
            this.velocity.x -= dot * normalX * 1.35;
            this.velocity.z -= dot * normalZ * 1.35;
            this.velocity.multiplyScalar(0.75);
          }
        }
      } else if (c.type === 'ramp') {
        // Solid back and side wall collision for ramps
        const cosA = Math.cos(-c.angleY);
        const sinA = Math.sin(-c.angleY);
        const localX = (this.position.x - c.x) * cosA - (this.position.z - c.z) * sinA;
        const localZ = (this.position.x - c.x) * sinA + (this.position.z - c.z) * cosA;

        const hw = c.width / 2;
        const hd = c.depth / 2;

        // If approaching tall back wall from behind
        if (Math.abs(localX) <= hw + 0.4 && localZ > hd && localZ < hd + 1.2 && this.position.y < c.height + 0.2) {
          // Push out along ramp's rear normal
          const worldBackX = Math.sin(c.angleY);
          const worldBackZ = Math.cos(c.angleY);
          this.position.x += worldBackX * 0.3;
          this.position.z += worldBackZ * 0.3;
          this.velocity.multiplyScalar(0.4);
        }
      }
    }
  }

  updateSkidsAndSmoke(dt, forward, right) {
    const isBrakingSkid = this.isBrakingHard && !this.isAirborne;
    const isDriftSkid = !this.isAirborne && (this.isDrifting || this.slipSpeed > 3.0);
    const isSkidding = isBrakingSkid || isDriftSkid;

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

    // Smoke points
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

      // Left tire quad
      positions[pIdx++] = lx1 - w; positions[pIdx++] = ly1; positions[pIdx++] = lz1;
      positions[pIdx++] = lx1 + w; positions[pIdx++] = ly1; positions[pIdx++] = lz1;
      positions[pIdx++] = lx2 - w; positions[pIdx++] = ly2; positions[pIdx++] = lz2;

      positions[pIdx++] = lx1 + w; positions[pIdx++] = ly1; positions[pIdx++] = lz1;
      positions[pIdx++] = lx2 + w; positions[pIdx++] = ly2; positions[pIdx++] = lz2;
      positions[pIdx++] = lx2 - w; positions[pIdx++] = ly2; positions[pIdx++] = lz2;

      // Right tire quad
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
    this.wasOnRamp = false;
  }
}
