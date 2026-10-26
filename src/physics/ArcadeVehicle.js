import * as THREE from 'three';

export class ArcadeVehicle {
  constructor(scene, options = {}) {
    this.scene = scene;

    // Vehicle dimensions & physics properties (Kei van scale ~ 3.4m long, 1.48m wide, 1.95m tall)
    this.mass = 950;
    this.position = new THREE.Vector3(options.x || 0, options.y || 1.2, options.z || 0);
    this.velocity = new THREE.Vector3();
    this.heading = options.heading || 0; // Yaw angle in radians
    this.angularVelocity = 0;
    this.speed = 0; // forward speed in m/s

    // Pitch and Roll for dynamic body lean/suspension squat
    this.bodyPitch = 0;
    this.bodyRoll = 0;
    this.bodyPitchVel = 0;
    this.bodyRollVel = 0;

    // Driving parameters (Arcade tuning)
    this.maxSpeed = 38.0; // ~136 km/h max speed
    this.reverseMaxSpeed = 12.0;
    this.acceleration = 24.0; // Snappy arcade accel
    this.brakeForce = 45.0;
    this.steerAngle = 0;
    this.maxSteerAngle = THREE.MathUtils.degToRad(34);
    this.steerSpeed = 6.0;

    // Drift & Traction
    this.isDrifting = false;
    this.driftFactor = 0; // 0 (pure grip) to 1 (full slip)
    this.lateralFriction = 0.88;
    this.slipVelocity = 0;
    this.isAirborne = false;
    this.groundY = 0;

    // Suspension settings
    this.suspensionRestLength = 0.45;
    this.suspensionStiffness = 38.0;
    this.suspensionDamping = 4.5;
    this.wheelTravel = [0, 0, 0, 0]; // FL, FR, RL, RR

    // Wheels definition (relative to chassis center)
    this.wheelBaseHalf = 1.05; // front-back half
    this.wheelTrackHalf = 0.65; // left-right half
    this.wheelRadius = 0.35;

    // World collision bounds
    this.colliders = [];

    // Skid marks system
    this.initSkidmarks();

    // Tire smoke particles
    this.initTireSmoke();
  }

  setColliders(colliders) {
    this.colliders = colliders || [];
  }

  initSkidmarks() {
    this.maxSkidPoints = 500;
    this.skidGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxSkidPoints * 6); // 2 triangles per segment
    const alphas = new Float32Array(this.maxSkidPoints * 2);

    this.skidGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.skidMaterial = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });

    this.skidMesh = new THREE.Mesh(this.skidGeometry, this.skidMaterial);
    this.skidMesh.frustumCulled = false;
    this.scene.add(this.skidMesh);

    this.skidPointsLeft = [];
    this.skidPointsRight = [];
    this.lastSkidTime = 0;
  }

  initTireSmoke() {
    this.smokeParticles = [];
    this.maxSmoke = 45;
    const smokeGeo = new THREE.BufferGeometry();
    const smokePositions = new Float32Array(this.maxSmoke * 3);
    const smokeSizes = new Float32Array(this.maxSmoke);

    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
    smokeGeo.setAttribute('size', new THREE.BufferAttribute(smokeSizes, 1));

    // Simple procedural smoke particle texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(230,230,230,0.8)');
    grad.addColorStop(0.5, 'rgba(200,200,200,0.3)');
    grad.addColorStop(1, 'rgba(200,200,200,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const smokeTex = new THREE.CanvasTexture(canvas);
    this.smokeMaterial = new THREE.PointsMaterial({
      map: smokeTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      size: 1.0,
      blending: THREE.NormalBlending
    });

    this.smokeMesh = new THREE.Points(smokeGeo, this.smokeMaterial);
    this.scene.add(this.smokeMesh);
  }

  spawnSmoke(pos) {
    if (this.smokeParticles.length >= this.maxSmoke) {
      this.smokeParticles.shift();
    }
    this.smokeParticles.push({
      x: pos.x + (Math.random() - 0.5) * 0.3,
      y: pos.y + 0.1,
      z: pos.z + (Math.random() - 0.5) * 0.3,
      vx: (Math.random() - 0.5) * 0.5,
      vy: 0.8 + Math.random() * 0.8,
      vz: (Math.random() - 0.5) * 0.5,
      size: 0.35,
      maxSize: 1.6,
      life: 0,
      maxLife: 0.75 + Math.random() * 0.4
    });
  }

  update(dt, input) {
    if (dt > 0.1) dt = 0.1; // clamp delta time for stability

    // 1. Steering input
    const targetSteer = input.steer * this.maxSteerAngle;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, this.steerSpeed * dt);

    // Forward and Right direction vectors
    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const right = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));

    // Current forward & lateral speed
    this.speed = this.velocity.dot(forward);
    const lateralSpeed = this.velocity.dot(right);
    this.slipVelocity = Math.abs(lateralSpeed);

    // 2. Check Ground / Elevation
    const raycastY = this.sampleGroundHeight(this.position.x, this.position.z);
    const targetHeight = raycastY + this.wheelRadius + 0.15;

    if (this.position.y <= targetHeight + 0.05) {
      // On ground
      this.isAirborne = false;
      this.groundY = raycastY;

      // Suspension spring response
      const comp = targetHeight - this.position.y;
      this.velocity.y += (comp * this.suspensionStiffness - this.velocity.y * this.suspensionDamping) * dt;

      // Clamp ground sinking
      if (this.position.y < targetHeight - 0.12) {
        this.position.y = targetHeight - 0.12;
        if (this.velocity.y < 0) this.velocity.y = 0;
      }
    } else {
      // In air (Jump)
      this.isAirborne = true;
      this.velocity.y -= 18.0 * dt; // Gravity
    }

    // 3. Acceleration & Braking (When on ground)
    if (!this.isAirborne) {
      if (input.throttle > 0) {
        if (this.speed < this.maxSpeed) {
          this.velocity.addScaledVector(forward, input.throttle * this.acceleration * dt);
        }
      } else if (input.brake > 0) {
        if (this.speed > 0.5) {
          // Braking
          this.velocity.addScaledVector(forward, -input.brake * this.brakeForce * dt);
        } else {
          // Reverse
          if (this.speed > -this.reverseMaxSpeed) {
            this.velocity.addScaledVector(forward, -input.brake * (this.acceleration * 0.6) * dt);
          }
        }
      } else {
        // Natural rolling resistance
        this.velocity.multiplyScalar(Math.pow(0.85, dt * 2.0));
      }

      // Handbrake / Drift
      if (input.handbrake) {
        this.isDrifting = true;
        this.driftFactor = THREE.MathUtils.lerp(this.driftFactor, 1.0, 10.0 * dt);
        // Reduce forward speed slightly when drifting
        this.velocity.multiplyScalar(Math.pow(0.92, dt));
      } else {
        this.driftFactor = THREE.MathUtils.lerp(this.driftFactor, 0.0, 4.0 * dt);
        if (this.driftFactor < 0.05) this.isDrifting = false;
      }

      // Lateral Friction (Drift vs Grip)
      const baseGrip = 12.0;
      const driftGrip = 3.2;
      const currentGrip = THREE.MathUtils.lerp(baseGrip, driftGrip, this.driftFactor);
      
      // Kill lateral slide proportional to grip
      const lateralDecel = -lateralSpeed * currentGrip * dt;
      this.velocity.addScaledVector(right, lateralDecel);

      // Turning / Yaw angular velocity
      let turnFactor = (this.speed / 18.0);
      if (turnFactor > 1.0) turnFactor = 1.0;
      if (turnFactor < -0.8) turnFactor = -0.8;

      // Extra rotation when drifting (arcade snap-in)
      const driftTurnBonus = this.isDrifting ? 1.6 : 1.0;
      const targetAngularVel = this.steerAngle * turnFactor * (1.7 * driftTurnBonus);

      this.angularVelocity = THREE.MathUtils.lerp(this.angularVelocity, targetAngularVel, 8.0 * dt);
      this.heading += this.angularVelocity * dt;

    } else {
      // In air: slight air steering & pitch stabilization
      this.heading += this.steerAngle * 0.5 * dt;
    }

    // 4. Update Position
    this.position.addScaledVector(this.velocity, dt);

    // 5. World Obstacle Collisions
    this.handleCollisions();

    // 6. Body Roll & Pitch (Dynamic suspension tilt)
    const accelRate = (input.throttle - input.brake) * (this.acceleration / 24.0);
    const targetPitch = THREE.MathUtils.clamp(-accelRate * 0.04 - (this.velocity.y * 0.02), -0.15, 0.15);
    const targetRoll = THREE.MathUtils.clamp(-this.angularVelocity * (this.speed * 0.035), -0.14, 0.14);

    this.bodyPitch = THREE.MathUtils.lerp(this.bodyPitch, targetPitch, 8.0 * dt);
    this.bodyRoll = THREE.MathUtils.lerp(this.bodyRoll, targetRoll, 8.0 * dt);

    // 7. Skid marks & smoke generation
    this.updateSkidmarksAndSmoke(dt, right, forward);
  }

  sampleGroundHeight(x, z) {
    // Check for ramps or elevated surfaces
    let maxH = 0;
    for (const c of this.colliders) {
      if (c.type === 'ramp') {
        // Ramp check
        const dx = x - c.x;
        const dz = z - c.z;
        if (Math.abs(dx) <= c.width / 2 && Math.abs(dz) <= c.depth / 2) {
          const t = (dz + c.depth / 2) / c.depth; // 0 to 1 along ramp
          const rampH = c.baseY + t * c.height;
          if (rampH > maxH) maxH = rampH;
        }
      }
    }
    return maxH;
  }

  handleCollisions() {
    const vanRadius = 1.25;

    for (const c of this.colliders) {
      if (c.type === 'box') {
        // AABB / Circle collision
        const halfX = c.width / 2;
        const halfZ = c.depth / 2;

        const closestX = THREE.MathUtils.clamp(this.position.x, c.x - halfX, c.x + halfX);
        const closestZ = THREE.MathUtils.clamp(this.position.z, c.z - halfZ, c.z + halfZ);

        const distX = this.position.x - closestX;
        const distZ = this.position.z - closestZ;
        const distSq = distX * distX + distZ * distZ;

        if (distSq < vanRadius * vanRadius && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const overlap = vanRadius - dist;
          const normalX = distX / dist;
          const normalZ = distZ / dist;

          // Push out
          this.position.x += normalX * overlap;
          this.position.z += normalZ * overlap;

          // Velocity bounce & impulse
          const dot = this.velocity.x * normalX + this.velocity.z * normalZ;
          if (dot < 0) {
            this.velocity.x -= dot * normalX * 1.35;
            this.velocity.z -= dot * normalZ * 1.35;
            this.velocity.multiplyScalar(0.7); // lose speed on impact
          }
        }
      }
    }
  }

  updateSkidmarksAndSmoke(dt, right, forward) {
    const isSkidding = !this.isAirborne && (this.isDrifting || this.slipVelocity > 3.5 || (this.speed < 2.0 && Math.abs(this.velocity.length()) > 3.0));

    // Rear wheel contact points
    const rlPos = this.position.clone()
      .addScaledVector(forward, -this.wheelBaseHalf)
      .addScaledVector(right, -this.wheelTrackHalf);
    rlPos.y = this.groundY + 0.02;

    const rrPos = this.position.clone()
      .addScaledVector(forward, -this.wheelBaseHalf)
      .addScaledVector(right, this.wheelTrackHalf);
    rrPos.y = this.groundY + 0.02;

    if (isSkidding) {
      this.spawnSmoke(rlPos);
      this.spawnSmoke(rrPos);

      // Add skid mark vertices
      this.skidPointsLeft.push(rlPos.x, rlPos.y, rlPos.z);
      this.skidPointsRight.push(rrPos.x, rrPos.y, rrPos.z);

      if (this.skidPointsLeft.length > this.maxSkidPoints * 3) {
        this.skidPointsLeft.splice(0, 3);
        this.skidPointsRight.splice(0, 3);
      }
      this.updateSkidMesh();
    }

    // Update Smoke particles
    const positions = this.smokeMesh.geometry.attributes.position.array;
    const sizes = this.smokeMesh.geometry.attributes.size.array;
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
      p.size = THREE.MathUtils.lerp(p.size, p.maxSize, 2.5 * dt);

      positions[idx * 3] = p.x;
      positions[idx * 3 + 1] = p.y;
      positions[idx * 3 + 2] = p.z;
      sizes[idx] = p.size;
      idx++;
    }

    // Clear unused
    for (let i = idx; i < this.maxSmoke; i++) {
      positions[i * 3 + 1] = -999;
      sizes[i] = 0;
    }

    this.smokeMesh.geometry.attributes.position.needsUpdate = true;
    this.smokeMesh.geometry.attributes.size.needsUpdate = true;
  }

  updateSkidMesh() {
    const count = Math.floor(this.skidPointsLeft.length / 3);
    if (count < 2) return;

    const positions = this.skidMesh.geometry.attributes.position.array;
    let pIdx = 0;

    for (let i = 0; i < count - 1; i++) {
      const i3 = i * 3;
      const ni3 = (i + 1) * 3;

      const lx1 = this.skidPointsLeft[i3], ly1 = this.skidPointsLeft[i3 + 1], lz1 = this.skidPointsLeft[i3 + 2];
      const lx2 = this.skidPointsLeft[ni3], ly2 = this.skidPointsLeft[ni3 + 1], lz2 = this.skidPointsLeft[ni3 + 2];
      
      const rx1 = this.skidPointsRight[i3], ry1 = this.skidPointsRight[i3 + 1], rz1 = this.skidPointsRight[i3 + 2];
      const rx2 = this.skidPointsRight[ni3], ry2 = this.skidPointsRight[ni3 + 1], rz2 = this.skidPointsRight[ni3 + 2];

      const w = 0.12; // tire width
      // Triangle 1
      positions[pIdx++] = lx1 - w; positions[pIdx++] = ly1; positions[pIdx++] = lz1;
      positions[pIdx++] = lx1 + w; positions[pIdx++] = ly1; positions[pIdx++] = lz1;
      positions[pIdx++] = lx2 - w; positions[pIdx++] = ly2; positions[pIdx++] = lz2;

      // Triangle 2
      positions[pIdx++] = lx1 + w; positions[pIdx++] = ly1; positions[pIdx++] = lz1;
      positions[pIdx++] = lx2 + w; positions[pIdx++] = ly2; positions[pIdx++] = lz2;
      positions[pIdx++] = lx2 - w; positions[pIdx++] = ly2; positions[pIdx++] = lz2;
    }

    this.skidMesh.geometry.attributes.position.needsUpdate = true;
    this.skidMesh.geometry.setDrawRange(0, pIdx / 3);
  }

  reset(x = 0, z = 0, heading = 0) {
    this.position.set(x, 1.2, z);
    this.velocity.set(0, 0, 0);
    this.heading = heading;
    this.angularVelocity = 0;
    this.speed = 0;
    this.bodyPitch = 0;
    this.bodyRoll = 0;
    this.steerAngle = 0;
    this.isDrifting = false;
  }
}
