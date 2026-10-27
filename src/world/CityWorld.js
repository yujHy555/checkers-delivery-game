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
    // 1. Pristine Greybox Ground Plane (Receives shadow, clean GI studio aesthetic)
    const groundGeo = new THREE.PlaneGeometry(350, 350);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xd9e2ec, // Luminous, elegant architectural light-grey floor
      roughness: 0.88,
      metalness: 0.04
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 2. Road Network (clean open edges, slate grey with crisp white dashes)
    this.buildRoads();

    // 3. SOLID DOUBLE-SIDED 3D JUMP RAMPS (NO RAILINGS, architectural off-white matte geometry)
    this.buildDoubleSidedRamps();

    // 4. Slalom Cones Area (greybox styling)
    this.buildSlalomArea();

    // 5. Buildings & Delivery Destinations (greybox architectural masses)
    this.buildBuildings();
  }

  buildRoads() {
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x52606d, // Neutral slate-grey asphalt
      roughness: 0.75
    });

    const createRoad = (x, z, width, length, rot = 0) => {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(width, length), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = rot;
      road.position.set(x, 0.015, z);
      road.receiveShadow = true;
      this.scene.add(road);

      // Crisp Minimalist White Center Dash Lines
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
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

  buildDoubleSidedRamps() {
    // Solid simple untextured matte material - clean architectural off-white greybox
    const rampMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.65,
      metalness: 0.05,
      side: THREE.FrontSide
    });

    // Creates an airtight, solid double-sided A-Frame wedge WITHOUT any railings
    // All faces have counter-clockwise outward winding to ensure perfect normals
    const createDoubleSidedRampMesh = (w, d, h) => {
      const hw = w / 2;
      const hd = d / 2;

      // 6 Vertices of A-Frame Wedge:
      // Base: (-hw, 0, -hd), (hw, 0, -hd), (hw, 0, hd), (-hw, 0, hd)
      // Apex Ridge: (-hw, h, 0), (hw, h, 0)
      const positions = new Float32Array([
        // Face 1: South Incline Slope (slopes up from z = -hd to z = 0, facing South/Up)
        -hw, 0, -hd,    hw, h, 0,     hw, 0, -hd,
        -hw, 0, -hd,   -hw, h, 0,     hw, h, 0,

        // Face 2: North Decline Slope (slopes down from z = 0 to z = +hd, facing North/Up)
        -hw, h, 0,      hw, 0, hd,    hw, h, 0,
        -hw, h, 0,     -hw, 0, hd,    hw, 0, hd,

        // Face 3: Bottom Base (facing Down)
        -hw, 0, -hd,   -hw, 0, hd,    hw, 0, hd,
        -hw, 0, -hd,    hw, 0, hd,    hw, 0, -hd,

        // Face 4: Left Side Triangular Gable (facing West / -X)
        -hw, 0, hd,    -hw, h, 0,    -hw, 0, -hd,

        // Face 5: Right Side Triangular Gable (facing East / +X)
        hw, 0, -hd,     hw, h, 0,     hw, 0, hd
      ]);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, rampMat);
      mesh.castShadow = false; // Disables self-shadowing to eliminate all acne, scanlines & cube shadows
      mesh.receiveShadow = true; // High-precision receiver for car & wheel shadows
      return mesh;
    };

    const addDoubleSidedRamp = (x, z, w, d, h, angleY = 0) => {
      const rampMesh = createDoubleSidedRampMesh(w, d, h);
      rampMesh.position.set(x, 0, z);
      rampMesh.rotation.y = angleY;
      this.scene.add(rampMesh);

      // Register double-sided collision ramp with solid sides
      this.colliders.push({
        type: 'ramp',
        isDoubleSided: true,
        x,
        z,
        width: w,
        depth: d,
        height: h,
        angleY
      });
    };

    // Ramp 1: Main Drag Smooth Jump (Double-sided, 12m long, 2.2m high)
    addDoubleSidedRamp(0, -10, 6.5, 12.0, 2.2, 0);

    // Ramp 2: East Boulevard Jump
    addDoubleSidedRamp(45, 50, 6.5, 12.0, 2.4, -Math.PI / 2);

    // Ramp 3: West Boulevard Jump
    addDoubleSidedRamp(-45, -65, 6.5, 12.0, 2.4, Math.PI / 2);

    // Ramp 4: North Loop Stunt Jump (14m long, 3.0m high)
    addDoubleSidedRamp(0, 80, 8.0, 14.0, 3.0, 0);
  }

  buildSlalomArea() {
    const coneMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5 });
    const whiteStripeMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

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
      { id: '1', name: 'Palm Villa', x: -35, z: 25, w: 16, d: 14, h: 8, col: 0xf8fafc },
      { id: '2', name: 'Hillside Modern', x: -42, z: -35, w: 18, d: 14, h: 9, col: 0xe2e8f0 },
      { id: '3', name: 'Sunny Crest Residence', x: 44, z: 70, w: 16, d: 16, h: 8, col: 0xcbd5e1 },
      { id: '4', name: 'Orchid Court Complex', x: -40, z: 85, w: 22, d: 18, h: 14, col: 0xf1f5f9 },
      { id: '5', name: 'Checkers Mega Hub', x: 46, z: -10, w: 32, d: 28, h: 10, col: 0x94a3b8 }
    ];

    for (const b of buildingConfigs) {
      const bMat = new THREE.MeshStandardMaterial({ color: b.col, roughness: 0.85, metalness: 0.05 });
      const bMesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), bMat);
      bMesh.position.set(b.x, b.h / 2, b.z);
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      this.scene.add(bMesh);

      const trimMesh = new THREE.Mesh(
        new THREE.BoxGeometry(b.w + 0.4, 0.4, b.d + 0.4),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 })
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
