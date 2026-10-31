import { Vector3, Tools } from '@babylonjs/core';

export class CameraManager {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;

    // Start in Third-Person Chase Cam by default
    this.mode = 'THIRD_PERSON';

    // Current camera position and look target
    this.currentPos = new Vector3(0, 2.95, -46.65);
    this.currentTarget = new Vector3(0, 1.27, -37.5);
    this.desiredPos = new Vector3(0, 2.95, -46.65);
    this.desiredTarget = new Vector3(0, 1.27, -37.5);

    this.baseFov = 62 * (Math.PI / 180);
    this.camera.fov = this.baseFov;

    this.camera.position.copyFrom(this.currentPos);
    this.camera.setTarget(this.currentTarget);

    this.isoCamHeading = 0;
    this.hasInitIso = false;
    this.hasInitChase = false;
    this.colliders = [];

    // High-speed subtle camera wobble / shake state
    this.shakeTime = 0;
    this.currentShakeIntensity = 0;
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
    if (this.checkIsMobile()) {
      this.mode = 'THIRD_PERSON';
      this.hasInitIso = false;
      return this.mode;
    }

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
    const forwardX = Math.sin(heading);
    const forwardZ = Math.cos(heading);

    const baseDist = 6.4;
    const baseHeight = 2.45;

    this.currentPos.set(
      focusPos.x - forwardX * baseDist,
      focusPos.y + baseHeight,
      focusPos.z - forwardZ * baseDist
    );
    this.currentTarget.set(
      focusPos.x + forwardX * 2.5,
      focusPos.y + 1.15,
      focusPos.z + forwardZ * 2.5
    );

    this.camera.position.copyFrom(this.currentPos);
    this.camera.setTarget(this.currentTarget);
    this.desiredPos.copyFrom(this.currentPos);
    this.desiredTarget.copyFrom(this.currentTarget);
    this.hasInitChase = true;
  }

  update(dt, focusObject, vehiclePhysics) {
    if (!focusObject || !vehiclePhysics) return;

    const isMobile = this.checkIsMobile();
    const isIsometric = (this.mode === 'ISOMETRIC_CLOSE' || this.mode === 'ISOMETRIC_FAR' || this.mode === 'ISOMETRIC') && !isMobile;

    if (!isIsometric && !this.hasInitChase) {
      this.snap(focusObject, vehiclePhysics);
      return;
    }

    const focusPos = focusObject.position;
    const heading = vehiclePhysics.heading;
    const forwardX = Math.sin(heading);
    const forwardZ = Math.cos(heading);

    if (isIsometric) {
      const isFar = this.mode === 'ISOMETRIC_FAR';
      const targetFov = (isFar ? 52 : 48) * (Math.PI / 180);
      if (Math.abs(this.camera.fov - targetFov) > 0.001) {
        this.camera.fov = this.camera.fov + (targetFov - this.camera.fov) * Math.min(1.0, 10.0 * dt);
      }

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
        let diff = heading - this.isoCamHeading;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        const turnRate = isFar ? 5.5 : 7.0;
        this.isoCamHeading += diff * (1.0 - Math.exp(-turnRate * dt));
      }

      const sinH = Math.sin(this.isoCamHeading);
      const cosH = Math.cos(this.isoCamHeading);

      this.desiredPos.set(
        focusPos.x - sinH * isoDist,
        focusPos.y + isoHeight,
        focusPos.z - cosH * isoDist
      );
      this.desiredTarget.set(focusPos.x, focusPos.y + 0.75, focusPos.z);

      // Building clearance
      if (this.colliders) {
        for (const c of this.colliders) {
          if (c.type === 'box') {
            const hw = (c.width / 2) + 1.2;
            const hd = (c.depth / 2) + 1.2;
            const bHeight = c.height || 12.0;

            if (Math.abs(this.desiredPos.x - c.x) <= hw && Math.abs(this.desiredPos.z - c.z) <= hd) {
              if (this.desiredPos.y < bHeight + 2.0) {
                this.desiredPos.y = bHeight + 2.0;
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

      const followRate = isFar ? 8.0 : 11.0;
      const lerpFactor = 1.0 - Math.exp(-followRate * dt);
      Vector3.LerpToRef(this.currentPos, this.desiredPos, lerpFactor, this.currentPos);
      Vector3.LerpToRef(this.currentTarget, this.desiredTarget, lerpFactor, this.currentTarget);

    } else {
      this.hasInitIso = false;
      const baseDist = 6.4;
      const baseHeight = 2.45;
      const speedNorm = Math.min(1.0, Math.abs(vehiclePhysics.speed) / (vehiclePhysics.maxSpeed || 20.0));
      const dynamicDist = baseDist + speedNorm * 0.30;
      const dynamicHeight = baseHeight + speedNorm * 0.12;

      let trackDirX = forwardX;
      let trackDirZ = forwardZ;
      const vel = vehiclePhysics.velocity;
      if (vel) {
        const velSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
        if (velSpeed > 2.0) {
          const velNormX = vel.x / velSpeed;
          const velNormZ = vel.z / velSpeed;
          // Velocity-Aligned Camera Lookahead: Blends smoothly toward vehicle velocity during slides & drifts
          const driftBlend = Math.min(0.40, (vehiclePhysics.driftFactor || 0) * 0.38 + (Math.abs(vehiclePhysics.lateralVelocity || 0) / 10.0) * 0.22);
          trackDirX = forwardX * (1.0 - driftBlend) + velNormX * driftBlend;
          trackDirZ = forwardZ * (1.0 - driftBlend) + velNormZ * driftBlend;
          const len = Math.sqrt(trackDirX * trackDirX + trackDirZ * trackDirZ) || 1.0;
          trackDirX /= len;
          trackDirZ /= len;
        }
      }

      this.desiredPos.set(
        focusPos.x - trackDirX * dynamicDist,
        focusPos.y + dynamicHeight,
        focusPos.z - trackDirZ * dynamicDist
      );
      this.desiredTarget.set(
        focusPos.x + trackDirX * 2.5,
        focusPos.y + 1.15,
        focusPos.z + trackDirZ * 2.5
      );

      const targetFov = (62 + speedNorm * 3.5) * (Math.PI / 180);
      this.camera.fov = this.camera.fov + (targetFov - this.camera.fov) * Math.min(1.0, 12.0 * dt);

      // Building & Ramp clearance
      if (this.colliders) {
        for (const c of this.colliders) {
          if (c.type === 'box' && c.isBuilding) {
            const hw = (c.width / 2) + 0.8;
            const hd = (c.depth / 2) + 0.8;
            const bHeight = c.height || 12.0;

            if (Math.abs(this.desiredPos.x - c.x) <= hw && Math.abs(this.desiredPos.z - c.z) <= hd) {
              if (this.desiredPos.y < bHeight + 1.5) {
                this.desiredPos.y = bHeight + 1.5;
              }
            }
            if (Math.abs(this.currentPos.x - c.x) <= hw && Math.abs(this.currentPos.z - c.z) <= hd) {
              if (this.currentPos.y < bHeight + 1.5) {
                this.currentPos.y = bHeight + 1.5;
              }
            }
          } else if (c.type === 'ramp') {
            const cosA = Math.cos(c.angleY || 0);
            const sinA = Math.sin(c.angleY || 0);
            const hw = (c.width / 2) + 0.6;
            const hd = (c.depth / 2) + 0.6;

            // Desired camera position clearance over ramp
            const dxDes = this.desiredPos.x - c.x;
            const dzDes = this.desiredPos.z - c.z;
            const lxDes = dxDes * cosA - dzDes * sinA;
            const lzDes = dxDes * sinA + dzDes * cosA;

            if (Math.abs(lxDes) <= hw && Math.abs(lzDes) <= hd) {
              const rH = Math.max(0, 1.0 - (Math.abs(lzDes) / hd)) * c.height;
              const minCamY = rH + 0.95;
              if (this.desiredPos.y < minCamY) {
                this.desiredPos.y = minCamY;
              }
            }

            // Current camera position clearance prevents camera from ever penetrating ramp interior or near clipping
            const dxCur = this.currentPos.x - c.x;
            const dzCur = this.currentPos.z - c.z;
            const lxCur = dxCur * cosA - dzCur * sinA;
            const lzCur = dxCur * sinA + dzCur * cosA;

            if (Math.abs(lxCur) <= hw && Math.abs(lzCur) <= hd) {
              const rH = Math.max(0, 1.0 - (Math.abs(lzCur) / hd)) * c.height;
              const minCamY = rH + 0.95;
              if (this.currentPos.y < minCamY) {
                this.currentPos.y = minCamY;
              }
            }
          }
        }
      }

      const activePosLerp = 22.0;
      const activeTargetLerp = 25.0;
      const posLerp = 1.0 - Math.exp(-activePosLerp * dt);
      const targetLerp = 1.0 - Math.exp(-activeTargetLerp * dt);
      Vector3.LerpToRef(this.currentPos, this.desiredPos, posLerp, this.currentPos);
      Vector3.LerpToRef(this.currentTarget, this.desiredTarget, targetLerp, this.currentTarget);
    }

    // Camera shake completely removed as requested - camera tracking is rock-solid and buttery smooth at all speeds
    this.camera.position.copyFrom(this.currentPos);
    this.camera.setTarget(this.currentTarget);
  }
}
