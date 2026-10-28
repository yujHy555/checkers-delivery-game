import * as THREE from 'three';

export class CameraManager {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Start in Third-Person Chase Cam by default
    this.mode = 'THIRD_PERSON';

    // Current camera position and look target
    this.currentPos = new THREE.Vector3(0, 5, -45);
    this.currentTarget = new THREE.Vector3(0, 0, -35);

    // Dynamic Follow Speeds
    this.posLerpSpeed = 9.0;
    this.targetLerpSpeed = 14.0;

    // Third-Person Chase settings
    this.chaseDistance = 5.6;
    this.chaseHeight = 2.45;
    this.baseFov = 62;
    this.hasInitChase = false;

    // Immediately place camera in proper third-person chase pose at van's spawn
    this.currentPos = new THREE.Vector3(0, 2.8, -45.85);
    this.currentTarget = new THREE.Vector3(0, 1.27, -37.5);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentTarget);
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
    // For mobile devices, isometric mode is completely removed: strictly lock to Third-Person Chase
    if (this.checkIsMobile()) {
      this.mode = 'THIRD_PERSON';
      this.hasInitIso = false;
      return this.mode;
    }

    // On PC / Desktop: cycle between Third-Person -> Isometric Close -> Isometric Wide Overview
    if (this.mode === 'THIRD_PERSON') {
      this.mode = 'ISOMETRIC_CLOSE';
    } else if (this.mode === 'ISOMETRIC_CLOSE' || this.mode === 'ISOMETRIC') {
      this.mode = 'ISOMETRIC_FAR';
    } else {
      this.mode = 'THIRD_PERSON';
    }
    this.hasInitIso = false;
    return this.mode;
  }

  setMode(mode) {
    if (this.checkIsMobile()) {
      this.mode = 'THIRD_PERSON';
      this.hasInitIso = false;
      return;
    }
    if (mode === 'THIRD_PERSON' || mode === 'ISOMETRIC_CLOSE' || mode === 'ISOMETRIC_FAR' || mode === 'ISOMETRIC') {
      this.mode = mode === 'ISOMETRIC' ? 'ISOMETRIC_CLOSE' : mode;
      this.hasInitIso = false;
    }
  }

  snap(focusObject, vehiclePhysics) {
    if (!focusObject || !vehiclePhysics) return;
    const focusPos = focusObject.position;
    const heading = vehiclePhysics.heading;
    const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));

    const baseDist = 5.6;
    const baseHeight = 2.45;
    this.currentPos.copy(focusPos)
      .addScaledVector(forward, -baseDist)
      .add(new THREE.Vector3(0, baseHeight, 0));
    this.currentTarget.copy(focusPos)
      .addScaledVector(forward, 2.5)
      .add(new THREE.Vector3(0, 0.92, 0));

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentTarget);
    this.hasInitChase = true;
  }

  update(dt, focusObject, vehiclePhysics) {
    if (!focusObject) return;

    const isMobile = this.checkIsMobile();
    const isIsometric = (this.mode === 'ISOMETRIC_CLOSE' || this.mode === 'ISOMETRIC_FAR' || this.mode === 'ISOMETRIC') && !isMobile;

    if (!isIsometric && !this.hasInitChase) {
      this.snap(focusObject, vehiclePhysics);
      return;
    }

    const focusPos = focusObject.position;
    const heading = vehiclePhysics.heading;
    const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));

    if (isIsometric) {
      const isFar = this.mode === 'ISOMETRIC_FAR';

      // 1. Rock-solid fixed FOV
      // 48° for close isometric view, 52° for wide tactical bird's eye view
      const targetFov = isFar ? 52 : 48;
      if (Math.abs(this.camera.fov - targetFov) > 0.05) {
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 10.0 * dt);
        this.camera.updateProjectionMatrix();
      }

      // 2. Camera distance & altitude:
      // Close: isoDist = 12.0, isoHeight = 14.0 (tight focus on van)
      // Far:   isoDist = 26.0, isoHeight = 30.0 (wide tactical view of city, ramps, track)
      const isoDist = isFar ? 26.0 : 12.0;
      const isoHeight = isFar ? 30.0 : 14.0;

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
        const turnRate = isFar ? 5.5 : 7.0;
        this.isoCamHeading += diff * (1.0 - Math.exp(-turnRate * dt));
      }

      const sinH = Math.sin(this.isoCamHeading);
      const cosH = Math.cos(this.isoCamHeading);

      // Spherical orbital positioning: radius is constant, zero chord cutting
      desiredPos.set(
        focusPos.x - sinH * isoDist,
        focusPos.y + isoHeight,
        focusPos.z - cosH * isoDist
      );

      // Target locked to van chassis center
      desiredTarget.set(focusPos.x, focusPos.y + 0.75, focusPos.z);

      // Building Obstacle Clearance & White Flash Elimination:
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

      // Smooth exponential follow
      const followRate = isFar ? 8.0 : 11.0;
      const lerpFactor = 1.0 - Math.exp(-followRate * dt);
      this.currentPos.lerp(desiredPos, lerpFactor);
      this.currentTarget.lerp(desiredTarget, lerpFactor);

    } else {
      this.hasInitIso = false;
      // Dynamic Third-Person Chase Cam (Tightly tuned for PC, iOS & Android so car NEVER pulls away on acceleration)
      const baseDist = 5.6;
      const baseHeight = 2.45;
      const speedNorm = Math.min(1.0, Math.abs(vehiclePhysics.speed) / vehiclePhysics.maxSpeed);
      const dynamicDist = baseDist + speedNorm * 0.25;
      const dynamicHeight = baseHeight + speedNorm * 0.10;

      // Position camera directly behind vehicle with smooth follow
      desiredPos.copy(focusPos)
        .addScaledVector(forward, -dynamicDist)
        .add(new THREE.Vector3(0, dynamicHeight, 0));

      // Look ahead along forward vector
      desiredTarget.copy(focusPos)
        .addScaledVector(forward, 2.5)
        .add(new THREE.Vector3(0, 0.92, 0));

      // Minimal subtle speed FOV expansion (3.5° max so van doesn't pull away visually)
      const baseFov = 62;
      const targetFov = baseFov + speedNorm * 3.5;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 12.0 * dt);
      this.camera.updateProjectionMatrix();

      // Building clearance check for Third Person (strictly applies to skyscrapers/buildings)
      if (this.colliders) {
        for (const c of this.colliders) {
          if (c.type === 'box' && c.isBuilding) {
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

      // Snappy camera damping: eliminates lag and rubber-banding on rapid launches across PC, iOS, and Mobile
      const activePosLerp = 22.0;
      const activeTargetLerp = 25.0;
      const posLerp = 1.0 - Math.exp(-activePosLerp * dt);
      const targetLerp = 1.0 - Math.exp(-activeTargetLerp * dt);
      this.currentPos.lerp(desiredPos, posLerp);
      this.currentTarget.lerp(desiredTarget, targetLerp);
    }

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentTarget);
  }
}
