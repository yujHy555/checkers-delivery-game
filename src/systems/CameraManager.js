import * as THREE from 'three';

export class CameraManager {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Camera modes: 'ISOMETRIC' or 'THIRD_PERSON'
    this.mode = 'ISOMETRIC';

    // Current camera position and look target
    this.currentPos = new THREE.Vector3(0, 20, 20);
    this.currentTarget = new THREE.Vector3();

    // Damping / follow speeds
    this.posSpeed = 6.0;
    this.targetSpeed = 10.0;

    // Third-person specific
    this.chaseDistance = 6.2;
    this.chaseHeight = 2.4;
    this.baseFov = 60;
  }

  toggleMode() {
    this.mode = this.mode === 'ISOMETRIC' ? 'THIRD_PERSON' : 'ISOMETRIC';
    return this.mode;
  }

  setMode(mode) {
    if (mode === 'ISOMETRIC' || mode === 'THIRD_PERSON') {
      this.mode = mode;
    }
  }

  update(dt, focusObject, vehiclePhysics, isOnFoot = false) {
    if (!focusObject) return;

    const focusPos = focusObject.position;
    let desiredPos = new THREE.Vector3();
    let desiredTarget = new THREE.Vector3();

    if (this.mode === 'ISOMETRIC') {
      // Elevated 45-degree angle Isometric View
      const isoOffset = new THREE.Vector3(-14, 18, -14);
      desiredPos.copy(focusPos).add(isoOffset);
      desiredTarget.copy(focusPos).add(new THREE.Vector3(0, 1.0, 0));

      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 42, 5.0 * dt);
      this.camera.updateProjectionMatrix();

    } else {
      // Dynamic Third-Person Chase View
      if (isOnFoot) {
        // Behind character
        const angle = focusObject.rotation.y;
        const forward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
        desiredPos.copy(focusPos)
          .addScaledVector(forward, -4.2)
          .add(new THREE.Vector3(0, 2.0, 0));
        desiredTarget.copy(focusPos).add(new THREE.Vector3(0, 1.2, 0));

        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 55, 5.0 * dt);
        this.camera.updateProjectionMatrix();

      } else {
        // Behind van
        const heading = vehiclePhysics.heading;
        const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));

        // Speed effects: pull camera back slightly at high speed
        const speedNorm = Math.min(1.0, Math.abs(vehiclePhysics.speed) / vehiclePhysics.maxSpeed);
        const dynamicDist = this.chaseDistance + speedNorm * 1.8;
        const dynamicHeight = this.chaseHeight + speedNorm * 0.4;

        desiredPos.copy(focusPos)
          .addScaledVector(forward, -dynamicDist)
          .add(new THREE.Vector3(0, dynamicHeight, 0));

        // Look ahead in direction of travel
        desiredTarget.copy(focusPos)
          .addScaledVector(forward, 2.5)
          .add(new THREE.Vector3(0, 0.8, 0));

        // Dynamic FOV kick
        const targetFov = this.baseFov + speedNorm * 12;
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 5.0 * dt);
        this.camera.updateProjectionMatrix();
      }
    }

    // Smooth position & lookAt lerping
    this.currentPos.lerp(desiredPos, this.posSpeed * dt);
    this.currentTarget.lerp(desiredTarget, this.targetSpeed * dt);

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentTarget);
  }
}
