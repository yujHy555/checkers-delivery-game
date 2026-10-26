import * as THREE from 'three';

export class ArcadeVehicle {
  constructor(scene, options = {}) {
    this.scene = scene;

    // Vehicle Dimensions (Kei Van scale)
    this.length = 3.4;
    this.width = 1.5;
    this.height = 1.9;
    this.wheelRadius = 0.35;
    this.rideHeight = 0.38; // Planted ground clearance

    // Position & Orientation
    this.position = new THREE.Vector3(options.x || 0, this.rideHeight, options.z || -35);
    this.velocity = new THREE.Vector3();
    this.heading = options.heading || 0; // Yaw angle in radians
    this.pitch = 0; // Slope pitch (ramps/jumps)
    this.angularVelocity = 0;
    this.speed = 0; // forward speed (m/s)

    // Visual Suspension Lean (Stiff anti-roll bar)
    this.visualRoll = 0;
    this.visualPitch = 0;
    this.suspensionCompress = 0;

    // Arcade Driving Parameters
    this.maxSpeed = 36.0; // ~130 km/h
    this.reverseMaxSpeed = 12.0;
    this.accelRate = 32.0; // Snappy arcade acceleration
    this.brakeRate = 48.0; // Strong brakes
    this.dragCoeff = 0.985; // Rolling drag

    // Steering
    this.steerInput = 0;
    this.steerAngle = 0;
    this.maxSteerAngle = THREE.MathUtils.degToRad(32);
    this.steerResponse = 12.0;

    // Grip & Drift
    this.isDrifting = false;
    this.driftFactor = 0; // 0 = 100% grip, 1 = drift slide
    this.lateralVelocity = 0;
    this.slipSpeed = 0;

    // Airborne / Jump State
    this.isAirborne = false;
    this.airTime = 0;
    this.gravity = 28.0; // Snappy arcade gravity (no floatiness)

    // Colliders (buildings, ramps, barriers)
    this.colliders = [];

    // Skid marks & smoke
    this.initSkidmarks();
    this.initTireSmoke();
  }

  setColliders(colliders) {
    this.colliders = colliders || [];
  }

  initSkidmarks() {
    this.maxSkidPoints = 600;
    this.skidGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxSkidPoints * 6);
    this.skidGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.skidMaterial = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.75,
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
    this.maxSmoke = 50;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(240, 240, 240, 0.8)');
    grad.addColorStop(0.4, 'rgba(210, 210, 210, 0.4)');
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
      opacity: 0.55,
      depthWrite: false,
      size: 1.2
    });

    this.smokeMesh = new THREE.Points(smokeGeo, this.smokeMaterial);
    this.scene.add(this.smokeMesh);
  }

  spawnSmoke(pos) {
    if (this.smokeParticles.length >= this.maxSmoke) {
      this.smokeParticles.shift();
    }
    this.smokeParticles.push({
      x: pos.x + (Math.random() - 0.5) * 0.25,
      y: pos.y + 0.15,
      z: pos.z + (Math.random() - 0.5) * 0.25,
      vx: (Math.random() - 0.5) * 0.6,
      vy: 0.6 + Math.random() * 0.7,
      vz: (Math.random() - 0.5) * 0.6,
      size: 0.4,
      maxSize: 1.8,
      life: 0,
      maxLife: 0.65 + Math.random() * 0.3
    });
  }

  update(dt, input) {
    if (dt > 0.08) dt = 0.08;

    // 1. DIRECTION VECTORS
    // Heading: 0 = +Z (forward). In Three.js:
    // Forward = (sin(heading), 0, cos(heading))
    // Right = (cos(heading), 0, -sin(heading))
    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const right = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));

    // 2. STEERING INPUT (FIXED: Left is Left, Right is Right)
    // Note: input.steer is negative for Left, positive for Right
    // To turn Left (towards -X), heading must decrease (negative delta).
    // Therefore steerInput = input.steer is correct!
    this.steerInput = THREE.MathUtils.lerp(this.steerInput, input.steer, this.steerResponse * dt);
    this.steerAngle = this.steerInput * this.maxSteerAngle;

    // Forward and Lateral speeds
    this.speed = this.velocity.dot(forward);
    this.lateralVelocity = this.velocity.dot(right);
    this.slipSpeed = Math.abs(this.lateralVelocity);

    // 3. GROUND HEIGHT & RAMP COLLISION DETECTION
    const groundInfo = this.sampleGround(this.position.x, this.position.z);
    const targetGroundY = groundInfo.height + this.rideHeight;

    if (this.position.y <= targetGroundY + 0.15) {
      // VEHICLE IS FIRMLY ON GROUND
      if (this.isAirborne) {
        // Just landed from a jump!
        this.isAirborne = false;
        this.airTime = 0;
        this.suspensionCompress = 0.14; // firm visual landing compression
        if (this.velocity.y < -4.0 && window.gameApp && window.gameApp.audio) {
          window.gameApp.audio.playJumpLand();
        }
      }

      // Snapped firmly to ground (NO floating, NO bobbing)
      this.position.y = targetGroundY;
      this.velocity.y = 0;
      this.pitch = THREE.MathUtils.lerp(this.pitch, groundInfo.pitch, 14.0 * dt);

      // Downforce at speed
      const downforce = (Math.abs(this.speed) / this.maxSpeed) * 8.0;
      this.velocity.y -= downforce * dt;

    } else {
      // VEHICLE IS AIRBORNE (JUMPING)
      this.isAirborne = true;
      this.airTime += dt;
      this.velocity.y -= this.gravity * dt;

      // Air pitch stabilization (levels out smoothly in mid-air)
      this.pitch = THREE.MathUtils.lerp(this.pitch, 0, 3.5 * dt);
    }

    // 4. ACCELERATION & BRAKING (Grounded)
    if (!this.isAirborne) {
      if (input.throttle > 0) {
        // Drive forward
        if (this.speed < this.maxSpeed) {
          const accel = input.throttle * this.accelRate;
          this.velocity.addScaledVector(forward, accel * dt);
        }
      } else if (input.brake > 0) {
        if (this.speed > 0.8) {
          // Hard brake
          const brake = input.brake * this.brakeRate;
          this.velocity.addScaledVector(forward, -brake * dt);
        } else {
          // Reverse
          if (this.speed > -this.reverseMaxSpeed) {
            this.velocity.addScaledVector(forward, -input.brake * (this.accelRate * 0.6) * dt);
          }
        }
      } else {
        // Rolling drag (grounded deceleration)
        this.velocity.multiplyScalar(Math.pow(this.dragCoeff, dt * 60.0));
      }

      // 5. DRIFT & TRACTION HANDLING
      if (input.handbrake) {
        // Handbrake pressed -> Initiates power slide
        this.isDrifting = true;
        this.driftFactor = THREE.MathUtils.lerp(this.driftFactor, 1.0, 12.0 * dt);
        // Slight forward drag during drift
        this.velocity.multiplyScalar(Math.pow(0.96, dt * 30.0));
      } else {
        // Handbrake released -> Grip snaps back
        this.driftFactor = THREE.MathUtils.lerp(this.driftFactor, 0.0, 6.0 * dt);
        if (this.driftFactor < 0.08) this.isDrifting = false;
      }

      // Lateral Friction (High grip when normal, controllable slip when drifting)
      // Normal grip kills 96% lateral slip per frame for rock-solid grounded feel!
      const gripRate = THREE.MathUtils.lerp(35.0, 5.5, this.driftFactor);
      const lateralDecel = -this.lateralVelocity * Math.min(1.0, gripRate * dt);
      this.velocity.addScaledVector(right, lateralDecel);

      // 6. STEERING & YAW (Sharp, intuitive turning)
      // Turn responsiveness scales with forward speed
      let speedFactor = Math.abs(this.speed) / 12.0;
      if (speedFactor > 1.0) speedFactor = 1.0;
      if (speedFactor < 0.2) speedFactor = Math.abs(this.speed) * 0.8; // sluggish when stopped

      // Reverse inverts steer direction naturally
      const dirSign = this.speed >= -0.2 ? 1 : -1;

      // Drift increases yaw spin for thrilling arcade power slides
      const driftBonus = this.isDrifting ? 1.75 : 1.0;

      const targetYawRate = this.steerInput * speedFactor * dirSign * 2.6 * driftBonus;
      this.angularVelocity = THREE.MathUtils.lerp(this.angularVelocity, targetYawRate, 14.0 * dt);

      // Apply Heading update
      this.heading += this.angularVelocity * dt;

    } else {
      // In air: slight pitch & yaw stability
      this.heading += this.steerInput * 0.6 * dt;
    }

    // 7. INTEGRATE POSITION
    this.position.addScaledVector(this.velocity, dt);

    // 8. WORLD OBSTACLE COLLISIONS
    this.resolveCollisions();

    // 9. VISUAL CHASSIS LEAN (Subtle & stiff - NO boat sway)
    const targetRoll = THREE.MathUtils.clamp(-this.angularVelocity * (this.speed * 0.018), -0.05, 0.05);
    const targetPitch = THREE.MathUtils.clamp(
      this.pitch - (input.throttle - input.brake) * 0.035,
      -0.45,
      0.45
    );

    this.visualRoll = THREE.MathUtils.lerp(this.visualRoll, targetRoll, 10.0 * dt);
    this.visualPitch = THREE.MathUtils.lerp(this.visualPitch, targetPitch, 12.0 * dt);
    this.suspensionCompress = THREE.MathUtils.lerp(this.suspensionCompress, 0, 8.0 * dt);

    // 10. UPDATE SKID MARKS & TIRE SMOKE
    this.updateSkidsAndSmoke(dt, forward, right);
  }

  sampleGround(x, z) {
    let maxHeight = 0;
    let pitch = 0;

    for (const c of this.colliders) {
      if (c.type === 'ramp') {
        // Ramp AABB check
        const dx = x - c.x;
        const dz = z - c.z;

        // Check if vehicle is within ramp footprint
        if (Math.abs(dx) <= c.width / 2 && Math.abs(dz) <= c.depth / 2) {
          // Ramp goes from -c.depth/2 (bottom) to +c.depth/2 (top) if angleY = 0
          // Normalized progress along ramp
          let progress = 0;
          if (c.angleY === 0) {
            // Slanted from south (-z) to north (+z)
            progress = (dz + c.depth / 2) / c.depth;
          } else if (c.angleY === Math.PI) {
            // Slanted from north (+z) to south (-z)
            progress = (c.depth / 2 - dz) / c.depth;
          } else if (c.angleY === Math.PI / 2) {
            // Slanted from west (-x) to east (+x)
            progress = (dx + c.width / 2) / c.width;
          } else if (c.angleY === -Math.PI / 2) {
            // Slanted from east (+x) to west (-x)
            progress = (c.width / 2 - dx) / c.width;
          } else {
            progress = (dz + c.depth / 2) / c.depth;
          }

          progress = THREE.MathUtils.clamp(progress, 0, 1);
          const h = progress * c.height;

          if (h > maxHeight) {
            maxHeight = h;
            // Ramp incline pitch angle
            pitch = Math.atan2(c.height, c.depth);
          }
        }
      }
    }

    return { height: maxHeight, pitch };
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

          // Push car out of obstacle
          this.position.x += normalX * overlap;
          this.position.z += normalZ * overlap;

          // Bounce impulse
          const dot = this.velocity.x * normalX + this.velocity.z * normalZ;
          if (dot < 0) {
            this.velocity.x -= dot * normalX * 1.3;
            this.velocity.z -= dot * normalZ * 1.3;
            this.velocity.multiplyScalar(0.75); // absorb speed
          }
        }
      }
    }
  }

  updateSkidsAndSmoke(dt, forward, right) {
    const isSkidding = !this.isAirborne && (this.isDrifting || this.slipSpeed > 3.8);

    // Tire contact points
    const rlPos = this.position.clone()
      .addScaledVector(forward, -1.05)
      .addScaledVector(right, -0.65);
    rlPos.y = this.position.y - this.rideHeight + 0.02;

    const rrPos = this.position.clone()
      .addScaledVector(forward, -1.05)
      .addScaledVector(right, 0.65);
    rrPos.y = this.position.y - this.rideHeight + 0.02;

    if (isSkidding) {
      this.spawnSmoke(rlPos);
      this.spawnSmoke(rrPos);

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
    const w = 0.14; // tire width

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

  reset(x = 0, z = -35, heading = 0) {
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
