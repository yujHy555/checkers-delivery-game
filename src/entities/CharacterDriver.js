import * as THREE from 'three';
import { TextureGenerator } from '../utils/TextureGenerator.js';

export class CharacterDriver {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'CheckersDriver';

    // State machine: 'ON_FOOT', 'ENTERING_VAN', 'DRIVING', 'EXITING_VAN'
    this.state = 'DRIVING'; // starts driving
    this.carryingBag = false;
    this.walkCycle = 0;
    this.speed = 0;
    this.velocity = new THREE.Vector3();
    this.heading = 0;

    // Transition progress
    this.transitionTime = 0;
    this.transitionDuration = 1.2;

    this.buildRiggedCharacter();
    this.scene.add(this.root);
  }

  buildRiggedCharacter() {
    // Suit Colors matching Sixty60 driver: Cyan/Teal #00bcd4, Dark Blue/Charcoal #1f2833, White stripes
    const cyanMat = new THREE.MeshStandardMaterial({
      color: 0x00bcd4,
      roughness: 0.45,
      metalness: 0.1
    });
    const darkSuitMat = new THREE.MeshStandardMaterial({
      color: 0x1d242b,
      roughness: 0.6
    });
    const whiteStripeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5
    });
    const helmetVisorMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a1014,
      roughness: 0.1,
      metalness: 0.9,
      transmission: 0.3
    });

    // 1. MIXAMO-COMPATIBLE BONE HIERARCHY
    // Root Hips
    this.hips = new THREE.Group();
    this.hips.name = 'mixamorigHips';
    this.hips.position.set(0, 0.92, 0);
    this.root.add(this.hips);

    // Pelvis mesh
    const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.22), darkSuitMat);
    this.hips.add(pelvisMesh);

    // Spine
    this.spine = new THREE.Group();
    this.spine.name = 'mixamorigSpine';
    this.spine.position.set(0, 0.12, 0);
    this.hips.add(this.spine);

    // Chest / Torso
    this.chest = new THREE.Group();
    this.chest.name = 'mixamorigChest';
    this.chest.position.set(0, 0.22, 0);
    this.spine.add(this.chest);

    // Torso mesh (Cyan Sixty60 jacket with dark paneling)
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.24), cyanMat);
    torsoMesh.position.set(0, 0.15, 0);
    torsoMesh.castShadow = true;
    this.chest.add(torsoMesh);

    // White chest stripe
    const stripeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.08, 0.25), whiteStripeMat);
    stripeMesh.position.set(0, 0.14, 0);
    this.chest.add(stripeMesh);

    // Neck & Head
    this.neck = new THREE.Group();
    this.neck.name = 'mixamorigNeck';
    this.neck.position.set(0, 0.38, 0);
    this.chest.add(this.neck);

    this.head = new THREE.Group();
    this.head.name = 'mixamorigHead';
    this.head.position.set(0, 0.1, 0);
    this.neck.add(this.head);

    // Sixty60 Cyan Full-Face Helmet
    const helmetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), cyanMat);
    helmetMesh.position.set(0, 0.08, 0);
    helmetMesh.scale.set(1.0, 1.15, 1.1);
    this.head.add(helmetMesh);

    // Dark Visor
    const visorMesh = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12, 0, Math.PI, 0, Math.PI / 2), helmetVisorMat);
    visorMesh.position.set(0, 0.09, 0.08);
    visorMesh.rotation.x = THREE.MathUtils.degToRad(85);
    this.head.add(visorMesh);

    // LEFT ARM
    this.leftShoulder = new THREE.Group();
    this.leftShoulder.name = 'mixamorigLeftShoulder';
    this.leftShoulder.position.set(-0.24, 0.3, 0);
    this.chest.add(this.leftShoulder);

    this.leftArm = new THREE.Group();
    this.leftArm.name = 'mixamorigLeftArm';
    this.leftShoulder.add(this.leftArm);

    const leftUpperArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.28, 8), cyanMat);
    leftUpperArmMesh.position.set(0, -0.14, 0);
    this.leftArm.add(leftUpperArmMesh);

    this.leftForeArm = new THREE.Group();
    this.leftForeArm.name = 'mixamorigLeftForeArm';
    this.leftForeArm.position.set(0, -0.28, 0);
    this.leftArm.add(this.leftForeArm);

    const leftForeArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.26, 8), darkSuitMat);
    leftForeArmMesh.position.set(0, -0.13, 0);
    this.leftForeArm.add(leftForeArmMesh);

    this.leftHand = new THREE.Group();
    this.leftHand.name = 'mixamorigLeftHand';
    this.leftHand.position.set(0, -0.26, 0);
    this.leftForeArm.add(this.leftHand);

    const leftGloveMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.06), darkSuitMat);
    this.leftHand.add(leftGloveMesh);

    // RIGHT ARM
    this.rightShoulder = new THREE.Group();
    this.rightShoulder.name = 'mixamorigRightShoulder';
    this.rightShoulder.position.set(0.24, 0.3, 0);
    this.chest.add(this.rightShoulder);

    this.rightArm = new THREE.Group();
    this.rightArm.name = 'mixamorigRightArm';
    this.rightShoulder.add(this.rightArm);

    const rightUpperArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.28, 8), cyanMat);
    rightUpperArmMesh.position.set(0, -0.14, 0);
    this.rightArm.add(rightUpperArmMesh);

    this.rightForeArm = new THREE.Group();
    this.rightForeArm.name = 'mixamorigRightForeArm';
    this.rightForeArm.position.set(0, -0.28, 0);
    this.rightArm.add(this.rightForeArm);

    const rightForeArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.26, 8), darkSuitMat);
    rightForeArmMesh.position.set(0, -0.13, 0);
    this.rightForeArm.add(rightForeArmMesh);

    this.rightHand = new THREE.Group();
    this.rightHand.name = 'mixamorigRightHand';
    this.rightHand.position.set(0, -0.26, 0);
    this.rightForeArm.add(this.rightHand);

    const rightGloveMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.06), darkSuitMat);
    this.rightHand.add(rightGloveMesh);

    // LEFT LEG
    this.leftUpLeg = new THREE.Group();
    this.leftUpLeg.name = 'mixamorigLeftUpLeg';
    this.leftUpLeg.position.set(-0.11, -0.1, 0);
    this.hips.add(this.leftUpLeg);

    const leftThighMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.38, 8), cyanMat);
    leftThighMesh.position.set(0, -0.19, 0);
    this.leftUpLeg.add(leftThighMesh);

    this.leftLeg = new THREE.Group();
    this.leftLeg.name = 'mixamorigLeftLeg';
    this.leftLeg.position.set(0, -0.38, 0);
    this.leftUpLeg.add(this.leftLeg);

    const leftShinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.36, 8), darkSuitMat);
    leftShinMesh.position.set(0, -0.18, 0);
    this.leftLeg.add(leftShinMesh);

    this.leftFoot = new THREE.Group();
    this.leftFoot.name = 'mixamorigLeftFoot';
    this.leftFoot.position.set(0, -0.36, 0);
    this.leftLeg.add(this.leftFoot);

    const leftBootMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.22), darkSuitMat);
    leftBootMesh.position.set(0, -0.05, 0.06);
    this.leftFoot.add(leftBootMesh);

    // RIGHT LEG
    this.rightUpLeg = new THREE.Group();
    this.rightUpLeg.name = 'mixamorigRightUpLeg';
    this.rightUpLeg.position.set(0.11, -0.1, 0);
    this.hips.add(this.rightUpLeg);

    const rightThighMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.38, 8), cyanMat);
    rightThighMesh.position.set(0, -0.19, 0);
    this.rightUpLeg.add(rightThighMesh);

    this.rightLeg = new THREE.Group();
    this.rightLeg.name = 'mixamorigRightLeg';
    this.rightLeg.position.set(0, -0.38, 0);
    this.rightUpLeg.add(this.rightLeg);

    const rightShinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.36, 8), darkSuitMat);
    rightShinMesh.position.set(0, -0.18, 0);
    this.rightLeg.add(rightShinMesh);

    this.rightFoot = new THREE.Group();
    this.rightFoot.name = 'mixamorigRightFoot';
    this.rightFoot.position.set(0, -0.36, 0);
    this.rightLeg.add(this.rightFoot);

    const rightBootMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.22), darkSuitMat);
    rightBootMesh.position.set(0, -0.05, 0.06);
    this.rightFoot.add(rightBootMesh);

    // 2. ATTACHABLE PAPER DELIVERY BAG IN HANDS
    this.heldBagGroup = new THREE.Group();
    this.heldBagGroup.position.set(0, 0.2, 0.32);
    
    const bagMat = new THREE.MeshStandardMaterial({
      map: TextureGenerator.createPaperBagTexture(),
      roughness: 0.8
    });
    const bagMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.22), bagMat);
    this.heldBagGroup.add(bagMesh);
    this.chest.add(this.heldBagGroup);
    this.heldBagGroup.visible = false;
  }

  setCarryingBag(carrying) {
    this.carryingBag = carrying;
    this.heldBagGroup.visible = carrying;
  }

  enterVan(van) {
    if (this.state === 'ON_FOOT') {
      this.state = 'ENTERING_VAN';
      this.transitionTime = 0;
      van.driverDoorOpen = true;
    }
  }

  exitVan(van) {
    if (this.state === 'DRIVING') {
      this.state = 'EXITING_VAN';
      this.transitionTime = 0;
      van.driverDoorOpen = true;

      // Position character outside driver door
      const sidePos = van.root.position.clone()
        .add(new THREE.Vector3(-1.15, 0, 0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), van.root.rotation.y));
      this.root.position.copy(sidePos);
      this.root.position.y = 0;
      this.heading = van.root.rotation.y + Math.PI / 2;
      this.root.rotation.y = this.heading;
      this.root.visible = true;
    }
  }

  update(dt, input, van) {
    if (this.state === 'DRIVING') {
      // Driver seated inside van cockpit
      this.root.visible = true;
      this.root.position.copy(van.root.position);
      this.root.rotation.y = van.root.rotation.y;

      // Seat offset relative to van
      const seatOffset = new THREE.Vector3(-0.35, 0.48, 0.55)
        .applyEuler(van.chassisGroup.rotation)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), van.root.rotation.y);
      this.root.position.add(seatOffset);

      // Seated pose: knees bent 90 deg, arms forward holding steering wheel
      this.leftUpLeg.rotation.x = -Math.PI / 2;
      this.rightUpLeg.rotation.x = -Math.PI / 2;
      this.leftLeg.rotation.x = Math.PI / 2.2;
      this.rightLeg.rotation.x = Math.PI / 2.2;

      this.leftArm.rotation.x = -0.95;
      this.leftArm.rotation.z = -0.3;
      this.leftForeArm.rotation.x = -0.4;

      this.rightArm.rotation.x = -0.95;
      this.rightArm.rotation.z = 0.3;
      this.rightForeArm.rotation.x = -0.4;

      // Head looks slightly in turn direction
      this.head.rotation.y = -van.wheels[0].steerPivot.rotation.y * 0.7;
      this.heldBagGroup.visible = false;

    } else if (this.state === 'ENTERING_VAN') {
      this.transitionTime += dt;
      const progress = this.transitionTime / this.transitionDuration;

      // Interpolate towards driver seat
      const targetPos = van.root.position.clone()
        .add(new THREE.Vector3(-0.35, 0.48, 0.55).applyAxisAngle(new THREE.Vector3(0, 1, 0), van.root.rotation.y));

      this.root.position.lerp(targetPos, 5.0 * dt);

      if (progress >= 1.0) {
        this.state = 'DRIVING';
        van.driverDoorOpen = false;
      }

    } else if (this.state === 'EXITING_VAN') {
      this.transitionTime += dt;
      const progress = this.transitionTime / this.transitionDuration;

      if (progress >= 1.0) {
        this.state = 'ON_FOOT';
        van.driverDoorOpen = false;
      }

    } else if (this.state === 'ON_FOOT') {
      // Driver Walking / Running around level
      this.updateOnFootMovement(dt, input);
    }
  }

  updateOnFootMovement(dt, input) {
    const moveX = input.moveX || 0;
    const moveZ = input.moveZ || 0;
    const isMoving = Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05;

    const walkSpeed = input.sprint ? 5.8 : 3.2;

    if (isMoving) {
      this.heading = Math.atan2(moveX, moveZ);
      this.root.rotation.y = this.heading;

      const moveVec = new THREE.Vector3(moveX, 0, moveZ).normalize().multiplyScalar(walkSpeed * dt);
      this.root.position.add(moveVec);

      // Walk cycle animation
      this.walkCycle += dt * (input.sprint ? 12 : 7.5);
      const legSwing = Math.sin(this.walkCycle) * (input.sprint ? 0.75 : 0.45);
      const armSwing = Math.sin(this.walkCycle) * 0.4;

      this.leftUpLeg.rotation.x = legSwing;
      this.rightUpLeg.rotation.x = -legSwing;
      this.leftLeg.rotation.x = Math.max(0, -legSwing * 0.8);
      this.rightLeg.rotation.x = Math.max(0, legSwing * 0.8);

      // Spine & Hip bobbing
      this.hips.position.y = 0.92 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.04;

      if (this.carryingBag) {
        // Hold bag in both hands
        this.leftArm.rotation.x = -1.1;
        this.leftArm.rotation.z = -0.3;
        this.leftForeArm.rotation.x = -0.5;

        this.rightArm.rotation.x = -1.1;
        this.rightArm.rotation.z = 0.3;
        this.rightForeArm.rotation.x = -0.5;
      } else {
        // Natural arm swing
        this.leftArm.rotation.x = -armSwing;
        this.rightArm.rotation.x = armSwing;
        this.leftArm.rotation.z = 0.05;
        this.rightArm.rotation.z = -0.05;
      }
    } else {
      // Idle breathing pose
      this.walkCycle += dt * 2.0;
      this.leftUpLeg.rotation.x = THREE.MathUtils.lerp(this.leftUpLeg.rotation.x, 0, 8 * dt);
      this.rightUpLeg.rotation.x = THREE.MathUtils.lerp(this.rightUpLeg.rotation.x, 0, 8 * dt);
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, 8 * dt);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, 8 * dt);
      this.hips.position.y = 0.92 + Math.sin(this.walkCycle) * 0.01;

      if (this.carryingBag) {
        this.leftArm.rotation.x = -1.0;
        this.rightArm.rotation.x = -1.0;
      } else {
        this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, 6 * dt);
        this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, 6 * dt);
      }
    }
  }
}
