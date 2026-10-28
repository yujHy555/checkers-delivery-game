import * as THREE from 'three';

export class CameraManager {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Start in Third-Person Chase Cam by default for immediate intuitive driving!
    this.mode = 'THIRD_PERSON';

    // Current camera position and look target
    this.currentPos = new THREE.Vector3(0, 5, -45);
    this.currentTarget = new THREE.Vector3(0, 0, -35);

    // Dynamic Follow Speeds
    this.posLerpSpeed = 9.0;
    this.targetLerpSpeed = 14.0;

    // Third-Person Chase settings
    this.chaseDistance = 6.4;
    this.chaseHeight = 2.6;
    this.baseFov = 62;

    // Isometric tracking state
    this.isoCamHeading = 0;
    this.hasInitIso = false;
    this.colliders = [];
  }

  setColliders(colliders) {
    this.colliders = colliders || [];
  }

  checkIsMobile() {
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      (window.innerWidth <= 960 && 'ontouchstart' in window);
  }

  toggleMode() {
    this.mode = this.mode === 'THIRD_PERSON' ? 'ISOMETRIC' : 'THIRD_PERSON';
    this.hasInitIso = false;
    return this.mode;
  }

  setMode(mode) {
    if (mode === 'ISOMETRIC' || mode === 'THIRD_PERSON') {
      this.mode = mode;
      this.hasInitIso = false;
    }
  }

  update(dt, focusObject, vehiclePhysics) {
    if (!focusObject) return;

    const focusPos = focusObject.position;
    const heading = vehiclePhysics.heading;
    const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const isMobile = this.checkIsMobile();

    let desiredPos = new THREE.Vector3();
    let desiredTarget = new THREE.Vector3();

    if (this.mode === 'ISOMETRIC') {
      // 1. Rock-solid fixed FOV (50° on mobile, 48° on desktop)
      // Completely eliminates disorienting FOV zoom pumping on throttle/brake!
      const targetFov = isMobile ? 50 : 48;
      if (Math.abs(this.camera.fov - targetFov) > 0.05) {
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 10.0 * dt);
        this.camera.updateProjectionMatrix();
      }

      // 2. Elevated isometric vantage: optimal viewing angle and altitude above building rooftops
      const isoDist = isMobile ? 9.8 : 12.0;
      const isoHeight = isMobile ? 11.8 : 14.0;

      if (!this.hasInitIso) {
        this.isoCamHeading = heading;
        this.hasInitIso = true;
        const sinH = Math.sin(this.isoCamHeading);
        const cosH = Math.cos(this.isoCamHeading);
        this.currentPos.set(
          focusPos.x - sinH * isoDist,
          focusPos.y + isoHeight,
          focusPos.z - cosH * isoDist
        );
        this.currentTarget.set(focusPos.x, focusPos.y + 0.75, focusPos.z);
      } else {
        // Smoothly rotate the orbital angle behind vehicle heading via shortest arc
        let diff = heading - this.isoCamHeading;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        const turnRate = isMobile ? 8.5 : 7.0;
        this.isoCamHeading += diff * (1.0 - Math.exp(-turnRate * dt));
      }

      const sinH = Math.sin(this.isoCamHeading);
      const cosH = Math.cos(this.isoCamHeading);

      // Desired position is mathematically locked to a constant spherical orbital radius
      // Never cuts across the chord during turns, eliminating camera surge / chugging
      desiredPos.set(
        focusPos.x - sinH * isoDist,
        focusPos.y + isoHeight,
        focusPos.z - cosH * isoDist
      );

      // Target is locked to van chassis center (zero look-ahead pitch tilt oscillation)
      desiredTarget.set(focusPos.x, focusPos.y + 0.75, focusPos.z);

      // Building Obstacle Clearance & White Flash Elimination:
      // If the camera is inside or near any building footprint, smoothly elevate above the roof (+2.0m buffer)
      if (this.colliders) {
        for (const c of this.colliders) {
          if (c.type === 'box') {
            const hw = (c.width / 2) + 1.2;
            const hd = (c.depth / 2) + 1.2;
            const bHeight = c.height || 12.0;

            if (Math.abs(desiredPos.x - c.x) <= hw && Math.abs(desiredPos.z - c.z) <= hd) {
              if (desiredPos.y < bHeight + 2.0) {
                desiredPos.y = bHeight + 2.0;
              }
            }
            if (Math.abs(this.currentPos.x - c.x) <= hw && Math.abs(this.currentPos.z - c.z) <= hd) {
              if (this.currentPos.y < bHeight + 1.5) {
                this.currentPos.y = bHeight + 1.5;
              }
            }
          }
        }
      }

      // Critically damped exponential smoothing for ultra-smooth buttery motion
      const followRate = isMobile ? 14.0 : 11.0;
      const lerpFactor = 1.0 - Math.exp(-followRate * dt);
      this.currentPos.lerp(desiredPos, lerpFactor);
      this.currentTarget.lerp(desiredTarget, lerpFactor);

    } else {
      this.hasInitIso = false;
      // Dynamic Third-Person Chase Cam (Moved closer towards van on mobile!)
      const baseDist = isMobile ? 4.6 : 6.4;
      const baseHeight = isMobile ? 1.95 : 2.6;
      const speedNorm = Math.min(1.0, Math.abs(vehiclePhysics.speed) / vehiclePhysics.maxSpeed);
      const dynamicDist = baseDist + speedNorm * (isMobile ? 1.1 : 1.8);
      const dynamicHeight = baseHeight + speedNorm * (isMobile ? 0.3 : 0.45);

      // Position camera directly behind vehicle with smooth follow
      desiredPos.copy(focusPos)
        .addScaledVector(forward, -dynamicDist)
        .add(new THREE.Vector3(0, dynamicHeight, 0));

      // Look ahead along forward vector
      desiredTarget.copy(focusPos)
        .addScaledVector(forward, isMobile ? 2.5 : 3.2)
        .add(new THREE.Vector3(0, isMobile ? 0.82 : 0.9, 0));

      // Speed FOV expansion
      const baseFov = isMobile ? 64 : 62;
      const targetFov = baseFov + speedNorm * (isMobile ? 10.0 : 14.0);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 6.0 * dt);
      this.camera.updateProjectionMatrix();

      // Building clearance check for Third Person as well
      if (this.colliders) {
        for (const c of this.colliders) {
          if (c.type === 'box') {
            const hw = (c.width / 2) + 0.8;
            const hd = (c.depth / 2) + 0.8;
            const bHeight = c.height || 12.0;

            if (Math.abs(desiredPos.x - c.x) <= hw && Math.abs(desiredPos.z - c.z) <= hd) {
              if (desiredPos.y < bHeight + 1.5) {
                desiredPos.y = bHeight + 1.5;
              }
            }
            if (Math.abs(this.currentPos.x - c.x) <= hw && Math.abs(this.currentPos.z - c.z) <= hd) {
              if (this.currentPos.y < bHeight + 1.5) {
                this.currentPos.y = bHeight + 1.5;
              }
            }
          }
        }
      }

      // Smooth camera damping
      const posLerp = 1.0 - Math.exp(-this.posLerpSpeed * dt);
      const targetLerp = 1.0 - Math.exp(-this.targetLerpSpeed * dt);
      this.currentPos.lerp(desiredPos, posLerp);
      this.currentTarget.lerp(desiredTarget, targetLerp);
    }

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentTarget);
  }
}
