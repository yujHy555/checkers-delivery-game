import * as THREE from 'three';
import { TextureGenerator } from '../utils/TextureGenerator.js';

export class CityWorld {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.deliverySpots = [];

    this.buildWorld();
  }

  buildWorld() {
    // 1. Clean Ground Plane
    const groundGeo = new THREE.PlaneGeometry(350, 350);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x243328,
      roughness: 0.9,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 2. High-Readability Road Network
    this.buildRoads();

    // 3. SOLID 3D JUMP RAMPS (Fix: full geometry + DoubleSide + hazard texture)
    this.buildSolidRamps();

    // 4. Slalom Cones Area (for testing steering & grip)
    this.buildSlalomArea();

    // 5. Buildings & Delivery Destinations (Greybox functional)
    this.buildBuildings();
  }

  buildRoads() {
    const roadMat = new THREE.MeshStandardMaterial({
      map: TextureGenerator.createAsphaltTexture(),
      roughness: 0.8
    });

    const createRoad = (x, z, width, length, rot = 0) => {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(width, length), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = rot;
      road.position.set(x, 0.015, z);
      road.receiveShadow = true;
      this.scene.add(road);

      // Yellow Center Dash Lines
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xffd54f });
      const numDashes = Math.floor(length / 7);
      for (let i = 0; i < numDashes; i++) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 3.8), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = rot;
        const offset = (i - numDashes / 2) * 7;
        if (rot === 0) {
          dash.position.set(x, 0.02, z + offset);
        } else {
          dash.position.set(x + offset, 0.02, z);
        }
        this.scene.add(dash);
      }

      // Concrete White Edge Curbs
      const curbMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.7 });
      const createCurb = (cx, cz, cw, cl, crot) => {
        const curb = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.22, cl), curbMat);
        curb.position.set(cx, 0.11, cz);
        curb.rotation.y = crot;
        this.scene.add(curb);
      };

      const halfW = width / 2;
      if (rot === 0) {
        createCurb(x - halfW - 0.2, z, 0.4, length, 0);
        createCurb(x + halfW + 0.2, z, 0.4, length, 0);
      } else {
        createCurb(x, z - halfW - 0.2, length, 0.4, 0);
        createCurb(x, z + halfW + 0.2, length, 0.4, 0);
      }
    };

    // Main Drag (North-South, 18m wide)
    createRoad(0, 0, 18, 260, 0);

    // Cross Boulevards
    createRoad(0, 50, 16, 260, Math.PI / 2);
    createRoad(0, -65, 16, 260, Math.PI / 2);

    // Outer Circuit
    createRoad(80, 0, 14, 160, 0);
    createRoad(-80, -5, 14, 180, 0);
    createRoad(0, 105, 14, 180, Math.PI / 2);
  }

  buildSolidRamps() {
    // Generate Hazard Stripe Texture (Yellow and Black chevrons)
    const rampCanvas = document.createElement('canvas');
    rampCanvas.width = 256;
    rampCanvas.height = 256;
    const ctx = rampCanvas.getContext('2d');
    ctx.fillStyle = '#ffb300';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#111111';
    for (let y = -256; y < 512; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y + 128);
      ctx.lineTo(256, y + 168);
      ctx.lineTo(0, y + 40);
      ctx.closePath();
      ctx.fill();
    }
    const hazardTex = new THREE.CanvasTexture(rampCanvas);
    hazardTex.wrapS = THREE.RepeatWrapping;
    hazardTex.wrapT = THREE.RepeatWrapping;
    hazardTex.repeat.set(2, 4);

    const rampMat = new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.5,
      metalness: 0.2,
      side: THREE.DoubleSide // Guarantee visibility from all angles
    });

    const sideWallMat = new THREE.MeshStandardMaterial({
      color: 0x37474f,
      roughness: 0.7,
      side: THREE.DoubleSide
    });

    // Helper: Creates a 100% solid, closed 3D wedge with properly wound faces
    const createSolidRampMesh = (w, d, h) => {
      const group = new THREE.Group();
      const hw = w / 2;
      const hd = d / 2;

      // 1. Top Slanted Surface
      const topGeo = new THREE.PlaneGeometry(w, Math.hypot(d, h));
      const topMesh = new THREE.Mesh(topGeo, rampMat);
      topMesh.position.set(0, h / 2, 0);
      topMesh.rotation.x = -Math.atan2(h, d);
      topMesh.castShadow = true;
      topMesh.receiveShadow = true;
      group.add(topMesh);

      // 2. Back Vertical Wall
      const backGeo = new THREE.PlaneGeometry(w, h);
      const backMesh = new THREE.Mesh(backGeo, sideWallMat);
      backMesh.position.set(0, h / 2, hd);
      backMesh.castShadow = true;
      group.add(backMesh);

      // 3. Left Side Triangular Wall
      const leftShape = new THREE.Shape();
      leftShape.moveTo(-hd, 0);
      leftShape.lineTo(hd, 0);
      leftShape.lineTo(hd, h);
      leftShape.closePath();
      const sideGeoL = new THREE.ShapeGeometry(leftShape);
      const leftMesh = new THREE.Mesh(sideGeoL, sideWallMat);
      leftMesh.position.set(-hw, 0, 0);
      leftMesh.rotation.y = -Math.PI / 2;
      group.add(leftMesh);

      // 4. Right Side Triangular Wall
      const sideGeoR = new THREE.ShapeGeometry(leftShape);
      const rightMesh = new THREE.Mesh(sideGeoR, sideWallMat);
      rightMesh.position.set(hw, 0, 0);
      rightMesh.rotation.y = Math.PI / 2;
      group.add(rightMesh);

      // 5. Red Safety Guard Rails on sides
      const railMat = new THREE.MeshStandardMaterial({ color: 0xe53935 });
      const railL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, Math.hypot(d, h)), railMat);
      railL.position.set(-hw, h / 2 + 0.22, 0);
      railL.rotation.x = -Math.atan2(h, d);
      group.add(railL);

      const railR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, Math.hypot(d, h)), railMat);
      railR.position.set(hw, h / 2 + 0.22, 0);
      railR.rotation.x = -Math.atan2(h, d);
      group.add(railR);

      return group;
    };

    const addRamp = (x, z, w, d, h, angleY = 0) => {
      const rampMesh = createSolidRampMesh(w, d, h);
      rampMesh.position.set(x, 0, z);
      rampMesh.rotation.y = angleY;
      this.scene.add(rampMesh);

      // Register collision ramp
      this.colliders.push({
        type: 'ramp',
        x,
        z,
        width: w,
        depth: d,
        height: h,
        angleY
      });
    };

    // Ramp 1: Main Drag High-Speed Jump (launches North)
    addRamp(0, -15, 6.5, 9.0, 2.6, 0);

    // Ramp 2: East Boulevard Stunt Ramp (launches East)
    addRamp(45, 50, 6.5, 9.5, 3.0, -Math.PI / 2);

    // Ramp 3: West Boulevard Jump (launches West)
    addRamp(-45, -65, 6.5, 9.5, 2.8, Math.PI / 2);

    // Ramp 4: Mega Stunt Ramp on the North Loop
    addRamp(0, 80, 8.0, 11.0, 3.8, 0);
  }

  buildSlalomArea() {
    // Slalom cones test zone (for testing sharp steering and traction)
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6d00, roughness: 0.4 });
    const whiteStripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let i = -4; i <= 4; i++) {
      if (Math.abs(i) < 2) continue; // leave space near center
      const coneGroup = new THREE.Group();
      coneGroup.position.set(0, 0, i * 14);

      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 12), coneMat);
      cone.position.y = 0.375;
      cone.castShadow = true;
      coneGroup.add(cone);

      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.15, 12), whiteStripeMat);
      stripe.position.y = 0.35;
      coneGroup.add(stripe);

      this.scene.add(coneGroup);
    }
  }

  buildBuildings() {
    // Greybox Functional Neighborhood & Checkers Hub
    const buildingConfigs = [
      { id: '1', name: 'Palm Villa', x: -35, z: 25, w: 16, d: 14, h: 8, col: 0x37474f },
      { id: '2', name: 'Hillside Modern', x: -42, z: -35, w: 18, d: 14, h: 9, col: 0x455a64 },
      { id: '3', name: 'Sunny Crest Residence', x: 44, z: 70, w: 16, d: 16, h: 8, col: 0x546e7a },
      { id: '4', name: 'Orchid Court Complex', x: -40, z: 85, w: 22, d: 18, h: 14, col: 0x263238 },
      { id: '5', name: 'Checkers Mega Hub', x: 46, z: -10, w: 32, d: 28, h: 10, col: 0x1b2831 }
    ];

    for (const b of buildingConfigs) {
      const bMat = new THREE.MeshStandardMaterial({ color: b.col, roughness: 0.7 });
      const bMesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), bMat);
      bMesh.position.set(b.x, b.h / 2, b.z);
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      this.scene.add(bMesh);

      // Roof edge trim
      const trimMesh = new THREE.Mesh(
        new THREE.BoxGeometry(b.w + 0.4, 0.4, b.d + 0.4),
        new THREE.MeshStandardMaterial({ color: 0x00bcd4, roughness: 0.3 })
      );
      trimMesh.position.set(b.x, b.h + 0.2, b.z);
      this.scene.add(trimMesh);

      // Register collision box
      this.colliders.push({
        type: 'box',
        x: b.x,
        z: b.z,
        width: b.w + 0.5,
        depth: b.d + 0.5
      });

      // Delivery Destination Zone
      this.deliverySpots.push({
        id: b.id,
        name: b.name,
        position: new THREE.Vector3(b.x, 0.2, b.z + b.d / 2 + 5.5)
      });
    }
  }
}
