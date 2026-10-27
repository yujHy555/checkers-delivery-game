import * as THREE from 'three';
import { TextureGenerator } from '../utils/TextureGenerator.js';

export class VanModel {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'CheckersHyperVan';

    // Animation state
    this.sideDoorOpen = false;
    this.sideDoorSlide = 0;
    this.sideDoorOut = 0;

    this.rearDoorsOpen = false;
    this.rearDoorAngle = 0;

    this.cargoBags = [];

    this.buildModel();
    this.scene.add(this.root);
  }

  buildModel() {
    // Canvas Textures
    const sideTexLeft = TextureGenerator.createVanSideTexture(false);
    const sideTexRight = TextureGenerator.createVanSideTexture(true);
    const roofTex = TextureGenerator.createVanRoofTexture();
    const frontTex = TextureGenerator.createVanFrontTexture();
    const rearTex = TextureGenerator.createVanRearTexture();
    const tireTex = TextureGenerator.createTireTexture();
    const rimTex = TextureGenerator.createWheelRimTexture();

    // Vehicle Container (handles terrain slope pitch and roll for BOTH wheels and chassis)
    this.vehicleGroup = new THREE.Group();
    this.root.add(this.vehicleGroup);

    // Chassis Group (Base at axle height y = 0.35, responds to suspension & dynamic lean)
    this.chassisGroup = new THREE.Group();
    this.chassisGroup.position.y = 0.35;
    this.vehicleGroup.add(this.chassisGroup);

    // Standard Materials
    const bodyGreenMat = new THREE.MeshStandardMaterial({ color: 0x13b843, roughness: 0.35, metalness: 0.1 });
    const bodyCyanMat = new THREE.MeshStandardMaterial({ color: 0x00a3b8, roughness: 0.35, metalness: 0.1 });
    const darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x1f2326, roughness: 0.8 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a2b3c,
      transmission: 0.65,
      opacity: 0.9,
      transparent: true,
      roughness: 0.1,
      metalness: 0.2
    });
    const sideMatLeft = new THREE.MeshStandardMaterial({ map: sideTexLeft, roughness: 0.35 });
    const sideMatRight = new THREE.MeshStandardMaterial({ map: sideTexRight, roughness: 0.35 });
    const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.4 });
    const frontMat = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.4 });
    const rearMat = new THREE.MeshStandardMaterial({ map: rearTex, roughness: 0.4 });

    // 1. VAN BODY
    // Lower body box
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.75, 3.25), bodyCyanMat);
    lowerBody.position.set(0, 0.38, 0);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = false;
    this.chassisGroup.add(lowerBody);

    // Upper cargo box (does not cast shadow to avoid tall cube shadow on ramps)
    const upperBody = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.85, 3.1), bodyGreenMat);
    upperBody.position.set(0, 1.15, -0.05);
    upperBody.castShadow = false;
    this.chassisGroup.add(upperBody);

    // Textured Side Panels
    const sidePanelGeo = new THREE.PlaneGeometry(3.1, 1.45);
    const leftPanel = new THREE.Mesh(sidePanelGeo, sideMatLeft);
    leftPanel.position.set(-0.715, 0.8, -0.05);
    leftPanel.rotation.y = -Math.PI / 2;
    this.chassisGroup.add(leftPanel);

    const rightPanel = new THREE.Mesh(sidePanelGeo, sideMatRight);
    rightPanel.position.set(0.715, 0.8, -0.05);
    rightPanel.rotation.y = Math.PI / 2;
    this.chassisGroup.add(rightPanel);

    // Front Slanted Nose
    const frontFascia = new THREE.Mesh(new THREE.BoxGeometry(1.40, 0.75, 0.35), frontMat);
    frontFascia.position.set(0, 0.45, 1.55);
    this.chassisGroup.add(frontFascia);

    // Slanted Front Windshield
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.82), glassMat);
    windshield.position.set(0, 1.15, 1.42);
    windshield.rotation.x = -THREE.MathUtils.degToRad(32);
    this.chassisGroup.add(windshield);

    // Roof
    const roofPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 2.85), roofMat);
    roofPanel.position.set(0, 1.58, -0.15);
    roofPanel.rotation.x = -Math.PI / 2;
    this.chassisGroup.add(roofPanel);

    // Aerodynamic Rear Roof Wing / Spoiler
    const wingGroup = new THREE.Group();
    wingGroup.position.set(0, 1.68, -1.55);
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.06, 0.32), bodyGreenMat);
    const strutLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.22), darkTrimMat);
    strutLeft.position.set(-0.55, -0.08, 0);
    const strutRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.22), darkTrimMat);
    strutRight.position.set(0.55, -0.08, 0);
    wingGroup.add(wingBlade, strutLeft, strutRight);
    this.chassisGroup.add(wingGroup);

    // Front Bumper
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.28, 0.3), darkTrimMat);
    bumper.position.set(0, 0.15, 1.68);
    bumper.castShadow = true;
    this.chassisGroup.add(bumper);

    // Black Flared Wheel Arches
    const createFender = (x, z) => {
      const fender = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.72), darkTrimMat);
      fender.position.set(x, 0.18, z);
      return fender;
    };
    this.chassisGroup.add(createFender(-0.73, 1.05));
    this.chassisGroup.add(createFender(0.73, 1.05));
    this.chassisGroup.add(createFender(-0.73, -1.05));
    this.chassisGroup.add(createFender(0.73, -1.05));

    // Headlights
    this.headlightL = new THREE.SpotLight(0xffffff, 2.5, 30, Math.PI / 6, 0.4);
    this.headlightL.position.set(-0.5, 0.48, 1.7);
    this.headlightL.target.position.set(-0.5, 0.1, 15);
    this.chassisGroup.add(this.headlightL, this.headlightL.target);

    this.headlightR = new THREE.SpotLight(0xffffff, 2.5, 30, Math.PI / 6, 0.4);
    this.headlightR.position.set(0.5, 0.48, 1.7);
    this.headlightR.target.position.set(0.5, 0.1, 15);
    this.chassisGroup.add(this.headlightR, this.headlightR.target);

    // Taillight glow
    const tailGlowGeo = new THREE.BoxGeometry(0.08, 0.24, 0.04);
    this.tailGlowMat = new THREE.MeshBasicMaterial({ color: 0xaa1111 });
    const tailL = new THREE.Mesh(tailGlowGeo, this.tailGlowMat);
    tailL.position.set(-0.62, 0.55, -1.64);
    const tailR = new THREE.Mesh(tailGlowGeo, this.tailGlowMat);
    tailR.position.set(0.62, 0.55, -1.64);
    this.chassisGroup.add(tailL, tailR);

    // Dashboard & Steering Wheel
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.32, 0.45), darkTrimMat);
    dash.position.set(0, 0.75, 1.15);
    this.chassisGroup.add(dash);

    this.steeringWheelPivot = new THREE.Group();
    this.steeringWheelPivot.position.set(-0.35, 0.88, 0.95);
    this.steeringWheelPivot.rotation.x = -THREE.MathUtils.degToRad(25);
    const wheelTorus = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.024, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 })
    );
    this.steeringWheelPivot.add(wheelTorus);
    this.chassisGroup.add(this.steeringWheelPivot);

    // 2. ANIMATED DOORS
    // Side Sliding Cargo Door
    this.sideSlideDoor = new THREE.Group();
    this.sideSlideDoor.position.set(0.72, 0.75, 0.15);
    const slideDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.25, 1.1), sideMatRight);
    this.sideSlideDoor.add(slideDoorMesh);
    this.chassisGroup.add(this.sideSlideDoor);

    // Rear Barn Doors
    this.rearDoorLeftPivot = new THREE.Group();
    this.rearDoorLeftPivot.position.set(-0.68, 0.75, -1.62);
    const rearDoorLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.35, 0.05), rearMat);
    rearDoorLMesh.position.set(0.33, 0, 0);
    this.rearDoorLeftPivot.add(rearDoorLMesh);
    this.chassisGroup.add(this.rearDoorLeftPivot);

    this.rearDoorRightPivot = new THREE.Group();
    this.rearDoorRightPivot.position.set(0.68, 0.75, -1.62);
    const rearDoorRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.35, 0.05), rearMat);
    rearDoorRMesh.position.set(-0.33, 0, 0);
    this.rearDoorRightPivot.add(rearDoorRMesh);
    this.chassisGroup.add(this.rearDoorRightPivot);

    // Cargo interior with Paper Delivery Bags
    this.cargoBed = new THREE.Group();
    this.cargoBed.position.set(0, 0.45, -0.65);
    this.chassisGroup.add(this.cargoBed);
    this.createCargoBags();

    // 3. FOUR ALL-TERRAIN WHEELS (Radius = 0.35, Center at y = 0.35, Bottom touches y = 0.00 exactly!)
    this.wheels = [];
    const wheelPositions = [
      { id: 'FL', x: -0.68, z: 1.05, isFront: true },
      { id: 'FR', x: 0.68, z: 1.05, isFront: true },
      { id: 'RL', x: -0.68, z: -1.05, isFront: false },
      { id: 'RR', x: 0.68, z: -1.05, isFront: false }
    ];

    const tireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.28, 24);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ map: tireTex, roughness: 0.85 });

    const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.284, 24);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({ map: rimTex, roughness: 0.3, metalness: 0.7 });

    for (const wp of wheelPositions) {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(wp.x, 0.35, wp.z); // Wheel center at y = 0.35 above ground

      const spinGroup = new THREE.Group();
      const tireMesh = new THREE.Mesh(tireGeo, tireMat);
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      tireMesh.castShadow = true;
      rimMesh.castShadow = true;

      spinGroup.add(tireMesh, rimMesh);
      steerPivot.add(spinGroup);

      this.vehicleGroup.add(steerPivot);
      this.wheels.push({
        id: wp.id,
        isFront: wp.isFront,
        steerPivot,
        spinGroup
      });
    }
  }

  createCargoBags() {
    const bagMat = new THREE.MeshStandardMaterial({
      map: TextureGenerator.createPaperBagTexture(),
      roughness: 0.75
    });
    const bagGeo = new THREE.BoxGeometry(0.32, 0.42, 0.22);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const bag = new THREE.Mesh(bagGeo, bagMat);
        bag.position.set((c - 1) * 0.36, 0.22, (r - 0.5) * 0.32);
        bag.rotation.y = (Math.random() - 0.5) * 0.2;
        bag.castShadow = true;
        this.cargoBed.add(bag);
        this.cargoBags.push(bag);
      }
    }
  }

  toggleSideDoor() {
    this.sideDoorOpen = !this.sideDoorOpen;
    return this.sideDoorOpen;
  }

  toggleRearDoors() {
    this.rearDoorsOpen = !this.rearDoorsOpen;
    return this.rearDoorsOpen;
  }

  update(dt, vehiclePhysics) {
    // 1. Root position sits directly at the ground contact elevation
    this.root.position.copy(vehiclePhysics.position);
    this.root.rotation.y = vehiclePhysics.heading;

    // 2. Terrain Slope Alignment (applies to BOTH wheels and chassis!)
    this.vehicleGroup.rotation.x = vehiclePhysics.surfacePitch || 0;
    this.vehicleGroup.rotation.z = vehiclePhysics.surfaceRoll || 0;

    // 3. Dynamic Chassis Suspension Lean & Landing Compression
    this.chassisGroup.position.y = 0.35 - (vehiclePhysics.suspensionCompress || 0);
    this.chassisGroup.rotation.x = vehiclePhysics.dynamicPitch || 0;
    this.chassisGroup.rotation.z = vehiclePhysics.dynamicRoll || 0;

    // 3. Wheel Spin & Steering
    const rollDelta = (vehiclePhysics.speed / 0.35) * dt;

    for (const w of this.wheels) {
      w.spinGroup.rotation.x += rollDelta;
      if (w.isFront) {
        w.steerPivot.rotation.y = vehiclePhysics.steerAngle;
      }
    }

    // 4. Cockpit Steering Wheel
    if (this.steeringWheelPivot) {
      this.steeringWheelPivot.rotation.z = -vehiclePhysics.steerAngle * 2.5;
    }

    // 5. Brake Lights
    if (vehiclePhysics.speed > 0.5 && vehiclePhysics.velocity.dot(new THREE.Vector3(0, 0, -1)) < 0) {
      this.tailGlowMat.color.setHex(0xff0000);
    } else {
      this.tailGlowMat.color.setHex(0x771111);
    }

    // 6. Animate Doors
    const targetSlide = this.sideDoorOpen ? 1.05 : 0;
    const targetOut = this.sideDoorOpen ? 0.08 : 0;
    this.sideDoorSlide = THREE.MathUtils.lerp(this.sideDoorSlide, targetSlide, 6.0 * dt);
    this.sideDoorOut = THREE.MathUtils.lerp(this.sideDoorOut, targetOut, 8.0 * dt);
    this.sideSlideDoor.position.x = 0.72 + this.sideDoorOut;
    this.sideSlideDoor.position.z = 0.15 - this.sideDoorSlide;

    const targetRearAngle = this.rearDoorsOpen ? 2.1 : 0;
    this.rearDoorAngle = THREE.MathUtils.lerp(this.rearDoorAngle, targetRearAngle, 6.0 * dt);
    this.rearDoorLeftPivot.rotation.y = -this.rearDoorAngle;
    this.rearDoorRightPivot.rotation.y = this.rearDoorAngle;
  }
}
