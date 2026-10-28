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
    // High-Definition Canvas Textures matching Vehicle Model Sheet
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

    // Automotive Materials matching Model Sheet Turnaround
    const bodyGreenMat = new THREE.MeshStandardMaterial({ color: 0x4cb824, roughness: 0.35, metalness: 0.08 });
    const bodyCyanMat = new THREE.MeshStandardMaterial({ color: 0x00b4d8, roughness: 0.35, metalness: 0.08 });
    const bumperMat = new THREE.MeshStandardMaterial({ color: 0x16191c, roughness: 0.85, metalness: 0.1 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x121517, roughness: 0.8 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.15, metalness: 0.9 });
    const spoilerTealMat = new THREE.MeshStandardMaterial({ color: 0x00bcd4, roughness: 0.35, metalness: 0.15 });
    const amberLensMat = new THREE.MeshStandardMaterial({ color: 0xff9800, roughness: 0.2, metalness: 0.1 });
    const whiteLensMat = new THREE.MeshStandardMaterial({ color: 0xe0e6ed, roughness: 0.2, metalness: 0.1 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x121820,
      transmission: 0.68,
      opacity: 0.92,
      transparent: true,
      roughness: 0.08,
      metalness: 0.15
    });
    const sideMatLeft = new THREE.MeshStandardMaterial({ map: sideTexLeft, roughness: 0.35 });
    const sideMatRight = new THREE.MeshStandardMaterial({ map: sideTexRight, roughness: 0.35 });
    const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.4 });
    const frontMat = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.4 });
    const rearMat = new THREE.MeshStandardMaterial({ map: rearTex, roughness: 0.4 });

    // 1. VAN MAIN BODY
    // Lower body box (Cyan section, width 1.44m, length 3.32m)
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.62, 3.32), bodyCyanMat);
    lowerBody.position.set(0, 0.31, -0.02);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = false;
    this.chassisGroup.add(lowerBody);

    // Upper cargo box (Green section, width 1.42m, length 3.24m)
    const upperBody = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.74, 3.24), bodyGreenMat);
    upperBody.position.set(0, 0.94, -0.06);
    upperBody.castShadow = false;
    this.chassisGroup.add(upperBody);

    // Textured Side Panels (Full 2K resolution livery with gradient, lightning, & logos)
    const sidePanelGeo = new THREE.PlaneGeometry(3.32, 1.40);
    const leftPanel = new THREE.Mesh(sidePanelGeo, sideMatLeft);
    leftPanel.position.set(-0.725, 0.73, -0.02);
    leftPanel.rotation.y = -Math.PI / 2;
    this.chassisGroup.add(leftPanel);

    const rightPanel = new THREE.Mesh(sidePanelGeo, sideMatRight);
    rightPanel.position.set(0.725, 0.73, -0.02);
    rightPanel.rotation.y = Math.PI / 2;
    this.chassisGroup.add(rightPanel);

    // 2. FRONT SNUB-NOSE CAB & HOOD
    // Front Fascia Block (Nose)
    const frontFascia = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.58, 0.42), frontMat);
    frontFascia.position.set(0, 0.36, 1.62);
    this.chassisGroup.add(frontFascia);

    // Slanted Hood Transition (Slopes from windshield down to front nose)
    const hoodGeo = new THREE.BoxGeometry(1.40, 0.12, 0.36);
    const hood = new THREE.Mesh(hoodGeo, bodyGreenMat);
    hood.position.set(0, 0.66, 1.54);
    hood.rotation.x = THREE.MathUtils.degToRad(18);
    this.chassisGroup.add(hood);

    // Slanted Front Windshield (Kei cab angle ~36 deg)
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.80), glassMat);
    windshield.position.set(0, 1.05, 1.36);
    windshield.rotation.x = -THREE.MathUtils.degToRad(36);
    this.chassisGroup.add(windshield);

    // Windshield frame & A-pillars
    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.82, 0.06), trimMat);
    pillarL.position.set(-0.68, 1.05, 1.36);
    pillarL.rotation.x = -THREE.MathUtils.degToRad(36);
    const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.82, 0.06), trimMat);
    pillarR.position.set(0.68, 1.05, 1.36);
    pillarR.rotation.x = -THREE.MathUtils.degToRad(36);
    this.chassisGroup.add(pillarL, pillarR);

    // Dual black windshield wipers
    const wiperL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.02, 0.02), trimMat);
    wiperL.position.set(-0.32, 0.78, 1.54);
    wiperL.rotation.x = -THREE.MathUtils.degToRad(36);
    wiperL.rotation.z = THREE.MathUtils.degToRad(12);
    const wiperR = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.02, 0.02), trimMat);
    wiperR.position.set(0.32, 0.78, 1.54);
    wiperR.rotation.x = -THREE.MathUtils.degToRad(36);
    wiperR.rotation.z = THREE.MathUtils.degToRad(12);
    this.chassisGroup.add(wiperL, wiperR);

    // 3. 3D FRONT GRILLE & CHROME SUZUKI EMBLEM
    const frontGrille = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.18, 0.06), bumperMat);
    frontGrille.position.set(0, 0.40, 1.84);
    this.chassisGroup.add(frontGrille);

    const suzukiBadge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.03), chromeMat);
    suzukiBadge.position.set(0, 0.40, 1.88);
    this.chassisGroup.add(suzukiBadge);

    // 4. 3D RECTANGULAR HEADLIGHT ASSEMBLIES
    const createHeadlightAssembly = (x) => {
      const group = new THREE.Group();
      group.position.set(x, 0.44, 1.83);

      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.06), chromeMat);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), glassMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(x < 0 ? 0.03 : -0.03, 0, 0.03);
      const amber = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.04), amberLensMat);
      amber.position.set(x < 0 ? -0.10 : 0.10, 0, 0.02);

      group.add(housing, lens, amber);
      return group;
    };
    this.chassisGroup.add(createHeadlightAssembly(-0.52));
    this.chassisGroup.add(createHeadlightAssembly(0.52));

    // 5. WRAP-AROUND MATTE BLACK FRONT BUMPER & LICENSE PLATE
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.30, 0.34), bumperMat);
    frontBumper.position.set(0, 0.16, 1.78);
    frontBumper.castShadow = true;
    this.chassisGroup.add(frontBumper);

    const plateGeo = new THREE.BoxGeometry(0.38, 0.14, 0.02);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.5 });
    const frontPlate = new THREE.Mesh(plateGeo, plateMat);
    frontPlate.position.set(0, 0.13, 1.96);
    this.chassisGroup.add(frontPlate);

    // 6. AERODYNAMIC RECTANGULAR SIDE-VIEW MIRRORS
    const createSideMirror = (x, isLeft) => {
      const mirrorGroup = new THREE.Group();
      mirrorGroup.position.set(x, 0.88, 1.15);

      const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.03, 0.04), trimMat);
      stalk.position.set(isLeft ? 0.05 : -0.05, -0.02, 0);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.12), trimMat);
      head.position.set(isLeft ? -0.04 : 0.04, 0.04, -0.02);

      const mirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.10, 0.16), chromeMat);
      mirrorGlass.position.set(isLeft ? -0.071 : 0.071, 0.04, -0.02);
      mirrorGlass.rotation.y = isLeft ? -Math.PI / 2 : Math.PI / 2;

      mirrorGroup.add(stalk, head, mirrorGlass);
      return mirrorGroup;
    };
    this.chassisGroup.add(createSideMirror(-0.78, true));
    this.chassisGroup.add(createSideMirror(0.78, false));

    // 7. BLACK LOWER ROCKER SILLS & CONTOURED WHEEL ARCH FENDERS
    const rockerL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 1.40), trimMat);
    rockerL.position.set(-0.725, 0.06, 0);
    const rockerR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 1.40), trimMat);
    rockerR.position.set(0.725, 0.06, 0);
    this.chassisGroup.add(rockerL, rockerR);

    const createWheelArch = (x, z) => {
      const arch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.20, 0.74), trimMat);
      arch.position.set(x, 0.16, z);
      return arch;
    };
    this.chassisGroup.add(createWheelArch(-0.73, 1.05));
    this.chassisGroup.add(createWheelArch(0.73, 1.05));
    this.chassisGroup.add(createWheelArch(-0.73, -1.05));
    this.chassisGroup.add(createWheelArch(0.73, -1.05));

    // 8. ROOF PANEL (Matching Model Sheet TOP VIEW)
    const roofPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 3.20), roofMat);
    roofPanel.position.set(0, 1.32, -0.05);
    roofPanel.rotation.x = -Math.PI / 2;
    this.chassisGroup.add(roofPanel);

    // 9. REAR ROOF SPOILER / RACK BAR (Signature Teal Lip as in Model Sheet)
    const spoilerGroup = new THREE.Group();
    spoilerGroup.position.set(0, 1.38, -1.56);

    const stanchionL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.24), spoilerTealMat);
    stanchionL.position.set(-0.58, 0.06, 0);
    stanchionL.rotation.x = THREE.MathUtils.degToRad(22);

    const stanchionR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.24), spoilerTealMat);
    stanchionR.position.set(0.58, 0.06, 0);
    stanchionR.rotation.x = THREE.MathUtils.degToRad(22);

    const spoilerBar = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.06, 0.14), spoilerTealMat);
    spoilerBar.position.set(0, 0.14, 0.04);

    spoilerGroup.add(stanchionL, stanchionR, spoilerBar);
    this.chassisGroup.add(spoilerGroup);

    // 10. REAR MATTE BLACK BUMPER & UNDERBODY EXHAUST
    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.28, 0.28), bumperMat);
    rearBumper.position.set(0, 0.15, -1.68);
    rearBumper.castShadow = true;
    this.chassisGroup.add(rearBumper);

    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 12), chromeMat);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0.44, 0.06, -1.74);
    this.chassisGroup.add(exhaust);

    // 11. 3D VERTICAL REAR CORNER TAILLIGHT CLUSTERS & DUAL BRAKE LIGHTS
    // Accurately positioned on outer corner pillars (x = ±0.64, y = 0.56, z = -1.69)
    this.tailGlowMat = new THREE.MeshStandardMaterial({
      color: 0x3a0808,
      emissive: 0x120202,
      emissiveIntensity: 0.2,
      roughness: 0.2,
      metalness: 0.1
    });

    const createTailCluster = (x, isLeft) => {
      const cluster = new THREE.Group();
      cluster.position.set(x, 0.56, -1.69);

      // Dark housing bezel
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.46, 0.04), trimMat);
      housing.position.set(0, 0, 0);

      // Red brake lens (top segment, centered at y = 0.70 in world space)
      const redLens = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.03), this.tailGlowMat);
      redLens.position.set(0, 0.14, 0.018);

      // Amber turn signal lens (middle segment, centered at y = 0.565 in world space)
      const amberLens = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.03), amberLensMat);
      amberLens.position.set(0, 0.005, 0.018);

      // White reverse lens (bottom segment, centered at y = 0.445 in world space)
      const revLens = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.10, 0.03), whiteLensMat);
      revLens.position.set(0, -0.11, 0.018);

      // Wrap-around side corner red reflector (as seen in model sheet SIDE VIEWS)
      const sideReflector = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.08), this.tailGlowMat);
      sideReflector.position.set(isLeft ? -0.055 : 0.055, 0.14, 0.035);

      cluster.add(housing, redLens, amberLens, revLens, sideReflector);
      return cluster;
    };
    this.chassisGroup.add(createTailCluster(-0.64, true));
    this.chassisGroup.add(createTailCluster(0.64, false));

    // Dynamic Red Brake Lights - Dual point lights positioned directly at each red brake lens
    this.brakeLightL = new THREE.PointLight(0xff0022, 0, 3.5, 2);
    this.brakeLightL.position.set(-0.64, 0.70, -1.74);
    this.chassisGroup.add(this.brakeLightL);

    this.brakeLightR = new THREE.PointLight(0xff0022, 0, 3.5, 2);
    this.brakeLightR.position.set(0.64, 0.70, -1.74);
    this.chassisGroup.add(this.brakeLightR);

    // Headlight Spotlights
    this.headlightL = new THREE.SpotLight(0xffffff, 2.5, 30, Math.PI / 6, 0.4);
    this.headlightL.position.set(-0.5, 0.48, 1.7);
    this.headlightL.target.position.set(-0.5, 0.1, 15);
    this.chassisGroup.add(this.headlightL, this.headlightL.target);

    this.headlightR = new THREE.SpotLight(0xffffff, 2.5, 30, Math.PI / 6, 0.4);
    this.headlightR.position.set(0.5, 0.48, 1.7);
    this.headlightR.target.position.set(0.5, 0.1, 15);
    this.chassisGroup.add(this.headlightR, this.headlightR.target);

    // 12. DASHBOARD & STEERING WHEEL
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.32, 0.45), trimMat);
    dash.position.set(0, 0.72, 1.15);
    this.chassisGroup.add(dash);

    this.steeringWheelPivot = new THREE.Group();
    this.steeringWheelPivot.position.set(-0.35, 0.84, 0.98);
    this.steeringWheelPivot.rotation.x = -THREE.MathUtils.degToRad(25);
    const wheelTorus = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.024, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 })
    );
    this.steeringWheelPivot.add(wheelTorus);
    this.chassisGroup.add(this.steeringWheelPivot);

    // 13. ANIMATED DOORS
    // Side Sliding Cargo Door
    this.sideSlideDoor = new THREE.Group();
    this.sideSlideDoor.position.set(0.725, 0.73, 0.15);
    const slideDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.25, 1.1), sideMatRight);
    this.sideSlideDoor.add(slideDoorMesh);
    this.chassisGroup.add(this.sideSlideDoor);

    // Rear Barn Doors (Width 0.57 each, positioned between corner pillars without overlapping taillights)
    this.rearDoorLeftPivot = new THREE.Group();
    this.rearDoorLeftPivot.position.set(-0.57, 0.72, -1.684);

    const doorGeoL = new THREE.PlaneGeometry(0.57, 1.30);
    doorGeoL.rotateY(Math.PI);
    const uvL = doorGeoL.attributes.uv;
    uvL.setXY(0, 0.50, 1.0);
    uvL.setXY(1, 0.08, 1.0);
    uvL.setXY(2, 0.50, 0.0);
    uvL.setXY(3, 0.08, 0.0);
    doorGeoL.uvsNeedUpdate = true;

    const rearDoorLMesh = new THREE.Mesh(doorGeoL, rearMat);
    rearDoorLMesh.position.set(0.285, 0, 0);
    this.rearDoorLeftPivot.add(rearDoorLMesh);
    this.chassisGroup.add(this.rearDoorLeftPivot);

    this.rearDoorRightPivot = new THREE.Group();
    this.rearDoorRightPivot.position.set(0.57, 0.72, -1.684);

    const doorGeoR = new THREE.PlaneGeometry(0.57, 1.30);
    doorGeoR.rotateY(Math.PI);
    const uvR = doorGeoR.attributes.uv;
    uvR.setXY(0, 0.92, 1.0);
    uvR.setXY(1, 0.50, 1.0);
    uvR.setXY(2, 0.92, 0.0);
    uvR.setXY(3, 0.50, 0.0);
    doorGeoR.uvsNeedUpdate = true;

    const rearDoorRMesh = new THREE.Mesh(doorGeoR, rearMat);
    rearDoorRMesh.position.set(-0.285, 0, 0);
    this.rearDoorRightPivot.add(rearDoorRMesh);
    this.chassisGroup.add(this.rearDoorRightPivot);

    // Cargo interior with Paper Delivery Bags
    this.cargoBed = new THREE.Group();
    this.cargoBed.position.set(0, 0.45, -0.65);
    this.chassisGroup.add(this.cargoBed);
    this.createCargoBags();

    // 14. FOUR ALL-TERRAIN WHEELS (With Multi-Spoke Silver Alloy Rims & Radial Tires)
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
      steerPivot.position.set(wp.x, 0.35, wp.z);

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

  update(dt, vehiclePhysics, input = null) {
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

    // 5. Dynamic Brake Lights
    // Turned ON when the van brakes, uses handbrake, or reverses
    const isBraking = Boolean(input && input.brake > 0.05);
    const isHandbraking = Boolean((input && input.handbrake) || vehiclePhysics.isDrifting);
    const isReversing = vehiclePhysics.speed < -0.15 || Boolean(input && input.brake > 0.05 && vehiclePhysics.speed <= 0.3);
    const isDecelBraking = Boolean(vehiclePhysics.isBrakingHard);

    const brakeActive = isBraking || isHandbraking || isReversing || isDecelBraking;

    if (brakeActive) {
      this.tailGlowMat.color.setHex(0xff1122);
      this.tailGlowMat.emissive.setHex(0xff0022);
      this.tailGlowMat.emissiveIntensity = 2.8;
      if (this.brakeLightL) this.brakeLightL.intensity = 2.4;
      if (this.brakeLightR) this.brakeLightR.intensity = 2.4;
    } else {
      this.tailGlowMat.color.setHex(0x3a0808);
      this.tailGlowMat.emissive.setHex(0x100202);
      this.tailGlowMat.emissiveIntensity = 0.15;
      if (this.brakeLightL) this.brakeLightL.intensity = 0;
      if (this.brakeLightR) this.brakeLightR.intensity = 0;
    }

    // 6. Animate Doors
    const targetSlide = this.sideDoorOpen ? 1.05 : 0;
    const targetOut = this.sideDoorOpen ? 0.08 : 0;
    this.sideDoorSlide = THREE.MathUtils.lerp(this.sideDoorSlide, targetSlide, 6.0 * dt);
    this.sideDoorOut = THREE.MathUtils.lerp(this.sideDoorOut, targetOut, 8.0 * dt);
    this.sideSlideDoor.position.x = 0.725 + this.sideDoorOut;
    this.sideSlideDoor.position.z = 0.15 - this.sideDoorSlide;

    const targetRearAngle = this.rearDoorsOpen ? 2.1 : 0;
    this.rearDoorAngle = THREE.MathUtils.lerp(this.rearDoorAngle, targetRearAngle, 6.0 * dt);
    this.rearDoorLeftPivot.rotation.y = -this.rearDoorAngle;
    this.rearDoorRightPivot.rotation.y = this.rearDoorAngle;
  }
}
