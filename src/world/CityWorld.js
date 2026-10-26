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
    // 1. Ground Plane (Receives shadow)
    const groundGeo = new THREE.PlaneGeometry(350, 350);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x27352b,
      roughness: 0.95,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 2. Road Network
    this.buildRoads();

    // 3. SOLID SIMPLE UNTEXTURED 3D JUMP RAMPS
    this.buildSolidRamps();

    // 4. Slalom Cones Area
    this.buildSlalomArea();

    // 5. Buildings & Delivery Destinations
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

      // Concrete White Edge Curbs (cast and receive shadows)
      const curbMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.7 });
      const halfW = width / 2;
      const createCurb = (cx, cz, cw, cl) => {
        const curb = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.22, cl), curbMat);
        curb.position.set(cx, 0.11, cz);
        curb.castShadow = true;
        curb.receiveShadow = true;
        this.scene.add(curb);
      };

      if (rot === 0) {
        createCurb(x - halfW - 0.2, z, 0.4, length);
        createCurb(x + halfW + 0.2, z, 0.4, length);
      } else {
        createCurb(x, z - halfW - 0.2, length, 0.4);
        createCurb(x, z + halfW + 0.2, length, 0.4);
      }
    };

    // Main Drag (North-South)
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
    // Solid simple untextured matte material (clean vibrant orange/amber)
    const rampMat = new THREE.MeshStandardMaterial({
      color: 0xff8f00, // Solid bright orange
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    const sideMat = new THREE.MeshStandardMaterial({
      color: 0x37474f, // Solid dark grey sides
      roughness: 0.6,
      side: THREE.DoubleSide
    });

    // Creates an airtight, solid triangular prism wedge
    const createSolidWedge = (w, d, h) => {
      const group = new THREE.Group();
      const hw = w / 2;
      const hd = d / 2;

      // 6 Vertices of triangular prism:
      // Bottom 4: (-hw, 0, -hd), (hw, 0, -hd), (hw, 0, hd), (-hw, 0, hd)
      // Top lip 2: (-hw, h, hd), (hw, h, hd)
      const positions = new Float32Array([
        // Face 1: Top Slanted Incline (2 triangles)
        -hw, 0, -hd,   hw, 0, -hd,   hw, h, hd,
        -hw, 0, -hd,   hw, h, hd,   -hw, h, hd,

        // Face 2: Back Vertical Wall (2 triangles)
        -hw, 0, hd,    hw, h, hd,    hw, 0, hd,
        -hw, 0, hd,   -hw, h, hd,    hw, h, hd,

        // Face 3: Bottom Base (2 triangles)
        -hw, 0, -hd,   hw, 0, hd,    hw, 0, -hd,
        -hw, 0, -hd,  -hw, 0, hd,    hw, 0, hd,

        // Face 4: Left Side Triangle
        -hw, 0, -hd,  -hw, h, hd,   -hw, 0, hd,

        // Face 5: Right Side Triangle
        hw, 0, -hd,   hw, 0, hd,    hw, h, hd
      ]);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, rampMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // Solid side guard walls to make ramps clearly visible
      const sideWallL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.45, Math.hypot(d, h)), sideMat);
      sideWallL.position.set(-hw, h / 2 + 0.22, 0);
      sideWallL.rotation.x = -Math.atan2(h, d);
      sideWallL.castShadow = true;
      group.add(sideWallL);

      const sideWallR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.45, Math.hypot(d, h)), sideMat);
      sideWallR.position.set(hw, h / 2 + 0.22, 0);
      sideWallR.rotation.x = -Math.atan2(h, d);
      sideWallR.castShadow = true;
      group.add(sideWallR);

      return group;
    };

    const addRamp = (x, z, w, d, h, angleY = 0) => {
      const wedge = createSolidWedge(w, d, h);
      wedge.position.set(x, 0, z);
      wedge.rotation.y = angleY;
      this.scene.add(wedge);

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

    // Ramp 1: Main Drag High-Speed Stunt Jump (Straight ahead, launches North)
    addRamp(0, -12, 6.5, 9.0, 2.8, 0);

    // Ramp 2: East Boulevard Jump (launches East)
    addRamp(45, 50, 6.5, 9.5, 3.0, -Math.PI / 2);

    // Ramp 3: West Boulevard Jump (launches West)
    addRamp(-45, -65, 6.5, 9.5, 2.8, Math.PI / 2);

    // Ramp 4: Mega Stunt Launch Ramp on North Loop
    addRamp(0, 80, 8.0, 11.0, 3.8, 0);
  }

  buildSlalomArea() {
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xff5722, roughness: 0.4 });
    const whiteStripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let i = -4; i <= 4; i++) {
      if (Math.abs(i) < 2) continue;
      const coneGroup = new THREE.Group();
      coneGroup.position.set(0, 0, i * 14);

      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.75, 12), coneMat);
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

      const trimMesh = new THREE.Mesh(
        new THREE.BoxGeometry(b.w + 0.4, 0.4, b.d + 0.4),
        new THREE.MeshStandardMaterial({ color: 0x00bcd4, roughness: 0.3 })
      );
      trimMesh.position.set(b.x, b.h + 0.2, b.z);
      this.scene.add(trimMesh);

      this.colliders.push({
        type: 'box',
        x: b.x,
        z: b.z,
        width: b.w + 0.5,
        depth: b.d + 0.5
      });

      this.deliverySpots.push({
        id: b.id,
        name: b.name,
        position: new THREE.Vector3(b.x, 0.2, b.z + b.d / 2 + 5.5)
      });
    }
  }
}
