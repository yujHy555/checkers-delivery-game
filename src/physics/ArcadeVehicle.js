import { Vector3 as BVector3, Quaternion, MeshBuilder, Mesh, StandardMaterial, Material, Color3, Color4, DynamicTexture, VertexData, ParticleSystem, Engine, PhysicsRaycastResult, PhysicsMotionType } from '@babylonjs/core';
import { TextureGenerator } from '../utils/TextureGenerator.js';

// Pure 3D Vector Math for Deterministic Arcade Physics
export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x; this.y = y; this.z = z;
    return this;
  }
  copy(v) {
    this.x = v.x; this.y = v.y; this.z = v.z;
    return this;
  }
  clone() {
    return new Vec3(this.x, this.y, this.z);
  }
  add(v) {
    this.x += v.x; this.y += v.y; this.z += v.z;
    return this;
  }
  addInPlace(v) {
    this.x += v.x; this.y += v.y; this.z += v.z;
    return this;
  }
  scale(s) {
    return new Vec3(this.x * s, this.y * s, this.z * s);
  }
  addScaledVector(v, s) {
    this.x += v.x * s; this.y += v.y * s; this.z += v.z * s;
    return this;
  }
  multiplyScalar(s) {
    this.x *= s; this.y *= s; this.z *= s;
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  normalize() {
    const l = this.length() || 1.0;
    this.x /= l; this.y /= l; this.z /= l;
    return this;
  }
  lerp(v, alpha) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }
  toBabylon() {
    return new BVector3(this.x, this.y, this.z);
  }
}

export const MathUtils = {
  lerp: (a, b, t) => a + (b - a) * t,
  clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
  degToRad: (deg) => (deg * Math.PI) / 180
};

export class ArcadeVehicle {
  constructor(scene, options = {}) {
    this.scene = scene;

    // Dimensions (Real-world scale matching custom 3D Kei Van body)
    this.length = 4.51;
    this.width = 1.84;
    this.height = 1.96;
    this.wheelRadius = 0.355;
    this.wheelBaseHalf = 1.42;
    this.trackHalfWidth = 0.78;
    this.halfCarWidth = 0.92;

    this.roadLevel = 0.025;
    this.position = new Vec3(options.x || 0, this.roadLevel, options.z || -40);
    this.velocity = new Vec3();
    this.heading = options.heading || 0;
    this.angularVelocity = 0;
    this.speed = 0;

    // Surface alignment (terrain pitch & roll)
    this.surfacePitch = 0;
    this.surfaceRoll = 0;

    // Dynamic Chassis Suspension Lean & Mass-Spring-Damper Simulation
    this.dynamicPitch = 0;
    this.dynamicRoll = 0;
    this.visualRoll = 0;
    this.visualPitch = 0;
    this.suspensionCompress = 0;
    this.suspensionOffset = 0; // Displacement in meters: droop in air (-0.05m) to landing compression (+0.16m)
    this.suspensionVelocity = 0; // Vertical rate of suspension movement (m/s)
    this.suspensionPitchOffset = 0; // Nose dip on landing impact (radians)
    this.landingWobble = 0; // Magnitude of landing roll wobble
    this.landingWobblePhase = 0; // Phase angle of wobble oscillation
    this.chassisWobbleRoll = 0; // Current roll offset from landing wobble
    this.scrapeSparkTimer = 0; // Throttle rate of ground scrape sparks
    this.wheelOffsets = { FL: 0, FR: 0, RL: 0, RR: 0 }; // AAA independent per-wheel conforming suspension travel

    // Driving Parameters
    this.baseMaxSpeed = 26.5; // ~95 km/h standard top speed
    this.nitroMaxSpeed = 30.5; // ~110 km/h (100 - 110 km/h controlled nitro spurt)
    this.maxSpeed = 26.5;
    this.reverseMaxSpeed = 9.0;
    this.baseAccelRate = 22.0;
    this.brakeRate = 42.0;
    this.dragCoeff = 0.988;

    // Nitro Boost State
    this.isNitroActive = false;
    this.nitroProgress = 0;

    // Speed-Sensitive Steering (Silky smooth, responsive & predictable)
    this.steerInput = 0;
    this.steerAngle = 0;
    this.steerResponse = 13.5; // Direct, crisp input response eliminating steering delay

    // Grip & Drift
    this.isDrifting = false;
    this.isDonut = false;
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

    // Visual skidmarks, tire smoke and arcade ground sparks
    this.initSkidmarks();
    this.initTireSmoke();
    this.initSparks();
  }

  setColliders(colliders) {
    this.colliders = colliders || [];
  }

  initHavokVehicle(havokPlugin, PhysicsAggregate, PhysicsShapeType) {
    this.havokPlugin = havokPlugin;
    this.havokRayFrom = new BVector3();
    this.havokRayTo = new BVector3();
    this.havokRayResult = new PhysicsRaycastResult();

    // Create Havok rigid-body proxy for the van chassis (elevated above wheel rays at y + 1.15m)
    this.havokChassisMesh = MeshBuilder.CreateBox('vanHavokChassis', {
      width: 1.80,
      height: 1.15,
      depth: 4.44
    }, this.scene);
    this.havokChassisMesh.isVisible = false;
    this.havokChassisMesh.isPickable = false;
    this.havokChassisMesh.rotationQuaternion = new Quaternion();
    this.havokChassisMesh.position.set(this.position.x, this.position.y + 1.15, this.position.z);

    this.havokChassisAggregate = new PhysicsAggregate(
      this.havokChassisMesh,
      PhysicsShapeType.BOX,
      { mass: 1250, friction: 0.25, restitution: 0.05 },
      this.scene
    );
    if (this.havokChassisAggregate.body) {
      this.havokChassisAggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
      this.havokChassisAggregate.body.disablePreStep = false;
    }
  }

  initSkidmarks() {
    this.maxSkidQuads = 1200; // Store up to 1200 persistent tire tread quads (~250m of skid marks)
    this.skidSegments = [];
    this.RLLast = null;
    this.RRLast = null;
    this.FLLast = null;
    this.FRLast = null;
    this.RLV = 0;
    this.RRV = 0;
    this.FLV = 0;
    this.FRV = 0;

    // Dark grey tire tread pattern material
    this.skidMat = new StandardMaterial('skidmarkMat', this.scene);
    this.skidMat.diffuseTexture = TextureGenerator.createTireSkidmarkPatternTexture(this.scene);
    this.skidMat.diffuseTexture.hasAlpha = true;
    this.skidMat.useAlphaFromDiffuseTexture = true;
    this.skidMat.diffuseColor = new Color3(0.24, 0.25, 0.28); // Dark grey
    this.skidMat.specularColor = new Color3(0.01, 0.01, 0.01);
    this.skidMat.emissiveColor = new Color3(0.01, 0.01, 0.01);
    this.skidMat.backFaceCulling = false;
    this.skidMat.zOffset = -2; // Prevents z-fighting with asphalt floor

    this.skidMesh = new Mesh('skidmarksMesh', this.scene);
    this.skidMesh.material = this.skidMat;
    this.skidMesh.isPickable = false;
    this.skidMesh.receiveShadows = true;
  }

  initTireSmoke() {
    const smokeTex = TextureGenerator.createSmokePuffTexture(this.scene);

    this.smokeMat = new StandardMaterial('smokePuffMat', this.scene);
    this.smokeMat.diffuseTexture = smokeTex;
    this.smokeMat.useAlphaFromDiffuseTexture = true;
    this.smokeMat.diffuseColor = new Color3(1.0, 1.0, 1.0); // Pure brilliant white
    this.smokeMat.emissiveColor = new Color3(0.92, 0.92, 0.92); // Radiant white self-illumination (highly apparent in all lighting)
    this.smokeMat.specularColor = new Color3(0, 0, 0);
    this.smokeMat.backFaceCulling = false;
    this.smokeMat.disableLighting = true; // Natural self-illuminating ambient daylight scattering
    this.smokeMat.disableDepthWrite = true; // Transparency blending without clipping
    this.smokeMat.alphaCutOff = 0.0; // Strictly ensure NO pixels are discarded by alpha test
    this.smokeMat.transparencyMode = Material.MATERIAL_ALPHABLEND; // 2

    this.smokeSpawnTimer = 0.055;
    this.smokeWheelToggle = false;

    // Pre-allocated ring buffer pool of 90 billboard smoke planes (100% visible, zero GC overhead)
    this.smokePoolSize = 90;
    this.smokePool = [];
    this.smokePoolIndex = 0;

    for (let i = 0; i < this.smokePoolSize; i++) {
      const plane = MeshBuilder.CreatePlane(`smokePuff_${i}`, { size: 1.0 }, this.scene);
      plane.material = this.smokeMat;
      plane.billboardMode = Mesh.BILLBOARDMODE_ALL; // Camera-facing 3D quad
      plane.isPickable = false;
      plane.isVisible = false;
      plane.visibility = 0;
      plane.renderingGroupId = 1; // Renders on top of road/ramps with zero occluding

      this.smokePool.push({
        mesh: plane,
        active: false,
        life: 0,
        maxLife: 0.85,
        scale: 0.55,
        growthRate: 2.0,
        vy: 0.7,
        vx: 0,
        vz: 0,
        rotSpeed: 0,
        initialAlpha: 0.70
      });
    }
  }

  spawnSmoke(pos) {
    if (!this.smokePool) return;
    const p = this.smokePool[this.smokePoolIndex];
    this.smokePoolIndex = (this.smokePoolIndex + 1) % this.smokePoolSize;

    p.mesh.position.set(
      pos.x + (Math.random() - 0.5) * 0.18,
      pos.y + 0.18,
      pos.z + (Math.random() - 0.5) * 0.18
    );
    p.scale = 0.52 + Math.random() * 0.22; // Lush, apparent initial puff size
    p.mesh.scaling.set(p.scale, p.scale, p.scale);
    p.mesh.rotation.z = Math.random() * Math.PI * 2;
    p.rotSpeed = (Math.random() - 0.5) * 1.8;
    p.vy = 0.70 + Math.random() * 0.35;
    p.vx = (Math.random() - 0.5) * 0.25;
    p.vz = (Math.random() - 0.5) * 0.25;
    p.life = 0;
    p.maxLife = 0.85 + Math.random() * 0.30; // Lingers noticeably longer (~1.0s)
    p.growthRate = 2.0 + Math.random() * 0.6; // Expands outward into rich puffy clouds
    p.initialAlpha = 0.68 + Math.random() * 0.14; // High-visibility dense white smoke
    p.mesh.visibility = p.initialAlpha;
    p.mesh.isVisible = true;
    p.active = true;
  }

  initSparks() {
    this.sparkMat = new StandardMaterial('arcadeSparkMat', this.scene);
    const sparkTex = TextureGenerator.createSparkTexture(this.scene);
    this.sparkMat.diffuseTexture = sparkTex;
    this.sparkMat.emissiveTexture = sparkTex;
    this.sparkMat.opacityTexture = sparkTex;
    this.sparkMat.diffuseTexture.hasAlpha = true;
    this.sparkMat.useAlphaFromDiffuseTexture = true;
    this.sparkMat.diffuseColor = new Color3(1.0, 0.95, 0.8);
    this.sparkMat.emissiveColor = new Color3(1.0, 0.95, 0.65); // Brilliant electric spark incandescent glow
    this.sparkMat.specularColor = new Color3(0, 0, 0);
    this.sparkMat.backFaceCulling = false;
    this.sparkMat.disableLighting = true;
    this.sparkMat.disableDepthWrite = true;
    this.sparkMat.alphaMode = Engine.ALPHA_ADD;

    this.sparkPoolSize = 64;
    this.sparkPool = [];
    this.sparkPoolIndex = 0;

    for (let i = 0; i < this.sparkPoolSize; i++) {
      // Sleek elongated needle line spark quad (unit 1m x 1m, scaled directly in world space)
      const plane = MeshBuilder.CreatePlane(`arcadeSpark_${i}`, { size: 1.0 }, this.scene);
      plane.material = this.sparkMat;
      plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
      plane.isPickable = false;
      plane.isVisible = false;
      plane.visibility = 0;
      plane.renderingGroupId = 2; // Renders over road, pavement and shadow planes

      this.sparkPool.push({
        mesh: plane,
        active: false,
        life: 0,
        maxLife: 0.35,
        baseScaleX: 0.11,
        baseScaleY: 0.45,
        vx: 0,
        vy: 0,
        vz: 0
      });
    }
  }

  /**
   * Emits clean, vibrant line-streak sparks from BOTH sides of the car right at the wheels and ground,
   * shooting UP and OUTWARDS away from the wheels at ground level.
   */
  spawnSideSparks(count = 14, burstSpeed = 4.2) {
    if (!this.sparkPool) return;
    const forward = new Vec3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const right = new Vec3(Math.cos(this.heading), 0, -Math.sin(this.heading));

    const halfCount = Math.max(1, Math.floor(count / 2));

    // Position sparks directly at the wheel contact area (beside wheels at ground level)
    const wheelOffsetZ = -this.wheelBaseHalf * 0.45; // right by the wheels
    const posL = this.position.clone()
      .addScaledVector(forward, wheelOffsetZ)
      .addScaledVector(right, -this.trackHalfWidth * 1.04);
    const posR = this.position.clone()
      .addScaledVector(forward, wheelOffsetZ)
      .addScaledVector(right, this.trackHalfWidth * 1.04);

    const ghL = (this.samplePointGround && this.samplePointGround(posL.x, posL.z)?.height) || 0;
    const ghR = (this.samplePointGround && this.samplePointGround(posR.x, posR.z)?.height) || 0;
    posL.y = (this.roadLevel || 0) + ghL + 0.005;
    posR.y = (this.roadLevel || 0) + ghR + 0.005;

    // Emit from left side (shooting up & left-outwards from wheel/ground contact)
    this.emitDirectedSparks(posL, -1, halfCount, burstSpeed, forward, right);
    // Emit from right side (shooting up & right-outwards from wheel/ground contact)
    this.emitDirectedSparks(posR, 1, halfCount, burstSpeed, forward, right);
  }

  emitDirectedSparks(originPos, sideSign, count, burstSpeed, forward, right) {
    for (let k = 0; k < count; k++) {
      const p = this.sparkPool[this.sparkPoolIndex];
      this.sparkPoolIndex = (this.sparkPoolIndex + 1) % this.sparkPoolSize;

      // Tight jitter right at the wheel ground contact patch
      const px = originPos.x + (Math.random() - 0.5) * 0.12;
      const py = originPos.y + Math.random() * 0.005; // 5mm - 10mm off ground
      const pz = originPos.z + (Math.random() - 0.5) * 0.22;
      p.mesh.position.set(px, py, pz);

      // Clean, directed velocity (no chaotic branching / forking):
      // Shoots up and outwards away from the wheel
      const outwardSpeed = burstSpeed * (0.85 + Math.random() * 0.50);
      const upSpeed = burstSpeed * (0.65 + Math.random() * 0.65);
      const rearSpeed = (Math.abs(this.speed) * 0.28) + 0.8 + Math.random() * 1.0;

      // sideSign is -1 for left (shoots -right), +1 for right (shoots +right)
      p.vx = (right.x * sideSign * outwardSpeed) - (forward.x * rearSpeed) + (Math.random() - 0.5) * 0.3;
      p.vz = (right.z * sideSign * outwardSpeed) - (forward.z * rearSpeed) + (Math.random() - 0.5) * 0.3;
      p.vy = upSpeed;

      const sizeVar = 0.85 + Math.random() * 0.30;
      p.baseScaleX = 0.09 * sizeVar; // Sleek needle width (~9cm)
      p.baseScaleY = 0.40 * sizeVar; // Sleek needle streak (~40cm long)
      p.mesh.scaling.set(p.baseScaleX, p.baseScaleY, 1.0);
      p.life = 0;
      p.maxLife = 0.28 + Math.random() * 0.14; // 0.28s - 0.42s visible arc
      p.mesh.visibility = 1.0;
      p.mesh.isVisible = true;
      p.active = true;
    }
  }

  updateSparks(dt) {
    if (!this.sparkPool) return;

    const right = new Vec3(Math.cos(this.heading), 0, -Math.sin(this.heading));

    for (let i = 0; i < this.sparkPoolSize; i++) {
      const p = this.sparkPool[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.isVisible = false;
        p.mesh.visibility = 0;
        continue;
      }

      // Strong gravity pulls sparks downward towards the pavement
      p.vy -= 18.0 * dt;

      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      // Ground pavement collision and bounce on asphalt or ramp surface
      const gh = (this.samplePointGround && this.samplePointGround(p.mesh.position.x, p.mesh.position.z)?.height) || 0;
      const minGroundY = (this.roadLevel || 0) + gh;
      if (p.mesh.position.y <= minGroundY + 0.008 && p.vy < 0) {
        p.mesh.position.y = minGroundY + 0.008;
        p.vy = Math.abs(p.vy) * 0.35; // Energetic arcade bounce
        p.vx *= 0.80;
        p.vz *= 0.80;
      }

      const progress = p.life / p.maxLife;
      // Orient the elongated line spark along its 3D motion trajectory in screen space
      const lateralVel = p.vx * right.x + p.vz * right.z;
      p.mesh.rotation.z = -Math.atan2(lateralVel, Math.max(0.2, p.vy));

      // Stretch line length proportional to velocity for genuine dynamic streak effect
      const currentSpeed = Math.hypot(p.vx, p.vy, p.vz);
      const stretch = Math.min(1.8, Math.max(0.7, currentSpeed * 0.18));
      p.mesh.scaling.set(p.baseScaleX * (1.0 - progress * 0.35), p.baseScaleY * stretch * (1.0 - progress * 0.25), 1.0);

      // Smooth energetic fade curve
      p.mesh.visibility = Math.max(0, 1.0 - Math.pow(progress, 1.3));
    }
  }

  update(dt, input) {
    if (dt > 0.08) dt = 0.08;

    // 1. DIRECTION VECTORS
    const forward = new Vec3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const right = new Vec3(Math.cos(this.heading), 0, -Math.sin(this.heading));

    this.speed = this.velocity.dot(forward);
    this.lateralVelocity = this.velocity.dot(right);
    this.slipSpeed = Math.abs(this.lateralVelocity);
    const absSpeed = Math.abs(this.speed);

    // 2. SPEED-SENSITIVE STEERING ANGLE (Smooth progressive cornering)
    const speedRatio = Math.min(1.0, absSpeed / 22.0);
    const baseSteerDeg = this.isDrifting ? 32.0 : MathUtils.lerp(27.0, 18.0, speedRatio);
    const dynamicMaxSteer = MathUtils.degToRad(baseSteerDeg);

    this.steerInput = MathUtils.lerp(this.steerInput, input.steer, this.steerResponse * dt);
    this.steerAngle = this.steerInput * dynamicMaxSteer;

    this.isBrakingHard = input.brake > 0.35 && this.speed > 2.5;

    // 3. ACCELERATION, DONUTS & CORNER POWER-DRIFT (Update horizontal velocity & heading BEFORE integrating position)
    const totalSpeed = this.velocity.length();
    const isReverseIntent = Boolean(input.brake > 0 && !input.throttle);
    const isReversingVehicle = (this.speed < -0.15) || (isReverseIntent && this.speed <= 0.35);

    // If user presses brake/reverse without throttle, immediately abort drift so reverse kicks in with zero delay!
    if (isReverseIntent || isReversingVehicle) {
      this.isDonut = false;
      this.isDrifting = false;
      this.driftFactor = 0;
    }

    // Strictly disable donuts and drifts when reversing or requesting reverse
    const isDonutIntent = !isReverseIntent && !isReversingVehicle && Boolean(input.handbrake && input.throttle > 0 && (this.isDonut || totalSpeed < 3.8));
    this.isDonut = isDonutIntent;

    const isCornerDriftIntent = !isReverseIntent && !isReversingVehicle && Boolean(input.handbrake && totalSpeed >= 2.0 && !isDonutIntent && this.speed > 0.5);

    if (isDonutIntent || isCornerDriftIntent) {
      this.isDrifting = true;
      this.driftFactor = MathUtils.lerp(this.driftFactor, 1.0, 8.0 * dt);
    } else {
      this.driftFactor = MathUtils.lerp(this.driftFactor, 0.0, 4.0 * dt);
      if (this.driftFactor < 0.02) this.isDrifting = false;
    }

    if (!this.isAirborne) {
      if (isDonutIntent) {
        const targetDonutSpeed = 5.2;
        if (this.speed < targetDonutSpeed) {
          this.velocity.addScaledVector(forward, input.throttle * this.baseAccelRate * 0.95 * dt);
        } else {
          this.velocity.multiplyScalar(Math.pow(0.96, dt * 60.0));
        }

        const steerDir = Math.abs(this.steerInput) > 0.08 ? Math.sign(this.steerInput) : 1.0;
        const donutYawRate = steerDir * 3.65 * Math.max(0.65, Math.abs(this.steerInput));
        this.angularVelocity = MathUtils.lerp(this.angularVelocity, donutYawRate, 14.0 * dt);
        this.heading += this.angularVelocity * dt;

      } else if (this.isDrifting && totalSpeed >= 2.0) {
        let driftSpeed = totalSpeed;
        if (input.throttle > 0 && driftSpeed < this.maxSpeed) {
          driftSpeed = Math.min(this.maxSpeed, driftSpeed + input.throttle * this.baseAccelRate * 0.70 * dt);
        } else {
          driftSpeed *= Math.pow(0.998, dt * 60.0);
        }

        const velHeading = Math.atan2(this.velocity.x, this.velocity.z);
        let relAngle = this.heading - velHeading;
        while (relAngle > Math.PI) relAngle -= Math.PI * 2;
        while (relAngle < -Math.PI) relAngle += Math.PI * 2;

        const maxSlip = 0.52;
        const targetSlip = this.steerInput * maxSlip;
        const slipError = targetSlip - relAngle;

        const tanSteer = Math.tan(this.steerAngle);
        const kinematicYawRate = (driftSpeed / (this.wheelBaseHalf * 2)) * tanSteer;
        const driftYawRate = kinematicYawRate * 0.95 + slipError * 3.4 * this.driftFactor;
        this.angularVelocity = MathUtils.lerp(this.angularVelocity, driftYawRate, 12.0 * dt);
        this.heading += this.angularVelocity * dt;

        const updatedForward = new Vec3(Math.sin(this.heading), 0, Math.cos(this.heading));
        const velDir = this.velocity.clone().normalize();
        const slipAlignRate = MathUtils.lerp(22.0, 3.2, this.driftFactor);
        velDir.lerp(updatedForward, slipAlignRate * dt).normalize();
        this.velocity.copy(velDir.multiplyScalar(driftSpeed));

      } else {
        // Dynamic top speed and acceleration rate during active Nitro
        const currentTopSpeed = this.isNitroActive ? this.nitroMaxSpeed : this.baseMaxSpeed;
        this.maxSpeed = currentTopSpeed;
        const currentAccelRate = this.isNitroActive ? (this.baseAccelRate * 1.85) : this.baseAccelRate;

        if (input.throttle > 0 || this.isNitroActive) {
          const throttlePower = Math.max(input.throttle || 0, this.isNitroActive ? 0.95 : 0);
          if (this.speed < currentTopSpeed) {
            const torqueFactor = Math.max(0.70, 1.0 - (this.speed / currentTopSpeed) * 0.30);
            const accel = throttlePower * currentAccelRate * torqueFactor;
            this.velocity.addScaledVector(forward, accel * dt);
          }
        } else if (input.brake > 0) {
          if (this.speed > 0.15) {
            // Rapid braking deceleration to quickly halt forward/sliding momentum
            const brakeDecel = Math.min(this.speed, input.brake * this.brakeRate * 1.30 * dt);
            this.velocity.addScaledVector(forward, -brakeDecel);
            // Rapidly cancel residual lateral slip when initiating reverse
            this.velocity.addScaledVector(right, -this.velocity.dot(right) * Math.min(1.0, 18.0 * dt));
          } else {
            // Instant reverse kick-in without any delay!
            if (this.speed > -this.reverseMaxSpeed) {
              this.velocity.addScaledVector(forward, -input.brake * (this.baseAccelRate * 1.1) * dt);
            }
          }
        } else {
          this.velocity.multiplyScalar(Math.pow(this.dragCoeff, dt * 60.0));
        }

        const currentLateral = this.velocity.dot(right);
        // Pacejka-inspired progressive lateral grip curve:
        // Razor-sharp initial turn-in at low slip, transitioning smoothly into progressive power-slide
        const baseGrip = MathUtils.lerp(34.0, 3.8, this.driftFactor);
        const slipRatio = Math.abs(currentLateral) / 2.5;
        const frictionCurve = 1.0 / (1.0 + Math.pow(slipRatio, 1.8) * 0.45);
        const effectiveGrip = baseGrip * frictionCurve;
        const lateralDecel = -currentLateral * Math.min(1.0, effectiveGrip * dt);
        this.velocity.addScaledVector(right, lateralDecel);
        this.lateralVelocity = this.velocity.dot(right);

        const wheelbase = this.wheelBaseHalf * 2;
        const forwardSpeed = this.velocity.dot(forward);
        const currentAbs = Math.abs(forwardSpeed);

        if (currentAbs <= 0.20) {
          // Stationary or dead-stop: vehicle CANNOT turn like a compass needle without rolling wheels or handbrake donut
          this.angularVelocity = MathUtils.lerp(this.angularVelocity, 0, 24.0 * dt);
          if (!input.throttle && !input.brake) {
            this.speed = 0;
            this.velocity.set(0, 0, 0);
          }
        } else {
          // True Ackermann kinematic yaw rate: strictly proportional to forward/reverse rolling wheel speed
          const tanSteer = Math.tan(this.steerAngle);
          const kinematicYawRate = (forwardSpeed / wheelbase) * tanSteer;
          const speedStabilizer = MathUtils.lerp(1.0, 0.78, MathUtils.clamp((currentAbs - 5.0) / 15.0, 0.0, 1.0));
          this.angularVelocity = MathUtils.lerp(this.angularVelocity, kinematicYawRate * speedStabilizer, 16.0 * dt);

          if (forwardSpeed < -0.15) {
            // Reversing: clamp yaw rate so vehicle turns realistically without whipping around into a donut
            this.angularVelocity = MathUtils.clamp(this.angularVelocity, -1.8, 1.8);

            // If handbrake is pulled while reversing, brake rapidly in a straight line with zero donut spin
            if (input.handbrake) {
              this.velocity.addScaledVector(forward, 24.0 * dt);
              this.angularVelocity = MathUtils.lerp(this.angularVelocity, 0, 16.0 * dt);
            }
          } else {
            // Rear-axle pivot correction: ensures car turns from the rear axle rather than spinning on center pivot
            const pivotCorrection = this.angularVelocity * this.wheelBaseHalf;
            this.velocity.addScaledVector(right, pivotCorrection * Math.min(1.0, 12.0 * dt));
          }

          this.heading += this.angularVelocity * dt;
        }
      }
    } else {
      this.heading += this.steerInput * 0.35 * dt;
    }

    // Recompute basis vectors at the updated heading
    const curForward = new Vec3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const curRight = new Vec3(Math.cos(this.heading), 0, -Math.sin(this.heading));
    this.speed = this.velocity.dot(curForward);
    const currentAbsSpeed = Math.abs(this.speed);

    // 4. INTEGRATE POSITION & RESOLVE HORIZONTAL COLLISIONS BEFORE GROUND SAMPLING
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    if (this.isAirborne) {
      this.airTime += dt;
      this.velocity.y -= this.gravity * dt;
      this.position.y += this.velocity.y * dt;
    }

    // 5. OBSTACLE & RAMP SIDE WALL COLLISIONS
    this.resolveCollisions();

    // 6. 4-WHEEL GROUND & RAMP HEIGHT SAMPLING (At the exact post-integration pose!)
    const flPos = this.position.clone()
      .addScaledVector(curForward, this.wheelBaseHalf)
      .addScaledVector(curRight, -this.trackHalfWidth);
    const frPos = this.position.clone()
      .addScaledVector(curForward, this.wheelBaseHalf)
      .addScaledVector(curRight, this.trackHalfWidth);
    const rlPos = this.position.clone()
      .addScaledVector(curForward, -this.wheelBaseHalf)
      .addScaledVector(curRight, -this.trackHalfWidth);
    const rrPos = this.position.clone()
      .addScaledVector(curForward, -this.wheelBaseHalf)
      .addScaledVector(curRight, this.trackHalfWidth);

    const refY = this.position.y;
    const gFL = this.samplePointGround(flPos.x, flPos.z, refY);
    const gFR = this.samplePointGround(frPos.x, frPos.z, refY);
    const gRL = this.samplePointGround(rlPos.x, rlPos.z, refY);
    const gRR = this.samplePointGround(rrPos.x, rrPos.z, refY);
    const gCenter = this.samplePointGround(this.position.x, this.position.z, refY);

    const hFront = (gFL.height + gFR.height) * 0.5;
    const hRear = (gRL.height + gRR.height) * 0.5;
    const hLeft = (gFL.height + gRL.height) * 0.5;
    const hRight = (gFR.height + gRR.height) * 0.5;

    // Tabletop sheer cliff-edge handling:
    // While center of mass (gCenter) is still supported on a high flat deck (gCenter > 0.8m) and front wheels cross the sheer edge (hFront < 0.2m),
    // keep the chassis level on the deck until gCenter crosses the cliff edge, then launch cleanly into free-fall!
    const isFrontOverCliff = (gCenter.height > 0.8 && hRear > 0.8 && hFront < 0.25);
    const isDrivingOffCliff = (!this.isAirborne && hRear > 0.8 && gCenter.height < 0.25 && hFront < 0.25);

    const effHFront = isFrontOverCliff ? gCenter.height : hFront;
    const targetSurfacePitch = isDrivingOffCliff ? 0 : -Math.atan2(effHFront - hRear, this.wheelBaseHalf * 2);
    const rawRoll = -Math.atan2(hLeft - hRight, this.trackHalfWidth * 2);
    const targetSurfaceRoll = MathUtils.clamp(rawRoll, -0.65, 0.65);

    const rampWheelCount = (gFL.isOnRamp ? 1 : 0) + (gFR.isOnRamp ? 1 : 0) + (gRL.isOnRamp ? 1 : 0) + (gRR.isOnRamp ? 1 : 0);
    const isOnRamp = (rampWheelCount >= 1) || gCenter.isOnRamp;
    this.isOnRamp = isOnRamp;

    // Update surface pitch/roll before computing exact rigid-body wheel clearance on slopes
    if (!this.isAirborne) {
      const pitchRate = isOnRamp ? 42.0 : 28.0;
      this.surfacePitch = MathUtils.lerp(this.surfacePitch, targetSurfacePitch, Math.min(1.0, pitchRate * dt));
      this.surfaceRoll = MathUtils.lerp(this.surfaceRoll, targetSurfaceRoll, Math.min(1.0, pitchRate * dt));
    }

    // Exact four-wheel & 3D chassis underbody contact elevation:
    // Because the ramp mesh itself uses a C1-smooth entry toe, launch incline, and parabolic crest arch,
    // axleCenterH keeps all 4 tires planted on the ramp surface while the 0.437m underbody naturally clears the crest!
    const axleCenterH = isDrivingOffCliff ? gCenter.height : (effHFront + hRear) * 0.5;
    const clampedPitch = MathUtils.clamp(-targetSurfacePitch, -0.60, 0.60);
    const sinP = Math.sin(clampedPitch);
    const cosP = Math.cos(clampedPitch);
    const tireSlopeLift = isOnRamp ? 0.355 * (1.0 / Math.max(0.85, cosP) - cosP) : 0;

    // 3D Rigid-Body Underbody & Bumper Guard (prevents compressed chassis or bumpers from ever clipping terrain)
    const comp = Math.max(0, this.suspensionOffset || 0);
    const bodyClearance = Math.max(0.24, 0.41 - comp) * cosP;
    const frontBumperPos = this.position.clone().addScaledVector(curForward, 2.16);
    const rearBumperPos = this.position.clone().addScaledVector(curForward, -2.16);
    const gFrontBumper = this.samplePointGround(frontBumperPos.x, frontBumperPos.z, refY);
    const gRearBumper = this.samplePointGround(rearBumperPos.x, rearBumperPos.z, refY);

    const frontGuardH = gFrontBumper.height - bodyClearance - 2.16 * sinP;
    const centerGuardH = gCenter.height - bodyClearance;
    const rearGuardH = gRearBumper.height - bodyClearance + 2.16 * sinP;

    const rawGroundH = isDrivingOffCliff
      ? gCenter.height
      : Math.max(axleCenterH + tireSlopeLift, frontGuardH, centerGuardH, rearGuardH);
    const targetGroundY = rawGroundH + this.roadLevel;

    const isOnCurb = gFL.isOnCurb || gFR.isOnCurb || gRL.isOnCurb || gRR.isOnCurb || gCenter.isOnCurb;
    this.isOnCurb = isOnCurb;
    if (isOnCurb && currentAbsSpeed > 1.8 && !this.isAirborne) {
      this.suspensionCompress += Math.sin(Date.now() * 0.045) * 0.015;
      if (rawGroundH > 0.03 && currentAbsSpeed > 3.0) {
        this.suspensionVelocity = Math.max(this.suspensionVelocity, Math.min(2.0, currentAbsSpeed * 0.07 * (rawGroundH / 0.12)));
      }
      if (window.gameApp && window.gameApp.audio && window.gameApp.audio.playCurbRumble) {
        window.gameApp.audio.playCurbRumble(currentAbsSpeed);
      }
    }

    // 7. VERTICAL DYNAMICS, TOUCHDOWN & RAMP APEX LAUNCH
    if (this.jumpLaunchCooldown > 0) {
      this.jumpLaunchCooldown -= dt;
    }

    if (this.isAirborne) {
      // Strictly prevent the vehicle from ever penetrating below targetGroundY on any airborne frame
      if (this.position.y < targetGroundY) {
        this.position.y = targetGroundY;
      }

      // Touchdown occurs when descending (velocity.y <= 0) and reaching ground/ramp elevation
      if (this.velocity.y <= 0 && this.position.y <= targetGroundY + 0.025) {
        const landingImpactSpeed = Math.max(0, -this.velocity.y);
        const priorAirTime = this.airTime;

        this.position.y = targetGroundY;
        this.isAirborne = false;
        this.airTime = 0;
        this.velocity.y = 0;

        // Smooth surface orientation transition on touchdown
        this.surfacePitch = MathUtils.lerp(this.surfacePitch, targetSurfacePitch, Math.min(1.0, 28.0 * dt));
        this.surfaceRoll = MathUtils.lerp(this.surfaceRoll, targetSurfaceRoll, Math.min(1.0, 28.0 * dt));

        // Sparks emit when landing jumps & ramp drops
        const isJumpLanding = (landingImpactSpeed > 0.6) || (priorAirTime > 0.12);

        if (isJumpLanding) {
          const impactRatio = Math.min(1.0, landingImpactSpeed / 3.0);
          this.suspensionVelocity = Math.min(4.4, landingImpactSpeed * 0.48);
          this.suspensionPitchOffset = Math.min(0.18, landingImpactSpeed * 0.026);

          // Arcade body wobble: dynamic roll oscillation across 0.35-0.45s
          this.landingWobble = 0.06 + impactRatio * 0.11;
          this.landingWobblePhase = (Math.random() > 0.5 ? 1 : -1) * 1.57;

          // Clean, vibrant line-sparks burst shooting up & outwards from ground on jump landing!
          const sparkCount = Math.floor(14 + impactRatio * 16);
          this.spawnSideSparks(sparkCount, 4.4 + impactRatio * 2.0);
        } else {
          this.suspensionVelocity = Math.min(2.5, landingImpactSpeed * 0.35);
          this.suspensionPitchOffset = Math.min(0.08, landingImpactSpeed * 0.018);
        }

        if (window.gameApp && window.gameApp.audio && window.gameApp.audio.playJumpLand) {
          window.gameApp.audio.playJumpLand();
        }
      } else {
        this.surfacePitch = MathUtils.lerp(this.surfacePitch, 0, 4.0 * dt);
        this.surfaceRoll = MathUtils.lerp(this.surfaceRoll, 0, 4.0 * dt);
      }

    } else {
      // Free-fall drop detection when driving off an elevated ledge or tabletop cliff
      const dropThreshold = (isOnRamp && !isDrivingOffCliff) ? 1.2 : 0.18;
      if (isDrivingOffCliff || this.position.y > targetGroundY + dropThreshold) {
        this.isAirborne = true;
        this.airTime = 0.01;
        this.jumpLaunchCooldown = 0.15;
        this.velocity.y = Math.min(0, this.velocity.y);

        this.skidHistoryL = [];
        this.skidHistoryR = [];
      } else {
        // Firmly supported by ground/ramp surface (zero teleportation, popping, or snapping)
        this.position.y = targetGroundY;
        this.velocity.y = 0;

        // Ramp launch triggers ONLY when vehicle center reaches/crosses the ramp apex (where the crest begins descending)
        const signedDistFromPeak = gCenter.isOnRamp ? (gCenter.rampLocalZ * Math.sign(gCenter.vLocalZ || 1)) : 999;
        const isAtApexClimbing = gCenter.isOnRamp &&
          Math.abs(gCenter.vLocalZ || 0) >= 8.0 &&
          signedDistFromPeak >= -0.15 &&
          signedDistFromPeak <= 1.15;

        if (isAtApexClimbing && currentAbsSpeed >= 9.5 && this.jumpLaunchCooldown <= 0) {
          const slopeAngle = Math.atan(gCenter.rampSlope || 0.314);
          const naturalVy = currentAbsSpeed * Math.sin(slopeAngle);

          if (currentAbsSpeed >= 16.5) {
            // High speed: full smooth launch from the ramp crest (zero position step snap!)
            this.isAirborne = true;
            this.airTime = 0.01;
            this.jumpLaunchCooldown = 0.45;
            this.velocity.y = Math.max(4.2, naturalVy * 0.90);
          } else {
            // Moderate speed: natural crest hop proportional to speed
            const rampFactor = (currentAbsSpeed - 9.5) / 7.0;
            const hopVy = naturalVy * (0.65 + 0.45 * rampFactor);
            if (hopVy > 1.2) {
              this.isAirborne = true;
              this.airTime = 0.01;
              this.jumpLaunchCooldown = 0.35;
              this.velocity.y = hopVy;
            }
          }

          if (this.isAirborne) {
            this.skidHistoryL = [];
            this.skidHistoryR = [];
          }
        }
      }
    }

    // 8. DYNAMIC CHASSIS SUSPENSION LEAN & HARMONIC IMPACT OSCILLATOR
    const targetDynRoll = MathUtils.clamp(-this.angularVelocity * (this.speed * 0.022), -0.075, 0.075);
    const targetDynPitch = MathUtils.clamp(-(input.throttle - input.brake) * 0.025, -0.045, 0.045);

    this.dynamicRoll = MathUtils.lerp(this.dynamicRoll, targetDynRoll, 14.0 * dt);
    this.dynamicPitch = MathUtils.lerp(this.dynamicPitch, targetDynPitch, 16.0 * dt);

    // Harmonic mass-spring-damper suspension simulation
    // When airborne, springs extend into droop (-0.05m). On ground, equilibrium is 0.
    const targetOffset = this.isAirborne ? -0.05 : 0.0;
    const kSpring = 135.0; // Spring stiffness
    const cDamp = 11.2;    // Shock absorber damping: under-damped so landing rebounds upward ("slight up") past equilibrium before settling smoothly
    const springForce = (targetOffset - this.suspensionOffset) * kSpring;
    const dampForce = -this.suspensionVelocity * cDamp;
    const springAccel = springForce + dampForce;

    this.suspensionVelocity += springAccel * dt;
    this.suspensionOffset += this.suspensionVelocity * dt;
    this.suspensionOffset = MathUtils.clamp(this.suspensionOffset, -0.08, 0.20); // Allows upward rebound ("slight up") of up to 8cm

    // Rebound nose pitch smoothly on touchdown
    this.suspensionPitchOffset = MathUtils.lerp(this.suspensionPitchOffset, 0, 6.0 * dt);

    // Landing wobble oscillation (side-to-side body wobble on landing)
    if (this.landingWobble > 0.001) {
      this.landingWobblePhase += 22.0 * dt; // snappy ~3.5 Hz oscillation
      this.landingWobble = Math.max(0, this.landingWobble - 0.40 * dt);
      this.chassisWobbleRoll = Math.sin(this.landingWobblePhase) * this.landingWobble;
    } else {
      this.landingWobble = 0;
      this.chassisWobbleRoll = 0;
    }

    this.visualRoll = this.surfaceRoll + this.dynamicRoll + this.chassisWobbleRoll;
    this.visualPitch = this.surfacePitch + this.dynamicPitch + this.suspensionPitchOffset;

    // Sync Havok rigid-body chassis proxy
    if (this.havokChassisMesh) {
      this.havokChassisMesh.position.set(this.position.x, this.position.y + 1.15, this.position.z);
      Quaternion.FromEulerAnglesToRef(this.visualPitch, this.heading, this.visualRoll, this.havokChassisMesh.rotationQuaternion);
    }

    // 8b. Independent 4-Wheel Articulation Offsets & Layman Telemetry Feed
    const calcWheelOffset = (gWheel, zSign, xSign) => {
      if (this.isAirborne) return -0.035;
      const planeH = rawGroundH + zSign * this.wheelBaseHalf * Math.sin(-this.surfacePitch) + xSign * this.trackHalfWidth * Math.sin(-this.surfaceRoll);
      return MathUtils.clamp(gWheel.height - planeH, -0.05, 0.12);
    };
    this.wheelOffsets.FL = MathUtils.lerp(this.wheelOffsets.FL || 0, calcWheelOffset(gFL, 1, -1), Math.min(1.0, 28.0 * dt));
    this.wheelOffsets.FR = MathUtils.lerp(this.wheelOffsets.FR || 0, calcWheelOffset(gFR, 1, 1), Math.min(1.0, 28.0 * dt));
    this.wheelOffsets.RL = MathUtils.lerp(this.wheelOffsets.RL || 0, calcWheelOffset(gRL, -1, -1), Math.min(1.0, 28.0 * dt));
    this.wheelOffsets.RR = MathUtils.lerp(this.wheelOffsets.RR || 0, calcWheelOffset(gRR, -1, 1), Math.min(1.0, 28.0 * dt));

    const underbodyWorldY = this.position.y + (0.437 - Math.max(0, this.suspensionOffset)) * Math.cos(this.visualPitch);
    const bellyClearanceM = Math.max(0.02, underbodyWorldY - (gCenter.height + this.roadLevel));

    const wheelState = (gW, offsetVal) => ({
      contact: this.isAirborne ? 'air' : (gW.isOnRamp ? 'ramp' : (gW.isOnCurb ? 'bump' : 'ground')),
      heightCm: Math.round(gW.height * 100),
      flexCm: Math.round(offsetVal * 100)
    });

    this.telemetry = {
      speedKmh: Math.round(currentAbsSpeed * 3.6),
      isReversing: this.speed < -0.15,
      isAirborne: this.isAirborne,
      airTimeSec: Number(this.airTime.toFixed(2)),
      airHeightM: Number(Math.max(0, this.position.y - this.roadLevel).toFixed(2)),
      isOnRamp: this.isOnRamp,
      isOnCurb: this.isOnCurb,
      isDrifting: this.isDrifting,
      bellyClearanceCm: Math.round(bellyClearanceM * 100),
      noseTiltDeg: Math.round((-this.visualPitch * 180) / Math.PI),
      sideTiltDeg: Math.round((this.visualRoll * 180) / Math.PI),
      shockBounceCm: Math.round(this.suspensionOffset * 100),
      activeSparks: this.sparkPool ? this.sparkPool.filter(p => p.active).length : 0,
      wheels: {
        FL: wheelState(gFL, this.wheelOffsets.FL),
        FR: wheelState(gFR, this.wheelOffsets.FR),
        RL: wheelState(gRL, this.wheelOffsets.RL),
        RR: wheelState(gRR, this.wheelOffsets.RR)
      }
    };

    // 9. SKIDS AND SMOKE
    this.updateSkidsAndSmoke(dt, curForward, curRight, input);
  }

  samplePointGround(x, z, referenceY = null) {
    let maxHeight = 0;
    let isOnRamp = false;
    let isNearPeak = false;
    let isOnCurb = false;
    let rampLocalZ = 0;
    let rampSlope = 0;
    let rampPeakH = 0;
    let vLocalZ = 0;

    // Prevent wheels on the road from snapping onto the top of a tall vertical ramp side wall
    const maxAllowedRampStep = (referenceY !== null) ? (referenceY - this.roadLevel + 0.72) : Infinity;

    for (const c of this.colliders) {
      if (c.type === 'ramp') {
        const dx = x - c.x;
        const dz = z - c.z;
        const cosA = Math.cos(c.angleY || 0);
        const sinA = Math.sin(c.angleY || 0);
        const localX = dx * cosA - dz * sinA;
        const localZ = dx * sinA + dz * cosA;

        const hw = c.width / 2;
        const hd = c.depth / 2;

        if (Math.abs(localX) <= hw && Math.abs(localZ) <= hd) {
          const distFromPeak = Math.abs(localZ);
          const h = c.evaluateProfile
            ? c.evaluateProfile(localZ, hd, c.height).height
            : Math.max(0, 1.0 - (distFromPeak / hd)) * c.height;

          if (!this.isAirborne && !this.isOnRamp && h > maxAllowedRampStep) {
            continue;
          }

          if (h > maxHeight) {
            maxHeight = h;
            isOnRamp = true;
            vLocalZ = this.velocity.x * sinA + this.velocity.z * cosA;
            const crestOffset = c.crestOffset || 0;
            rampLocalZ = localZ - Math.sign(vLocalZ || 1) * crestOffset;
            rampSlope = c.height / Math.max(1.0, hd - crestOffset);
            rampPeakH = c.height;
            if (Math.abs(rampLocalZ) < 0.95) {
              isNearPeak = true;
            }
          }
        }
      } else if (c.type === 'curb') {
        const dx = x - c.x;
        const dz = z - c.z;
        const cosA = Math.cos(c.angleY || 0);
        const sinA = Math.sin(c.angleY || 0);
        const lx = dx * cosA - dz * sinA;
        const lz = dx * sinA + dz * cosA;
        const hw = c.width / 2;
        const hl = c.length / 2;

        if (Math.abs(lx) <= hw && Math.abs(lz) <= hl) {
          const curbH = c.height || 0.08;
          if (curbH > maxHeight) {
            maxHeight = curbH;
            isOnCurb = true;
          }
        }
      } else if (c.type === 'speedbump') {
        const dx = x - c.x;
        const dz = z - c.z;
        const cosA = Math.cos(c.angleY || 0);
        const sinA = Math.sin(c.angleY || 0);
        const lx = dx * cosA - dz * sinA;
        const lz = dx * sinA + dz * cosA;
        const hw = c.width / 2;
        const hl = c.length / 2;

        if (Math.abs(lx) <= hw && Math.abs(lz) <= hl) {
          // Smooth raised-cosine profile: zero slope and zero height at entry/exit edges, peaking at center
          const v = (lz + hl) / (c.length || (hl * 2));
          const progress = 0.5 * (1.0 - Math.cos(v * (2.0 * Math.PI)));
          const bumpH = Math.max(0, (c.height || 0.12) * progress);
          if (bumpH > maxHeight) {
            maxHeight = bumpH;
            isOnCurb = true;
          }
        }
      }
    }

    // Havok WASM Raycast verification against static ramp & speedbump PhysicsShapeMesh colliders
    if (this.havokPlugin && (isOnRamp || isOnCurb)) {
      this.havokRayFrom.set(x, maxHeight + 0.35, z);
      this.havokRayTo.set(x, -0.20, z);
      this.havokRayResult.reset();
      this.havokPlugin.raycast(this.havokRayFrom, this.havokRayTo, this.havokRayResult);
      if (this.havokRayResult.hasHit && this.havokRayResult.body !== this.havokChassisAggregate?.body) {
        const hitY = this.havokRayResult.hitPointWorld.y;
        if (hitY <= maxAllowedRampStep && Math.abs(hitY - maxHeight) < 0.08) {
          maxHeight = Math.max(maxHeight, hitY);
        }
      }
    }

    return { height: maxHeight, isOnRamp, isNearPeak, isOnCurb, rampLocalZ, rampSlope, rampPeakH, vLocalZ };
  }

  resolveCollisions() {
    const halfL = this.length / 2;
    const halfW = this.halfCarWidth;
    const cosH = Math.cos(this.heading);
    const sinH = Math.sin(this.heading);
    const forward = new Vec3(sinH, 0, cosH);
    const right = new Vec3(cosH, 0, -sinH);

    for (const c of this.colliders) {
      if (c.type === 'box') {
        const hw = c.width / 2;
        const hd = c.depth / 2;
        const cosA = Math.cos(c.angleY || 0);
        const sinA = Math.sin(c.angleY || 0);

        const checkPoints = [
          { x: this.position.x + forward.x * halfL, z: this.position.z + forward.z * halfL },
          { x: this.position.x - forward.x * halfL, z: this.position.z - forward.z * halfL },
          { x: this.position.x + right.x * halfW, z: this.position.z + right.z * halfW },
          { x: this.position.x - right.x * halfW, z: this.position.z - right.z * halfW },
          { x: this.position.x + forward.x * halfL + right.x * halfW, z: this.position.z + forward.z * halfL + right.z * halfW },
          { x: this.position.x + forward.x * halfL - right.x * halfW, z: this.position.z + forward.z * halfL - right.z * halfW },
          { x: this.position.x - forward.x * halfL + right.x * halfW, z: this.position.z - forward.z * halfL + right.z * halfW },
          { x: this.position.x - forward.x * halfL - right.x * halfW, z: this.position.z - forward.z * halfL - right.z * halfW }
        ];

        let maxPen = 0;
        let penNormalX = 0;
        let penNormalZ = 0;

        for (const pt of checkPoints) {
          const dx = pt.x - c.x;
          const dz = pt.z - c.z;
          const lx = dx * cosA - dz * sinA;
          const lz = dx * sinA + dz * cosA;

          if (Math.abs(lx) < hw && Math.abs(lz) < hd) {
            const penX = hw - Math.abs(lx);
            const penZ = hd - Math.abs(lz);

            if (penX < penZ) {
              if (penX > maxPen) {
                maxPen = penX;
                const signX = Math.sign(lx) || 1;
                penNormalX = signX * cosA;
                penNormalZ = -signX * sinA;
              }
            } else {
              if (penZ > maxPen) {
                maxPen = penZ;
                const signZ = Math.sign(lz) || 1;
                penNormalX = signZ * sinA;
                penNormalZ = signZ * cosA;
              }
            }
          }
        }

        if (maxPen > 0) {
          const pushDist = maxPen + 0.02;
          this.position.x += penNormalX * pushDist;
          this.position.z += penNormalZ * pushDist;

          const vInward = this.velocity.x * (-penNormalX) + this.velocity.z * (-penNormalZ);
          if (vInward > 0) {
            this.velocity.x -= (-penNormalX) * vInward * 1.25;
            this.velocity.z -= (-penNormalZ) * vInward * 1.25;
            this.velocity.multiplyScalar(0.75);
          }
        }
      } else if (c.type === 'ramp') {
        const cosA = Math.cos(c.angleY || 0);
        const sinA = Math.sin(c.angleY || 0);
        const hw = c.width / 2;
        const hd = c.depth / 2;

        const dxCenter = this.position.x - c.x;
        const dzCenter = this.position.z - c.z;
        const carLocalX = dxCenter * cosA - dzCenter * sinA;
        const carLocalZ = dxCenter * sinA + dzCenter * cosA;

        // Exact projected radius of the oriented vehicle onto the ramp's local X and Z axes (SAT)
        // Accounts for front bumper, corners, and rear overhang at any approach angle
        const deltaTheta = this.heading - (c.angleY || 0);
        const radiusX = this.halfCarWidth * Math.abs(Math.cos(deltaTheta)) + halfL * Math.abs(Math.sin(deltaTheta));
        const radiusZ = this.halfCarWidth * Math.abs(Math.sin(deltaTheta)) + halfL * Math.abs(Math.cos(deltaTheta));

        if (carLocalZ + radiusZ < -hd || carLocalZ - radiusZ > hd) continue;

        const clampedZ = MathUtils.clamp(carLocalZ, -hd, hd);
        const rampH = c.evaluateProfile
          ? c.evaluateProfile(clampedZ, hd, c.height).height
          : Math.max(0, 1.0 - (Math.abs(clampedZ) / hd)) * c.height;

        // SOLID SIDE GABLE WALLS:
        // Only apply when the vehicle is OUTSIDE the ramp width (|carLocalX| > hw) on the road below!
        // Never apply when the vehicle is driving on top of the ramp or airborne
        if (this.isAirborne || this.isOnRamp || Math.abs(carLocalX) <= hw || this.position.y >= this.roadLevel + rampH - 0.35) continue;

        if (rampH > 0.20) {
          if (carLocalX > hw && (carLocalX - radiusX) < hw) {
            // Right gable wall (+hw)
            const penetration = hw - (carLocalX - radiusX);
            if (penetration > 0) {
              const normX = cosA;
              const normZ = -sinA;
              this.position.x += normX * (penetration + 0.02);
              this.position.z += normZ * (penetration + 0.02);

              const vInward = this.velocity.x * (-normX) + this.velocity.z * (-normZ);
              if (vInward > 0) {
                this.velocity.x -= (-normX) * vInward * 1.35;
                this.velocity.z -= (-normZ) * vInward * 1.35;
                this.velocity.multiplyScalar(0.70);
              }
              if (window.gameApp && window.gameApp.audio && window.gameApp.audio.playImpact) {
                window.gameApp.audio.playImpact(Math.abs(vInward));
              }
            }
          } else if (carLocalX < -hw && (carLocalX + radiusX) > -hw) {
            // Left gable wall (-hw)
            const penetration = (carLocalX + radiusX) - (-hw);
            if (penetration > 0) {
              const normX = -cosA;
              const normZ = sinA;
              this.position.x += normX * (penetration + 0.02);
              this.position.z += normZ * (penetration + 0.02);

              const vInward = this.velocity.x * (-normX) + this.velocity.z * (-normZ);
              if (vInward > 0) {
                this.velocity.x -= (-normX) * vInward * 1.35;
                this.velocity.z -= (-normZ) * vInward * 1.35;
                this.velocity.multiplyScalar(0.70);
              }
              if (window.gameApp && window.gameApp.audio && window.gameApp.audio.playImpact) {
                window.gameApp.audio.playImpact(Math.abs(vInward));
              }
            }
          }
        }
      } else if (c.type === 'cylinder') {
        const radius = c.radius || 0.28;
        const dx = c.x - this.position.x;
        const dz = c.z - this.position.z;
        const lx = dx * cosH - dz * sinH;
        const lz = dx * sinH + dz * cosH;

        const cx = MathUtils.clamp(lx, -halfW, halfW);
        const cz = MathUtils.clamp(lz, -halfL, halfL);

        const diffX = lx - cx;
        const diffZ = lz - cz;
        const dSq = diffX * diffX + diffZ * diffZ;

        if (dSq < radius * radius) {
          const d = Math.sqrt(dSq);
          let nLocalX, nLocalZ, pen;
          if (d > 0.001) {
            nLocalX = diffX / d;
            nLocalZ = diffZ / d;
            pen = radius - d;
          } else {
            const penRight = halfW - Math.abs(lx);
            const penFront = halfL - Math.abs(lz);
            if (penRight < penFront) {
              nLocalX = (Math.sign(lx) || 1);
              nLocalZ = 0;
              pen = radius + penRight;
            } else {
              nLocalX = 0;
              nLocalZ = (Math.sign(lz) || 1);
              pen = radius + penFront;
            }
          }

          const nWorldX = -(nLocalX * cosH + nLocalZ * sinH);
          const nWorldZ = -(-nLocalX * sinH + nLocalZ * cosH);

          const pushDist = pen + 0.03;
          this.position.x += nWorldX * pushDist;
          this.position.z += nWorldZ * pushDist;

          const vInward = this.velocity.x * (-nWorldX) + this.velocity.z * (-nWorldZ);
          if (vInward > 0) {
            this.velocity.x -= (-nWorldX) * vInward * 1.35;
            this.velocity.z -= (-nWorldZ) * vInward * 1.35;
            this.velocity.multiplyScalar(0.70);
            this.angularVelocity += (nLocalX * 1.8) * Math.sign(this.speed || 1);
          }

          if (window.gameApp && window.gameApp.audio && window.gameApp.audio.playImpact) {
            window.gameApp.audio.playImpact(Math.abs(vInward));
          }
        }
      }
    }
  }

  updateSkidsAndSmoke(dt, forward, right, input) {
    const absSpeed = Math.abs(this.speed);

    // 1. Wheel ground contact positions
    // Rear wheels (primary handbrake drift and braking tracks)
    const rlPos = this.position.clone()
      .addScaledVector(forward, -this.wheelBaseHalf)
      .addScaledVector(right, -this.trackHalfWidth);
    const rrPos = this.position.clone()
      .addScaledVector(forward, -this.wheelBaseHalf)
      .addScaledVector(right, this.trackHalfWidth);

    // Front wheels (track during high-speed hard braking)
    const flPos = this.position.clone()
      .addScaledVector(forward, this.wheelBaseHalf)
      .addScaledVector(right, -this.trackHalfWidth);
    const frPos = this.position.clone()
      .addScaledVector(forward, this.wheelBaseHalf)
      .addScaledVector(right, this.trackHalfWidth);

    const gRL = this.samplePointGround(rlPos.x, rlPos.z);
    const gRR = this.samplePointGround(rrPos.x, rrPos.z);
    rlPos.y = gRL.height + this.roadLevel + 0.006;
    rrPos.y = gRR.height + this.roadLevel + 0.006;

    const gFL = this.samplePointGround(flPos.x, flPos.z);
    const gFR = this.samplePointGround(frPos.x, frPos.z);
    flPos.y = gFL.height + this.roadLevel + 0.006;
    frPos.y = gFR.height + this.roadLevel + 0.006;

    const groundDistL = Math.abs(this.position.y - (gRL.height + this.roadLevel));
    const groundDistR = Math.abs(this.position.y - (gRR.height + this.roadLevel));
    const tiresFirmlyOnGround = !this.isAirborne && (this.isOnRamp || (groundDistL < 0.35 && groundDistR < 0.35));

    // 2. Skid Trigger Conditions (Strictly disabled when reversing)
    const isReversing = (this.speed < -0.05) || (input.brake > 0 && !input.throttle && this.speed <= 0.25);

    // A. High-speed forward braking: when travelling forward quickly and brakes are applied
    const isHighSpeedBrake = !isReversing && tiresFirmlyOnGround && this.speed > 3.2 && (input.brake > 0.15 || this.isBrakingHard);

    // B. Handbrake turn: when user applies handbrake to drift, powerslide, or donut (strictly forward only)
    const isDonutSkid = !isReversing && tiresFirmlyOnGround && input.handbrake && input.throttle > 0 && this.speed >= 0;
    const isHandbrakeSkid = !isReversing && tiresFirmlyOnGround && this.speed > 0.15 && (
      isDonutSkid ||
      (input.handbrake && (this.speed > 0.8 || input.throttle > 0)) ||
      ((this.isDrifting || input.handbrake) && this.speed > 1.0) ||
      (this.slipSpeed > 1.2 && this.speed > 1.6)
    );

    const shouldSkidRear = !isReversing && (isHighSpeedBrake || isHandbrakeSkid);
    const shouldSkidFront = !isReversing && isHighSpeedBrake && this.speed > 6.0;

    let meshNeedsUpdate = false;
    const tireHalfW = 0.13; // half tire width = 13cm (26cm wide tire tread mark)
    const treadRepeat = 0.80; // Repeat tire tread pattern every 80cm of road travel

    // Helper to record continuous tire tread quads strictly along the ground/ramp surface (never floating or rising vertically)
    const recordWheelSkid = (currPos, trackKey, wheelGround) => {
      const last = this[trackKey + 'Last'];
      if (!last) {
        const vL = [currPos.x - right.x * tireHalfW, currPos.y, currPos.z - right.z * tireHalfW];
        const vR = [currPos.x + right.x * tireHalfW, currPos.y, currPos.z + right.z * tireHalfW];
        this[trackKey + 'Last'] = { pos: currPos.clone(), vL, vR, vCoord: this[trackKey + 'V'] || 0 };
        return;
      }

      const dx = currPos.x - last.pos.x;
      const dz = currPos.z - last.pos.z;
      const dy = currPos.y - last.pos.y;
      const dist = Math.hypot(dx, dz);

      // If there is any sudden vertical step or slope discontinuity (e.g. stepping onto/off an obstacle),
      // break the skid chain rather than drawing an upward-pointing vertical ribbon!
      if (Math.abs(dy) > 0.08 || (dist > 0.001 && Math.abs(dy) / dist > 0.42)) {
        const vL = [currPos.x - right.x * tireHalfW, currPos.y, currPos.z - right.z * tireHalfW];
        const vR = [currPos.x + right.x * tireHalfW, currPos.y, currPos.z + right.z * tireHalfW];
        this[trackKey + 'Last'] = { pos: currPos.clone(), vL, vR, vCoord: this[trackKey + 'V'] || 0 };
        return;
      }

      if (dist >= 0.18) { // Add quad segment every 18cm for smooth curved arcs
        // Keep both vertices of the new cross-section flush with the surface at currPos.y
        const flatY = (!wheelGround?.isOnRamp && !wheelGround?.isOnCurb) ? (this.roadLevel + 0.006) : currPos.y;
        const vL = [currPos.x - right.x * tireHalfW, flatY, currPos.z - right.z * tireHalfW];
        const vR = [currPos.x + right.x * tireHalfW, flatY, currPos.z + right.z * tireHalfW];
        const nextV = last.vCoord + dist / treadRepeat;

        this.skidSegments.push({
          v0: last.vL,
          v1: last.vR,
          v2: vL,
          v3: vR,
          uv0: [0, last.vCoord],
          uv1: [1, last.vCoord],
          uv2: [0, nextV],
          uv3: [1, nextV]
        });

        if (this.skidSegments.length > this.maxSkidQuads) {
          this.skidSegments.shift();
        }

        const nextPos = currPos.clone();
        nextPos.y = flatY;
        this[trackKey + 'Last'] = { pos: nextPos, vL, vR, vCoord: nextV };
        this[trackKey + 'V'] = nextV;
        meshNeedsUpdate = true;
      }
    };

    if (shouldSkidRear) {
      recordWheelSkid(rlPos, 'RL', gRL);
      recordWheelSkid(rrPos, 'RR', gRR);
    } else {
      this.RLLast = null;
      this.RRLast = null;
    }

    if (shouldSkidFront) {
      recordWheelSkid(flPos, 'FL', gFL);
      recordWheelSkid(frPos, 'FR', gFR);
    } else {
      this.FLLast = null;
      this.FRLast = null;
    }

    // Standalone, highly responsive tire smoke emission:
    // Triggers reliably on handbrake, donuts, burnouts, drifts, slides, hard braking, and wheelspin (strictly disabled in reverse)
    const isBurnout = !isReversing && input.handbrake && input.throttle > 0 && this.speed >= 0;
    const isHandbrakeSlide = !isReversing && input.handbrake && (absSpeed > 0.6 || input.throttle > 0);
    const isDriftSlide = !isReversing && this.isDrifting && absSpeed > 1.0;
    const isLateralSlip = !isReversing && this.slipSpeed > 0.7 && absSpeed > 1.2;
    const isBrakingSkid = !isReversing && (input.brake > 0.25 || this.isBrakingHard) && absSpeed > 2.0;
    const isWheelSpinLaunch = !isReversing && input.throttle > 0.85 && absSpeed < 2.5 && !input.brake;

    const isSmokeTriggered = !this.isAirborne && !isReversing && (
      isBurnout ||
      isHandbrakeSlide ||
      isDriftSlide ||
      isLateralSlip ||
      isBrakingSkid ||
      isWheelSpinLaunch
    );

    if (isSmokeTriggered) {
      this.smokeSpawnTimer = (this.smokeSpawnTimer || 0) + dt;
      if (this.smokeSpawnTimer >= 0.050) {
        this.smokeSpawnTimer = 0;
        this.smokeWheelToggle = !this.smokeWheelToggle;
        if (isBurnout || isDriftSlide || isHandbrakeSlide || isBrakingSkid) {
          this.spawnSmoke(rlPos);
          this.spawnSmoke(rrPos);
        } else if (this.smokeWheelToggle) {
          this.spawnSmoke(rlPos);
        } else {
          this.spawnSmoke(rrPos);
        }
      }
    } else {
      this.smokeSpawnTimer = 0.050; // Ready to spawn immediately upon next drift/brake
    }

    // Update active pooled billboard smoke puffs
    if (this.smokePool) {
      for (let i = 0; i < this.smokePoolSize; i++) {
        const p = this.smokePool[i];
        if (!p.active) continue;

        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.mesh.isVisible = false;
          p.mesh.visibility = 0;
          continue;
        }

        p.scale += p.growthRate * dt;
        p.mesh.scaling.set(p.scale, p.scale, p.scale);
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.rotation.z += p.rotSpeed * dt;
        const progress = p.life / p.maxLife;
        p.mesh.visibility = Math.max(0, p.initialAlpha * (1.0 - progress * progress));
      }
    }

    // Update arcade ground sparks simulation
    this.updateSparks(dt);

    // Rebuild tire tread marks mesh
    if (meshNeedsUpdate && this.skidSegments.length > 0) {
      this.rebuildSkidMesh();
    }
  }

  rebuildSkidMesh() {
    const numQuads = this.skidSegments.length;
    const positions = new Float32Array(numQuads * 12);
    const uvs = new Float32Array(numQuads * 8);
    const normals = new Float32Array(numQuads * 12);
    const indices = new Uint32Array(numQuads * 6);

    for (let i = 0; i < numQuads; i++) {
      const q = this.skidSegments[i];
      const vOffset = i * 4;
      const pOffset = i * 12;
      const uvOffset = i * 8;
      const iOffset = i * 6;

      positions[pOffset] = q.v0[0];     positions[pOffset + 1] = q.v0[1]; positions[pOffset + 2] = q.v0[2];
      positions[pOffset + 3] = q.v1[0]; positions[pOffset + 4] = q.v1[1]; positions[pOffset + 5] = q.v1[2];
      positions[pOffset + 6] = q.v2[0]; positions[pOffset + 7] = q.v2[1]; positions[pOffset + 8] = q.v2[2];
      positions[pOffset + 9] = q.v3[0]; positions[pOffset + 10] = q.v3[1]; positions[pOffset + 11] = q.v3[2];

      normals[pOffset + 1] = 1;
      normals[pOffset + 4] = 1;
      normals[pOffset + 7] = 1;
      normals[pOffset + 10] = 1;

      uvs[uvOffset] = q.uv0[0];     uvs[uvOffset + 1] = q.uv0[1];
      uvs[uvOffset + 2] = q.uv1[0]; uvs[uvOffset + 3] = q.uv1[1];
      uvs[uvOffset + 4] = q.uv2[0]; uvs[uvOffset + 5] = q.uv2[1];
      uvs[uvOffset + 6] = q.uv3[0]; uvs[uvOffset + 7] = q.uv3[1];

      indices[iOffset] = vOffset;
      indices[iOffset + 1] = vOffset + 1;
      indices[iOffset + 2] = vOffset + 2;
      indices[iOffset + 3] = vOffset + 2;
      indices[iOffset + 4] = vOffset + 1;
      indices[iOffset + 5] = vOffset + 3;
    }

    const vd = new VertexData();
    vd.positions = positions;
    vd.normals = normals;
    vd.uvs = uvs;
    vd.indices = indices;
    vd.applyToMesh(this.skidMesh, true);
  }

  reset(x = 2.4, z = -35, heading = 0) {
    this.position.set(x, this.roadLevel, z);
    this.velocity.set(0, 0, 0);
    this.heading = heading;
    this.speed = 0;
    this.angularVelocity = 0;
    this.steerInput = 0;
    this.steerAngle = 0;
    this.surfacePitch = 0;
    this.surfaceRoll = 0;
    this.dynamicPitch = 0;
    this.dynamicRoll = 0;
    this.suspensionCompress = 0;
    this.suspensionOffset = 0;
    this.suspensionVelocity = 0;
    this.suspensionPitchOffset = 0;
    this.landingWobble = 0;
    this.landingWobblePhase = 0;
    this.chassisWobbleRoll = 0;
    this.scrapeSparkTimer = 0;
    this.wheelOffsets = { FL: 0, FR: 0, RL: 0, RR: 0 };
    if (this.sparkPool) {
      for (let i = 0; i < this.sparkPoolSize; i++) {
        this.sparkPool[i].active = false;
        this.sparkPool[i].mesh.isVisible = false;
        this.sparkPool[i].mesh.visibility = 0;
      }
    }
    this.isAirborne = false;
    this.isOnRamp = false;
    this.isOnCurb = false;
    this.airTime = 0;
    this.jumpLaunchCooldown = 0;
    this.isDrifting = false;
    this.isDonut = false;
    this.driftFactor = 0;
  }
}
