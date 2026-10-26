import * as THREE from 'three';
import { TextureGenerator } from '../utils/TextureGenerator.js';

export class VanModel {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'CheckersHyperVan';

    // Animation state
    this.driverDoorOpen = false;
    this.driverDoorAngle = 0; // 0 to 1.1 rad
    
    this.sideDoorOpen = false;
    this.sideDoorSlide = 0; // 0 to 1.05 m
    this.sideDoorOut = 0; // 0 to 0.08 m

    this.rearDoorsOpen = false;
    this.rearDoorAngle = 0; // 0 to 2.1 rad

    this.cargoBags = [];

    this.buildModel();
    this.scene.add(this.root);
  }

  buildModel() {
    // Generate PBR textures
    const sideTexLeft = TextureGenerator.createVanSideTexture(false);
    const sideTexRight = TextureGenerator.createVanSideTexture(true);
    const roofTex = TextureGenerator.createVanRoofTexture();
    const frontTex = TextureGenerator.createVanFrontTexture();
    const rearTex = TextureGenerator.createVanRearTexture();
    const tireTex = TextureGenerator.createTireTexture();
    const rimTex = TextureGenerator.createWheelRimTexture();

    // Chassis Group (affected by roll and pitch suspension tilt)
    this.chassisGroup = new THREE.Group();
    this.chassisGroup.position.y = 0.35; // base offset above axles
    this.root.add(this.chassisGroup);

    // Main Materials
    const bodyGreenMat = new THREE.MeshStandardMaterial({
      color: 0x13b843,
      roughness: 0.35,
      metalness: 0.2
    });
    const bodyCyanMat = new THREE.MeshStandardMaterial({
      color: 0x00a3b8,
      roughness: 0.35,
      metalness: 0.2
    });
    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x1f2326,
      roughness: 0.8,
      metalness: 0.1
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x112233,
      transmission: 0.75,
      opacity: 0.85,
      transparent: true,
      roughness: 0.1,
      metalness: 0.1,
      ior: 1.5
    });
    const sideMatLeft = new THREE.MeshStandardMaterial({
      map: sideTexLeft,
      roughness: 0.35,
      metalness: 0.2
    });
    const sideMatRight = new THREE.MeshStandardMaterial({
      map: sideTexRight,
      roughness: 0.35,
      metalness: 0.2
    });
    const roofMat = new THREE.MeshStandardMaterial({
      map: roofTex,
      roughness: 0.4,
      metalness: 0.1
    });
    const frontMat = new THREE.MeshStandardMaterial({
      map: frontTex,
      roughness: 0.4,
      metalness: 0.15
    });
    const rearMat = new THREE.MeshStandardMaterial({
      map: rearTex,
      roughness: 0.4,
      metalness: 0.15
    });

    // 1. VAN CABIN & BODY (Kei-van proportions: L=3.35m, W=1.45m, H=1.65m)
    // Lower body box
    const lowerBodyGeo = new THREE.BoxGeometry(1.42, 0.75, 3.25);
    const lowerBody = new THREE.Mesh(lowerBodyGeo, bodyCyanMat);
    lowerBody.position.set(0, 0.38, 0);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    this.chassisGroup.add(lowerBody);

    // Upper cargo box
    const upperBodyGeo = new THREE.BoxGeometry(1.38, 0.85, 3.1);
    const upperBody = new THREE.Mesh(upperBodyGeo, bodyGreenMat);
    upperBody.position.set(0, 1.15, -0.05);
    upperBody.castShadow = true;
    this.chassisGroup.add(upperBody);

    // Textured Side Panels (Left & Right)
    const sidePanelGeo = new THREE.PlaneGeometry(3.1, 1.45);
    
    // Left side panel
    const leftPanel = new THREE.Mesh(sidePanelGeo, sideMatLeft);
    leftPanel.position.set(-0.715, 0.8, -0.05);
    leftPanel.rotation.y = -Math.PI / 2;
    this.chassisGroup.add(leftPanel);

    // Right side panel
    const rightPanel = new THREE.Mesh(sidePanelGeo, sideMatRight);
    rightPanel.position.set(0.715, 0.8, -0.05);
    rightPanel.rotation.y = Math.PI / 2;
    this.chassisGroup.add(rightPanel);

    // Front Slanted Nose / Fascia
    const frontFasciaGeo = new THREE.BoxGeometry(1.40, 0.75, 0.35);
    const frontFascia = new THREE.Mesh(frontFasciaGeo, frontMat);
    frontFascia.position.set(0, 0.45, 1.55);
    this.chassisGroup.add(frontFascia);

    // Slanted Front Windshield & Pillars
    const windshieldGeo = new THREE.PlaneGeometry(1.32, 0.82);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(0, 1.15, 1.42);
    windshield.rotation.x = -THREE.MathUtils.degToRad(32);
    this.chassisGroup.add(windshield);

    // Roof Panel with Texture
    const roofPanelGeo = new THREE.PlaneGeometry(1.36, 2.85);
    const roofPanel = new THREE.Mesh(roofPanelGeo, roofMat);
    roofPanel.position.set(0, 1.58, -0.15);
    roofPanel.rotation.x = -Math.PI / 2;
    this.chassisGroup.add(roofPanel);

    // Iconic Rooftop Aerodynamic Spoiler / Wing (as seen on Checkers Hyper van)
    const wingGroup = new THREE.Group();
    wingGroup.position.set(0, 1.68, -1.55);

    const wingBladeGeo = new THREE.BoxGeometry(1.34, 0.06, 0.32);
    const wingBlade = new THREE.Mesh(wingBladeGeo, bodyGreenMat);
    wingGroup.add(wingBlade);

    // Spoiler uprights / struts
    const strutGeo = new THREE.BoxGeometry(0.06, 0.16, 0.22);
    const strutLeft = new THREE.Mesh(strutGeo, darkTrimMat);
    strutLeft.position.set(-0.55, -0.08, 0);
    const strutRight = new THREE.Mesh(strutGeo, darkTrimMat);
    strutRight.position.set(0.55, -0.08, 0);
    wingGroup.add(strutLeft, strutRight);

    this.chassisGroup.add(wingGroup);

    // Front Bumper / Skid Guard
    const bumperGeo = new THREE.BoxGeometry(1.46, 0.28, 0.3);
    const bumper = new THREE.Mesh(bumperGeo, darkTrimMat);
    bumper.position.set(0, 0.15, 1.68);
    bumper.castShadow = true;
    this.chassisGroup.add(bumper);

    // Black Flared Wheel Arches (Off-road Kei-van style)
    const archMat = darkTrimMat;
    const createFender = (x, z) => {
      const fender = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.72), archMat);
      fender.position.set(x, 0.18, z);
      return fender;
    };
    this.chassisGroup.add(createFender(-0.73, 1.05));
    this.chassisGroup.add(createFender(0.73, 1.05));
    this.chassisGroup.add(createFender(-0.73, -1.05));
    this.chassisGroup.add(createFender(0.73, -1.05));

    // Side Mirrors
    const mirrorGeo = new THREE.BoxGeometry(0.18, 0.12, 0.08);
    const mirrorL = new THREE.Mesh(mirrorGeo, darkTrimMat);
    mirrorL.position.set(-0.80, 1.05, 1.25);
    const mirrorR = new THREE.Mesh(mirrorGeo, darkTrimMat);
    mirrorR.position.set(0.80, 1.05, 1.25);
    this.chassisGroup.add(mirrorL, mirrorR);

    // Headlight Spotlights / Emitters
    this.headlightL = new THREE.SpotLight(0xffffff, 2.5, 30, Math.PI / 6, 0.4);
    this.headlightL.position.set(-0.5, 0.48, 1.7);
    this.headlightL.target.position.set(-0.5, 0.1, 15);
    this.chassisGroup.add(this.headlightL);
    this.chassisGroup.add(this.headlightL.target);

    this.headlightR = new THREE.SpotLight(0xffffff, 2.5, 30, Math.PI / 6, 0.4);
    this.headlightR.position.set(0.5, 0.48, 1.7);
    this.headlightR.target.position.set(0.5, 0.1, 15);
    this.chassisGroup.add(this.headlightR);
    this.chassisGroup.add(this.headlightR.target);

    // Taillight glow meshes
    const tailGlowGeo = new THREE.BoxGeometry(0.08, 0.24, 0.04);
    this.tailGlowMat = new THREE.MeshBasicMaterial({ color: 0xaa1111 });
    const tailL = new THREE.Mesh(tailGlowGeo, this.tailGlowMat);
    tailL.position.set(-0.62, 0.55, -1.64);
    const tailR = new THREE.Mesh(tailGlowGeo, this.tailGlowMat);
    tailR.position.set(0.62, 0.55, -1.64);
    this.chassisGroup.add(tailL, tailR);

    // 2. INTERIOR COCKPIT
    const seatGeo = new THREE.BoxGeometry(0.48, 0.55, 0.48);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x1f2427, roughness: 0.8 });
    const driverSeat = new THREE.Mesh(seatGeo, seatMat);
    driverSeat.position.set(-0.35, 0.45, 0.55);
    this.chassisGroup.add(driverSeat);

    // Passenger seat
    const passSeat = new THREE.Mesh(seatGeo, seatMat);
    passSeat.position.set(0.35, 0.45, 0.55);
    this.chassisGroup.add(passSeat);

    // Dashboard & Steering Wheel
    const dashGeo = new THREE.BoxGeometry(1.28, 0.32, 0.45);
    const dash = new THREE.Mesh(dashGeo, darkTrimMat);
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

    // 3. ANIMATED DOORS
    // A. Driver Front Door (Left side, swings open 65 deg)
    this.driverDoorPivot = new THREE.Group();
    this.driverDoorPivot.position.set(-0.71, 0.45, 1.15); // hinge location
    const driverDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 0.85), bodyCyanMat);
    driverDoorMesh.position.set(0, 0, -0.425);
    this.driverDoorPivot.add(driverDoorMesh);
    this.chassisGroup.add(this.driverDoorPivot);

    // B. Side Sliding Cargo Door (Right side, pops out 0.08m and slides back 1.05m)
    this.sideSlideDoor = new THREE.Group();
    this.sideSlideDoor.position.set(0.72, 0.75, 0.15);
    const slideDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.25, 1.1), sideMatRight);
    this.sideSlideDoor.add(slideDoorMesh);
    this.chassisGroup.add(this.sideSlideDoor);

    // C. Rear Barn Doors (Dual swing doors on rear pillars)
    // Left rear door
    this.rearDoorLeftPivot = new THREE.Group();
    this.rearDoorLeftPivot.position.set(-0.68, 0.75, -1.62); // left hinge
    const rearDoorLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.35, 0.05), rearMat);
    rearDoorLMesh.position.set(0.33, 0, 0);
    this.rearDoorLeftPivot.add(rearDoorLMesh);
    this.chassisGroup.add(this.rearDoorLeftPivot);

    // Right rear door
    this.rearDoorRightPivot = new THREE.Group();
    this.rearDoorRightPivot.position.set(0.68, 0.75, -1.62); // right hinge
    const rearDoorRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.35, 0.05), rearMat);
    rearDoorRMesh.position.set(-0.33, 0, 0);
    this.rearDoorRightPivot.add(rearDoorRMesh);
    this.chassisGroup.add(this.rearDoorRightPivot);

    // 4. CARGO INTERIOR & PAPER DELIVERY BAGS
    this.cargoBed = new THREE.Group();
    this.cargoBed.position.set(0, 0.45, -0.65);
    this.chassisGroup.add(this.cargoBed);

    this.createCargoBags();

    // 5. FOUR OFF-ROAD ALL-TERRAIN WHEELS
    this.wheels = [];
    const wheelPositions = [
      { id: 'FL', x: -0.68, z: 1.05, isFront: true },
      { id: 'FR', x: 0.68, z: 1.05, isFront: true },
      { id: 'RL', x: -0.68, z: -1.05, isFront: false },
      { id: 'RR', x: 0.68, z: -1.05, isFront: false }
    ];

    const tireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.28, 24);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({
      map: tireTex,
      roughness: 0.85,
      metalness: 0.05
    });

    const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.284, 24);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({
      map: rimTex,
      roughness: 0.3,
      metalness: 0.7
    });

    for (const wp of wheelPositions) {
      // Steer pivot (yaw) for front wheels
      const steerPivot = new THREE.Group();
      steerPivot.position.set(wp.x, 0.35, wp.z);

      // Spin mesh (pitch) for wheel roll
      const spinGroup = new THREE.Group();
      const tireMesh = new THREE.Mesh(tireGeo, tireMat);
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      tireMesh.castShadow = true;

      spinGroup.add(tireMesh, rimMesh);
      steerPivot.add(spinGroup);

      this.root.add(steerPivot);
      this.wheels.push({
        id: wp.id,
        isFront: wp.isFront,
        steerPivot,
        spinGroup,
        baseX: wp.x,
        baseZ: wp.z
      });
    }
  }

  createCargoBags() {
    const bagMat = new THREE.MeshStandardMaterial({
      map: TextureGenerator.createPaperBagTexture(),
      roughness: 0.75
    });

    // Stack 6 paper delivery bags inside the rear cargo bay
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

  toggleDriverDoor() {
    this.driverDoorOpen = !this.driverDoorOpen;
    return this.driverDoorOpen;
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
    // 1. Sync Root with Vehicle Physics
    this.root.position.copy(vehiclePhysics.position);
    this.root.rotation.y = vehiclePhysics.heading;

    // 2. Body Roll & Pitch on Chassis Group
    this.chassisGroup.rotation.x = vehiclePhysics.bodyPitch;
    this.chassisGroup.rotation.z = vehiclePhysics.bodyRoll;

    // 3. Wheel Spin & Steering
    const rollAngleDelta = (vehiclePhysics.speed / vehiclePhysics.wheelRadius) * dt;

    for (const w of this.wheels) {
      // Wheel spin
      w.spinGroup.rotation.x += rollAngleDelta;

      // Front steering
      if (w.isFront) {
        w.steerPivot.rotation.y = vehiclePhysics.steerAngle;
      }

      // Suspension travel
      w.steerPivot.position.y = 0.35 + (vehiclePhysics.groundY - vehiclePhysics.position.y + 0.5);
      w.steerPivot.position.y = THREE.MathUtils.clamp(w.steerPivot.position.y, 0.2, 0.5);
    }

    // 4. Steering wheel rotation in cockpit
    if (this.steeringWheelPivot) {
      this.steeringWheelPivot.rotation.z = -vehiclePhysics.steerAngle * 2.8;
    }

    // 5. Tail light braking glow
    if (vehiclePhysics.speed > 0.5 && vehiclePhysics.velocity.dot(new THREE.Vector3(0, 0, -1)) < 0) {
      this.tailGlowMat.color.setHex(0xff0000);
    } else {
      this.tailGlowMat.color.setHex(0x771111);
    }

    // 6. Animate Driver Door (Swing)
    const targetDriverAngle = this.driverDoorOpen ? 1.05 : 0;
    this.driverDoorAngle = THREE.MathUtils.lerp(this.driverDoorAngle, targetDriverAngle, 7.0 * dt);
    this.driverDoorPivot.rotation.y = -this.driverDoorAngle;

    // 7. Animate Side Sliding Door (Shift out + Slide back)
    const targetSlide = this.sideDoorOpen ? 1.05 : 0;
    const targetOut = this.sideDoorOpen ? 0.08 : 0;
    this.sideDoorSlide = THREE.MathUtils.lerp(this.sideDoorSlide, targetSlide, 6.0 * dt);
    this.sideDoorOut = THREE.MathUtils.lerp(this.sideDoorOut, targetOut, 8.0 * dt);
    this.sideSlideDoor.position.x = 0.72 + this.sideDoorOut;
    this.sideSlideDoor.position.z = 0.15 - this.sideDoorSlide;

    // 8. Animate Rear Barn Doors (Dual Swing)
    const targetRearAngle = this.rearDoorsOpen ? 2.1 : 0;
    this.rearDoorAngle = THREE.MathUtils.lerp(this.rearDoorAngle, targetRearAngle, 6.0 * dt);
    this.rearDoorLeftPivot.rotation.y = -this.rearDoorAngle;
    this.rearDoorRightPivot.rotation.y = this.rearDoorAngle;
  }
}
