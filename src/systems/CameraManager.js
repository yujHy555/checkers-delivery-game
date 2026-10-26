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
  }

  toggleMode() {
    this.mode = this.mode === 'THIRD_PERSON' ? 'ISOMETRIC' : 'THIRD_PERSON';
    return this.mode;
  }

  setMode(mode) {
    if (mode === 'ISOMETRIC' || mode === 'THIRD_PERSON') {
      this.mode = mode;
    }
  }

  update(dt, focusObject, vehiclePhysics) {
    if (!focusObject) return;

    const focusPos = focusObject.position;
    const heading = vehiclePhysics.heading;
    const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));

    let desiredPos = new THREE.Vector3();
    let desiredTarget = new THREE.Vector3();

    if (this.mode === 'ISOMETRIC') {
      // Clean Elevated 45-degree Isometric View
      // Aligned behind vehicle heading for natural steering!
      const isoDist = 18.0;
      const isoHeight = 22.0;

      desiredPos.copy(focusPos)
        .addScaledVector(forward, -isoDist)
        .add(new THREE.Vector3(0, isoHeight, 0));

      desiredTarget.copy(focusPos).add(new THREE.Vector3(0, 0.8, 0));

      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 46, 6.0 * dt);
      this.camera.updateProjectionMatrix();

    } else {
      // Dynamic Third-Person Chase Cam (AAA arcade feel)
      const speedNorm = Math.min(1.0, Math.abs(vehiclePhysics.speed) / vehiclePhysics.maxSpeed);
      const dynamicDist = this.chaseDistance + speedNorm * 1.6;
      const dynamicHeight = this.chaseHeight + speedNorm * 0.4;

      // Position camera directly behind the vehicle with slight drift lag
      desiredPos.copy(focusPos)
        .addScaledVector(forward, -dynamicDist)
        .add(new THREE.Vector3(0, dynamicHeight, 0));

      // Look ahead along forward vector
      desiredTarget.copy(focusPos)
        .addScaledVector(forward, 3.2)
        .add(new THREE.Vector3(0, 0.9, 0));

      // Speed FOV expansion (increases sensation of speed)
      const targetFov = this.baseFov + speedNorm * 14.0;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 6.0 * dt);
      this.camera.updateProjectionMatrix();
    }

    // Smooth camera damping
    this.currentPos.lerp(desiredPos, this.posLerpSpeed * dt);
    this.currentTarget.lerp(desiredTarget, this.targetLerpSpeed * dt);

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentTarget);
  }
}
