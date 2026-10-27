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
    this.isoHeading = 0;
    this.hasInitIso = false;
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
      // Silky Smooth Elevated 45-degree Isometric View (Optimized for Mobile!)
      const isoDist = isMobile ? 8.8 : 16.0;
      const isoHeight = isMobile ? 9.6 : 18.0;

      if (!this.hasInitIso) {
        this.isoHeading = heading;
        this.hasInitIso = true;
      }

      // Smooth heading tracking: smooths out jittery steering so camera doesn't violently whip the screen
      let diff = heading - this.isoHeading;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      const turnFollowSpeed = isMobile ? 12.0 : 8.0;
      this.isoHeading += diff * Math.min(1.0, turnFollowSpeed * dt);

      const isoForward = new THREE.Vector3(Math.sin(this.isoHeading), 0, Math.cos(this.isoHeading));
      desiredPos.copy(focusPos)
        .addScaledVector(isoForward, -isoDist)
        .add(new THREE.Vector3(0, isoHeight, 0));

      desiredTarget.copy(focusPos)
        .addScaledVector(isoForward, isMobile ? 1.6 : 2.0)
        .add(new THREE.Vector3(0, isMobile ? 0.6 : 0.8, 0));

      const targetFov = isMobile ? 52 : 46;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 6.0 * dt);
      this.camera.updateProjectionMatrix();

      // Responsive, silky-smooth damping for isometric
      const posSpeed = isMobile ? 16.0 : this.posLerpSpeed;
      const targetSpeed = isMobile ? 20.0 : this.targetLerpSpeed;
      this.currentPos.lerp(desiredPos, posSpeed * dt);
      this.currentTarget.lerp(desiredTarget, targetSpeed * dt);

    } else {
      this.hasInitIso = false;
      // Dynamic Third-Person Chase Cam (Moved a lot closer towards van on mobile!)
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

      // Smooth camera damping
      this.currentPos.lerp(desiredPos, this.posLerpSpeed * dt);
      this.currentTarget.lerp(desiredTarget, this.targetLerpSpeed * dt);
    }

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentTarget);
  }
}
