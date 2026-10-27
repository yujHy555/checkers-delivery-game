import * as THREE from 'three';

export class ArcadeVehicle {
  constructor(scene, options = {}) {
    this.scene = scene;

    // Dimensions
    this.length = 3.4;
    this.width = 1.5;
    this.height = 1.9;
    this.wheelRadius = 0.35;
    this.wheelBaseHalf = 1.05; // front & rear axle distance (2.1m wheelbase)
    this.trackHalfWidth = 0.68; // left & right wheel track distance (1.36m track)
    this.halfCarWidth = 0.75;

    // Road surface level is 0.015-0.02 above base plane. Bottom of tires sits on road at y = 0.025!
    this.roadLevel = 0.025;
    this.position = new THREE.Vector3(options.x || 0, this.roadLevel, options.z || -40);
    this.velocity = new THREE.Vector3();
    this.heading = options.heading || 0;
    this.angularVelocity = 0;
    this.speed = 0; // forward speed in m/s

    // Surface alignment (terrain pitch & roll)
    this.surfacePitch = 0;
    this.surfaceRoll = 0;

    // Dynamic Chassis Suspension Lean & Dive/Squat
    this.dynamicPitch = 0;
    this.dynamicRoll = 0;
    this.visualRoll = 0;
    this.visualPitch = 0;
    this.pitch = 0; // backward compat
    this.suspensionCompress = 0;

    // AAA Progressive Driving Parameters
    this.maxSpeed = 38.0; // ~137 km/h
    this.reverseMaxSpeed = 12.0;
    this.baseAccelRate = 26.0; // Responsive punchy acceleration
    this.brakeRate = 54.0; // Responsive clean brakes
    this.dragCoeff = 0.985;

    // Speed-Sensitive Steering (Stable at high speeds, agile and snappy at low/mid speeds)
    this.steerInput = 0;
    this.steerAngle = 0;
    this.steerResponse = 24.0;

    // Grip & Drift
    this.isDrifting = false;
    this.isBrakingHard = false;
    this.driftFactor = 0;
    this.lateralVelocity = 0;
    this.slipSpeed = 0;

    // Jump & Air Dynamics
    this.isAirborne = false;
    this.airTime = 0;
    this.gravity = 22.0;
    this.jumpLaunchCooldown = 0;

    // World Colliders
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
    this.maxSkidPoints = 800;
    this.skidGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxSkidPoints * 36);
    this.skidGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.skidMaterial = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.82,
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

    this.speed = this.velocity.dot(forward);
    this.lateralVelocity = this.velocity.dot(right);
    this.slipSpeed = Math.abs(this.lateralVelocity);
    const absSpeed = Math.abs(this.speed);

    // 2. SPEED-SENSITIVE STEERING ANGLE
    const speedRatio = Math.min(1.0, absSpeed / 26.0);
    // When drifting, grant full 34 degree steering authority for counter-steering control
    const baseSteerDeg = this.isDrifting ? 34.0 : THREE.MathUtils.lerp(32.0, 16.0, speedRatio);
    const dynamicMaxSteer = THREE.MathUtils.degToRad(baseSteerDeg);

    this.steerInput = THREE.MathUtils.lerp(this.steerInput, input.steer, this.steerResponse * dt);
    this.steerAngle = this.steerInput * dynamicMaxSteer;

    this.isBrakingHard = input.brake > 0.35 && absSpeed > 2.5;

    // 3. 4-WHEEL GROUND & RAMP HEIGHT SAMPLING (FL, FR, RL, RR + Center)
    const flPos = this.position.clone()
      .addScaledVector(forward, this.wheelBaseHalf)
      .addScaledVector(right, -this.trackHalfWidth);
    const frPos = this.position.clone()
      .addScaledVector(forward, this.wheelBaseHalf)
      .addScaledVector(right, this.trackHalfWidth);
    const rlPos = this.position.clone()
      .addScaledVector(forward, -this.wheelBaseHalf)
      .addScaledVector(right, -this.trackHalfWidth);
    const rrPos = this.position.clone()
      .addScaledVector(forward, -this.wheelBaseHalf)
      .addScaledVector(right, this.trackHalfWidth);

    const gFL = this.samplePointGround(flPos.x, flPos.z);
    const gFR = this.samplePointGround(frPos.x, frPos.z);
    const gRL = this.samplePointGround(rlPos.x, rlPos.z);
    const gRR = this.samplePointGround(rrPos.x, rrPos.z);
    const gCenter = this.samplePointGround(this.position.x, this.position.z);

    const hFront = (gFL.height + gFR.height) * 0.5;
    const hRear = (gRL.height + gRR.height) * 0.5;
    const hLeft = (gFL.height + gRL.height) * 0.5;
    const hRight = (gFR.height + gRR.height) * 0.5;

    // Target surface slope pitch and roll
    // Three.js: front is +Z, rear is -Z -> nose UP requires NEGATIVE pitch!
    const targetSurfacePitch = -Math.atan2(hFront - hRear, this.wheelBaseHalf * 2);
    // Three.js: left is -X, right is +X -> left UP requires NEGATIVE roll!
    const rawRoll = -Math.atan2(hLeft - hRight, this.trackHalfWidth * 2);
    const targetSurfaceRoll = THREE.MathUtils.clamp(rawRoll, -0.42, 0.42);

    // Compute kinematic wheel vertical offsets under current orientation:
    // Delta Y = -z * sin(pitch) + x * sin(roll)
    const sinP = Math.sin(targetSurfacePitch);
    const sinR = Math.sin(targetSurfaceRoll);
    const wb = this.wheelBaseHalf;
    const tw = this.trackHalfWidth;

    const dyFL = -wb * sinP - tw * sinR;
    const dyFR = -wb * sinP + tw * sinR;
    const dyRL = wb * sinP - tw * sinR;
    const dyRR = wb * sinP + tw * sinR;

    // Smooth Non-Penetrating Ground Elevation:
    // Guarantees tires follow terrain seamlessly with zero downhill bounce or step-off bumps
    const rawGroundH = Math.max(
      gCenter.height,
      (hFront + hRear) * 0.5
    );
    const targetGroundY = rawGroundH + this.roadLevel;

    const isOnRamp = gFL.isOnRamp || gFR.isOnRamp || gRL.isOnRamp || gRR.isOnRamp || gCenter.isOnRamp;
    this.isOnRamp = isOnRamp;
    const isNearPeak = gCenter.isNearPeak || (hFront > 0.6 && hRear > 0.6 && Math.abs(hFront - hRear) < 0.35);

    const isOnCurb = gFL.isOnCurb || gFR.isOnCurb || gRL.isOnCurb || gRR.isOnCurb || gCenter.isOnCurb;
    this.isOnCurb = isOnCurb;
    if (isOnCurb && absSpeed > 1.8 && !this.isAirborne) {
      // Subtle physical rumble suspension vibration when clipping racing curbs
      this.suspensionCompress += Math.sin(Date.now() * 0.045) * 0.015;
      if (window.gameApp && window.gameApp.audio && window.gameApp.audio.playCurbRumble) {
        window.gameApp.audio.playCurbRumble(absSpeed);
      }
    }

    // 4. VERTICAL DYNAMICS & JUMP LAUNCH
    if (this.jumpLaunchCooldown > 0) {
      this.jumpLaunchCooldown -= dt;
    }

    if (this.isAirborne) {
      this.airTime += dt;
      this.velocity.y -= this.gravity * dt;

      // Landing check (only when falling back down)
      if (this.jumpLaunchCooldown <= 0 && this.velocity.y <= 0 && this.position.y <= targetGroundY + 0.05) {
        this.isAirborne = false;
        this.airTime = 0;
        this.position.y = targetGroundY;
        this.velocity.y = 0;
        this.suspensionCompress = 0.04;
        if (window.gameApp && window.gameApp.audio) {
          window.gameApp.audio.playJumpLand();
        }
      }

      this.surfacePitch = THREE.MathUtils.lerp(this.surfacePitch, 0, 4.0 * dt);
      this.surfaceRoll = THREE.MathUtils.lerp(this.surfaceRoll, 0, 4.0 * dt);
      this.pitch = this.surfacePitch;

    } else {
      // Natural drop: only when the vehicle has completely driven off an elevated ramp into thin air
      if (!this.isOnRamp && this.position.y > targetGroundY + 0.25) {
        this.isAirborne = true;
        this.airTime = 0.01;
        this.jumpLaunchCooldown = 0.12;
        this.velocity.y = Math.min(0, this.velocity.y);
      } else {
        // Solid ground contact: instant exact alignment so tires NEVER sink into road or ramp, with ZERO bounce when driving slowly!
        this.position.y = targetGroundY;
        this.velocity.y = 0;

        this.surfacePitch = THREE.MathUtils.lerp(this.surfacePitch, targetSurfacePitch, 22.0 * dt);
        this.surfaceRoll = THREE.MathUtils.lerp(this.surfaceRoll, targetSurfaceRoll, 22.0 * dt);
        this.pitch = this.surfacePitch;

        // Launch over crest ONLY when climbing up towards summit at high speed (> 6.0 m/s)
        // Downhill driving NEVER triggers a jump launch, completely preventing any bounce on the downhill slope
        const isClimbingTowardsPeak = (this.speed >= 0 && hFront >= hRear - 0.25) || (this.speed < 0 && hRear >= hFront - 0.25);
        if (isOnRamp && isClimbingTowardsPeak && isNearPeak && absSpeed > 6.0 && this.jumpLaunchCooldown <= 0) {
          this.isAirborne = true;
          this.airTime = 0.01;
          this.jumpLaunchCooldown = 0.35;
          this.velocity.y = Math.max(5.8, absSpeed * 0.45);
        }

        // Downforce
        const downforce = (absSpeed / this.maxSpeed) * 10.0;
        this.velocity.y -= downforce * dt;
      }
    }

    // 5. PROGRESSIVE ACCELERATION & BRAKING
    if (!this.isAirborne) {
      if (input.throttle > 0) {
        if (this.speed < this.maxSpeed) {
          const torqueFactor = Math.max(0.35, 1.0 - (this.speed / this.maxSpeed) * 0.65);
          const accel = input.throttle * this.baseAccelRate * torqueFactor;
          this.velocity.addScaledVector(forward, accel * dt);
        }
      } else if (input.brake > 0) {
        if (this.speed > 0.6) {
          const brake = input.brake * this.brakeRate;
          this.velocity.addScaledVector(forward, -brake * dt);
        } else {
          if (this.speed > -this.reverseMaxSpeed) {
            this.velocity.addScaledVector(forward, -input.brake * (this.baseAccelRate * 0.6) * dt);
          }
        }
      } else {
        this.velocity.multiplyScalar(Math.pow(this.dragCoeff, dt * 60.0));
      }

      // 6. SATISFYING HIGH-SPEED DRIFT & POWER SLIDE PHYSICS
      if (input.handbrake && absSpeed > 1.2) {
        this.isDrifting = true;
        this.driftFactor = THREE.MathUtils.lerp(this.driftFactor, 1.0, 20.0 * dt);
        // Conserve high-speed momentum throughout the drift (minimal gentle drag)
        this.velocity.multiplyScalar(Math.pow(0.994, dt * 60.0));
        // Power slide: throttle pushes car forward through the slide
        if (input.throttle > 0 && this.speed < this.maxSpeed) {
          this.velocity.addScaledVector(forward, input.throttle * this.baseAccelRate * 0.75 * dt);
        }
      } else {
        this.driftFactor = THREE.MathUtils.lerp(this.driftFactor, 0.0, 5.0 * dt);
        if (this.driftFactor < 0.04) this.isDrifting = false;
      }

      // Lateral grip: drops down to 1.4 for long, smooth, dramatic sideways sliding around bends!
      const gripRate = THREE.MathUtils.lerp(45.0, 1.4, this.driftFactor);
      const lateralDecel = -this.lateralVelocity * Math.min(1.0, gripRate * dt);
      this.velocity.addScaledVector(right, lateralDecel);

      // 7. YAW STEERING & OVERSTEER ROTATION (NO ROTATION WHEN STOPPED)
      let turnFactor = 0;
      if (absSpeed > 0.2) {
        turnFactor = Math.min(1.0, (absSpeed - 0.2) / 2.2);
      }

      const dirSign = this.speed >= -0.1 ? 1 : -1;
      // High-speed drift yaw: responsive oversteer rotation to whip tail out
      let yawRateCoeff;
      if (this.isDrifting) {
        yawRateCoeff = 4.0; // Fast, responsive tail-out rotation
      } else {
        yawRateCoeff = THREE.MathUtils.lerp(3.5, 1.9, speedRatio);
      }

      const targetYawRate = this.steerInput * turnFactor * dirSign * yawRateCoeff;
      this.angularVelocity = THREE.MathUtils.lerp(this.angularVelocity, targetYawRate, 22.0 * dt);
      this.heading += this.angularVelocity * dt;

    } else {
      this.heading += this.steerInput * 0.35 * dt;
    }

    // 8. INTEGRATE POSITION
    this.position.addScaledVector(this.velocity, dt);

    // 9. OBSTACLE & RAMP SIDE COLLISIONS
    this.resolveCollisions();

    // 10. DYNAMIC CHASSIS SUSPENSION LEAN (Subtle & critically damped)
    const targetDynRoll = THREE.MathUtils.clamp(-this.angularVelocity * (this.speed * 0.015), -0.06, 0.06);
    const targetDynPitch = THREE.MathUtils.clamp(-(input.throttle - input.brake) * 0.02, -0.04, 0.04);

    this.dynamicRoll = THREE.MathUtils.lerp(this.dynamicRoll, targetDynRoll, 14.0 * dt);
    this.dynamicPitch = THREE.MathUtils.lerp(this.dynamicPitch, targetDynPitch, 16.0 * dt);
    this.suspensionCompress = THREE.MathUtils.lerp(this.suspensionCompress, 0, 24.0 * dt);

    this.visualRoll = this.surfaceRoll + this.dynamicRoll;
    this.visualPitch = this.surfacePitch + this.dynamicPitch;

    // 11. ACCURATE SKID MARKS & SMOKE
    this.updateSkidsAndSmoke(dt, forward, right, input);
  }

  samplePointGround(x, z) {
    let maxHeight = 0;
    let isOnRamp = false;
    let isNearPeak = false;
    let isOnCurb = false;

    for (const c of this.colliders) {
      if (c.type === 'ramp') {
        const dx = x - c.x;
        const dz = z - c.z;
        const cosA = Math.cos(c.angleY);
        const sinA = Math.sin(c.angleY);
        const localX = dx * cosA - dz * sinA;
        const localZ = dx * sinA + dz * cosA;

        const hw = c.width / 2;
        const hd = c.depth / 2;

        // When sampling within the exact ramp footprint
        if (Math.abs(localX) <= hw && Math.abs(localZ) <= hd) {
          const distFromPeak = Math.abs(localZ);
          const progress = Math.max(0, 1.0 - (distFromPeak / hd));
          const h = progress * c.height;

          // PHYSICAL ENTRY CHECK:
          // A car on the road can only drive onto the ramp where the ramp height is low (<= 0.35m at slope entries).
          // If the car is on the road and this spot is a high vertical wall (> 0.35m), the car cannot climb it from the side!
          const canAccessRamp = this.isOnRamp || (h <= 0.35) || (this.position.y >= h - 0.35);

          if (canAccessRamp && h > maxHeight) {
            maxHeight = h;
            isOnRamp = true;
            if (distFromPeak < 1.4) {
              isNearPeak = true;
            }
          }
        }
      } else if (c.type === 'curb_arc') {
        const dx = x - c.cx;
        const dz = z - c.cz;
        const dist = Math.hypot(dx, dz);
        if (dist >= c.rMin && dist <= c.rMax) {
          let angle = Math.atan2(dz, dx);
          while (angle < c.a1) angle += Math.PI * 2;
          while (angle > c.a2 + 0.01) angle -= Math.PI * 2;
          if (angle >= c.a1 - 0.01 && angle <= c.a2 + 0.01) {
            const t = (dist - c.rMin) / (c.rMax - c.rMin);
            const curbh = Math.sin(t * Math.PI) * c.height;
            if (curbh > maxHeight) {
              maxHeight = curbh;
              isOnCurb = true;
            }
          }
        }
      } else if (c.type === 'curb_straight') {
        const dx = x - c.x;
        const dz = z - c.z;
        const cosA = Math.cos(c.rot);
        const sinA = Math.sin(c.rot);
        const lx = dx * cosA + dz * sinA;
        const lz = -dx * sinA + dz * cosA;
        const hw = c.width / 2;
        const hl = c.length / 2;
        if (Math.abs(lz) <= hl && Math.abs(lx) <= hw) {
          const t = 1.0 - (Math.abs(lx) / hw);
          const curbh = Math.sin(t * Math.PI * 0.5) * c.height;
          if (curbh > maxHeight) {
            maxHeight = curbh;
            isOnCurb = true;
          }
        }
      }
    }

    return { height: maxHeight, isOnRamp, isNearPeak, isOnCurb };
  }

  resolveCollisions() {
    // Exact Van Oriented Bounding Box (OBB) extents (including front bumper, fenders & mirrors)
    const halfL = 1.90; // Front bumper reaches to z = 1.83m (+0.07m buffer)
    const halfW = 0.82; // Outer wheel arches & mirrors reach to x = 0.79m (+0.03m buffer)
    const maxBoundRadius = 2.20; // Circumscribed radius for fast broadphase

    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const right = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));

    for (let iter = 0; iter < 2; iter++) {
      for (const c of this.colliders) {
        if (c.type === 'box') {
          const halfX = c.width / 2;
          const halfZ = c.depth / 2;

          const cdx = this.position.x - c.x;
          const cdz = this.position.z - c.z;
          if (Math.abs(cdx) > halfX + maxBoundRadius || Math.abs(cdz) > halfZ + maxBoundRadius) {
            continue;
          }

          // 4 World Corners of the Oriented Van
          const cFLx = this.position.x + forward.x * halfL - right.x * halfW;
          const cFLz = this.position.z + forward.z * halfL - right.z * halfW;
          const cFRx = this.position.x + forward.x * halfL + right.x * halfW;
          const cFRz = this.position.z + forward.z * halfL + right.z * halfW;
          const cRLx = this.position.x - forward.x * halfL - right.x * halfW;
          const cRLz = this.position.z - forward.z * halfL - right.z * halfW;
          const cRRx = this.position.x - forward.x * halfL + right.x * halfW;
          const cRRz = this.position.z - forward.z * halfL + right.z * halfW;

          const bMinX = c.x - halfX;
          const bMaxX = c.x + halfX;
          const bMinZ = c.z - halfZ;
          const bMaxZ = c.z + halfZ;

          // Axis 1: World X
          const vMinX = Math.min(cFLx, cFRx, cRLx, cRRx);
          const vMaxX = Math.max(cFLx, cFRx, cRLx, cRRx);
          const overlapX = Math.min(vMaxX - bMinX, bMaxX - vMinX);
          if (overlapX <= 0) continue;

          // Axis 2: World Z
          const vMinZ = Math.min(cFLz, cFRz, cRLz, cRRz);
          const vMaxZ = Math.max(cFLz, cFRz, cRLz, cRRz);
          const overlapZ = Math.min(vMaxZ - bMinZ, bMaxZ - vMinZ);
          if (overlapZ <= 0) continue;

          // Axis 3: Van Right Axis
          const p1 = (bMinX - this.position.x) * right.x + (bMinZ - this.position.z) * right.z;
          const p2 = (bMaxX - this.position.x) * right.x + (bMinZ - this.position.z) * right.z;
          const p3 = (bMinX - this.position.x) * right.x + (bMaxZ - this.position.z) * right.z;
          const p4 = (bMaxX - this.position.x) * right.x + (bMaxZ - this.position.z) * right.z;
          const bMinR = Math.min(p1, p2, p3, p4);
          const bMaxR = Math.max(p1, p2, p3, p4);
          const overlapR = Math.min(halfW - bMinR, bMaxR - (-halfW));
          if (overlapR <= 0) continue;

          // Axis 4: Van Forward Axis
          const f1 = (bMinX - this.position.x) * forward.x + (bMinZ - this.position.z) * forward.z;
          const f2 = (bMaxX - this.position.x) * forward.x + (bMinZ - this.position.z) * forward.z;
          const f3 = (bMinX - this.position.x) * forward.x + (bMaxZ - this.position.z) * forward.z;
          const f4 = (bMaxX - this.position.x) * forward.x + (bMaxZ - this.position.z) * forward.z;
          const bMinF = Math.min(f1, f2, f3, f4);
          const bMaxF = Math.max(f1, f2, f3, f4);
          const overlapF = Math.min(halfL - bMinF, bMaxF - (-halfL));
          if (overlapF <= 0) continue;

          // Minimum Translation Vector (MTV)
          let minOverlap = overlapX;
          let normalX = cdx > 0 ? 1 : -1;
          let normalZ = 0;

          if (overlapZ < minOverlap) {
            minOverlap = overlapZ;
            normalX = 0;
            normalZ = cdz > 0 ? 1 : -1;
          }
          if (overlapR < minOverlap) {
            minOverlap = overlapR;
            const signR = (bMaxR + bMinR) < 0 ? 1 : -1;
            normalX = right.x * signR;
            normalZ = right.z * signR;
          }
          if (overlapF < minOverlap) {
            minOverlap = overlapF;
            const signF = (bMaxF + bMinF) < 0 ? 1 : -1;
            normalX = forward.x * signF;
            normalZ = forward.z * signF;
          }

          // Push van cleanly outside building boundary (guarantees front nose never enters wall)
          const pushDist = minOverlap + 0.02;
          this.position.x += normalX * pushDist;
          this.position.z += normalZ * pushDist;

          // Physical impulse bounce off building facade
          const dot = this.velocity.x * normalX + this.velocity.z * normalZ;
          if (dot < 0) {
            this.velocity.x -= dot * normalX * 1.35;
            this.velocity.z -= dot * normalZ * 1.35;
            this.velocity.multiplyScalar(0.70);
          }
        } else if (c.type === 'ramp' && iter === 0) {
        // SMOOTH RAMP SIDE BARRIER: Prevents driving through vertical side wall from road, NEVER traps or blocks driving off!
        const dx = this.position.x - c.x;
        const dz = this.position.z - c.z;
        const cosA = Math.cos(c.angleY);
        const sinA = Math.sin(c.angleY);
        const localX = dx * cosA - dz * sinA;
        const localZ = dx * sinA + dz * cosA;

        // Velocity in ramp local frame
        const vLocalX = this.velocity.x * cosA - this.velocity.z * sinA;

        const hw = c.width / 2;
        const hd = c.depth / 2;

        // Only test within ramp length, excluding flat entry/exit tips (< 0.4m from ends)
        if (Math.abs(localZ) <= hd - 0.4) {
          const distFromPeak = Math.abs(localZ);
          const rampH = Math.max(0, 1.0 - (distFromPeak / hd)) * c.height;

          // Only collide if car is down on the road outside (not on top of ramp or airborne)
          if (!this.isOnRamp && !this.isAirborne && this.position.y < rampH - 0.15) {
            const carR = this.halfCarWidth;

            // Left side barrier (localX < -hw): outside left edge trying to penetrate
            if (localX < -hw && localX > -hw - carR) {
              const penetration = (hw + carR) - Math.abs(localX);
              const normX = -cosA;
              const normZ = sinA;

              this.position.x += normX * penetration;
              this.position.z += normZ * penetration;

              // Deflect inward velocity and allow free forward/backward slide
              const vInward = this.velocity.x * (-normX) + this.velocity.z * (-normZ);
              if (vInward > 0) {
                this.velocity.x -= (-normX) * vInward * 1.2;
                this.velocity.z -= (-normZ) * vInward * 1.2;
                this.velocity.multiplyScalar(0.92);
              }
            }
            // Right side barrier (localX > hw): outside right edge trying to penetrate
            else if (localX > hw && localX < hw + carR) {
              const penetration = (hw + carR) - localX;
              const normX = cosA;
              const normZ = -sinA;

              this.position.x += normX * penetration;
              this.position.z += normZ * penetration;

              // Deflect inward velocity and allow free forward/backward slide
              const vInward = this.velocity.x * (-normX) + this.velocity.z * (-normZ);
              if (vInward > 0) {
                this.velocity.x -= (-normX) * vInward * 1.2;
                this.velocity.z -= (-normZ) * vInward * 1.2;
                this.velocity.multiplyScalar(0.92);
              }
            }
          }
        }
      }
    }
  }
  }

  updateSkidsAndSmoke(dt, forward, right, input) {
    const absSpeed = Math.abs(this.speed);
    // User requirement: skid marks appear ONLY when van does a handbrake turn OR hard brakes at high speed
    const isHandbrakeSkid = !this.isAirborne && (this.isDrifting || input.handbrake) && absSpeed > 1.8;
    const isHighSpeedBrakeSkid = !this.isAirborne && input.brake > 0.45 && absSpeed > 6.0;
    const isSkidding = isHandbrakeSkid || isHighSpeedBrakeSkid;

    const rlPos = this.position.clone()
      .addScaledVector(forward, -this.wheelBaseHalf)
      .addScaledVector(right, -this.trackHalfWidth);
    const rrPos = this.position.clone()
      .addScaledVector(forward, -this.wheelBaseHalf)
      .addScaledVector(right, this.trackHalfWidth);

    // Accurate ground height under tires for skids
    const gRL = this.samplePointGround(rlPos.x, rlPos.z);
    const gRR = this.samplePointGround(rrPos.x, rrPos.z);
    rlPos.y = gRL.height + this.roadLevel + 0.01;
    rrPos.y = gRR.height + this.roadLevel + 0.01;

    if (isSkidding) {
      if (this.isDrifting || this.slipSpeed > 2.5) {
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
    const halfWidth = 0.11; // 22cm realistic tire track width

    for (let i = 0; i < count - 1; i++) {
      const i3 = i * 3;
      const ni3 = (i + 1) * 3;

      const lx1 = this.skidHistoryL[i3], ly1 = this.skidHistoryL[i3 + 1], lz1 = this.skidHistoryL[i3 + 2];
      const lx2 = this.skidHistoryL[ni3], ly2 = this.skidHistoryL[ni3 + 1], lz2 = this.skidHistoryL[ni3 + 2];

      const rx1 = this.skidHistoryR[i3], ry1 = this.skidHistoryR[i3 + 1], rz1 = this.skidHistoryR[i3 + 2];
      const rx2 = this.skidHistoryR[ni3], ry2 = this.skidHistoryR[ni3 + 1], rz2 = this.skidHistoryR[ni3 + 2];

      const ldx = lx2 - lx1;
      const ldz = lz2 - lz1;
      const ldist = Math.hypot(ldx, ldz);

      const rdx = rx2 - rx1;
      const rdz = rz2 - rz1;
      const rdist = Math.hypot(rdx, rdz);

      // Only connect consecutive points if within valid driving distance; skips gap jumps
      if (ldist > 0.04 && ldist < 2.5 && rdist > 0.04 && rdist < 2.5) {
        // True 2D perpendicular normal for left tire ribbon
        const lnx = -ldz / ldist;
        const lnz = ldx / ldist;
        const lox = lnx * halfWidth;
        const loz = lnz * halfWidth;

        // Quad vertices for Left Tire
        const pL1x = lx1 - lox, pL1y = ly1, pL1z = lz1 - loz;
        const pL2x = lx1 + lox, pL2y = ly1, pL2z = lz1 + loz;
        const pL3x = lx2 - lox, pL3y = ly2, pL3z = lz2 - loz;
        const pL4x = lx2 + lox, pL4y = ly2, pL4z = lz2 + loz;

        positions[pIdx++] = pL1x; positions[pIdx++] = pL1y; positions[pIdx++] = pL1z;
        positions[pIdx++] = pL2x; positions[pIdx++] = pL2y; positions[pIdx++] = pL2z;
        positions[pIdx++] = pL3x; positions[pIdx++] = pL3y; positions[pIdx++] = pL3z;

        positions[pIdx++] = pL2x; positions[pIdx++] = pL2y; positions[pIdx++] = pL2z;
        positions[pIdx++] = pL4x; positions[pIdx++] = pL4y; positions[pIdx++] = pL4z;
        positions[pIdx++] = pL3x; positions[pIdx++] = pL3y; positions[pIdx++] = pL3z;

        // True 2D perpendicular normal for right tire ribbon
        const rnx = -rdz / rdist;
        const rnz = rdx / rdist;
        const rox = rnx * halfWidth;
        const roz = rnz * halfWidth;

        // Quad vertices for Right Tire
        const pR1x = rx1 - rox, pR1y = ry1, pR1z = rz1 - roz;
        const pR2x = rx1 + rox, pR2y = ry1, pR2z = rz1 + roz;
        const pR3x = rx2 - rox, pR3y = ry2, pR3z = rz2 - roz;
        const pR4x = rx2 + rox, pR4y = ry2, pR4z = rz2 + roz;

        positions[pIdx++] = pR1x; positions[pIdx++] = pR1y; positions[pIdx++] = pR1z;
        positions[pIdx++] = pR2x; positions[pIdx++] = pR2y; positions[pIdx++] = pR2z;
        positions[pIdx++] = pR3x; positions[pIdx++] = pR3y; positions[pIdx++] = pR3z;

        positions[pIdx++] = pR2x; positions[pIdx++] = pR2y; positions[pIdx++] = pR2z;
        positions[pIdx++] = pR4x; positions[pIdx++] = pR4y; positions[pIdx++] = pR4z;
        positions[pIdx++] = pR3x; positions[pIdx++] = pR3y; positions[pIdx++] = pR3z;
      }
    }

    this.skidGeometry.attributes.position.needsUpdate = true;
    this.skidGeometry.setDrawRange(0, pIdx / 3);
  }

  reset(x = 0, z = -40, heading = 0) {
    this.position.set(x, this.roadLevel, z);
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
    this.jumpLaunchCooldown = 0;
  }
}
