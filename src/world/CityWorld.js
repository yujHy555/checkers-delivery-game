import * as THREE from 'three';
import { TextureGenerator } from '../utils/TextureGenerator.js';

export class CityWorld {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.deliverySpots = [];
    this.hubPosition = new THREE.Vector3(0, 0, 0);

    this.buildWorld();
  }

  buildWorld() {
    // 1. Ground Plane (Grass & Terrain)
    const groundGeo = new THREE.PlaneGeometry(300, 300);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x4caf50,
      roughness: 0.9,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 2. Road Network
    this.buildRoads();

    // 3. Central Checkers Supermarket Hub
    this.buildCheckersHub();

    // 4. Neighborhood Houses & Delivery Drop-offs
    this.buildHouses();

    // 5. Jump Ramps (for arcade jumps & suspension testing)
    this.buildJumpRamps();

    // 6. Street Props (Trees, Streetlights, Barriers)
    this.buildProps();
  }

  buildRoads() {
    const roadMat = new THREE.MeshStandardMaterial({
      map: TextureGenerator.createAsphaltTexture(),
      roughness: 0.85
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
      const numDashes = Math.floor(length / 6);
      for (let i = 0; i < numDashes; i++) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 3.2), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = rot;
        const offset = (i - numDashes / 2) * 6;
        if (rot === 0) {
          dash.position.set(x, 0.02, z + offset);
        } else {
          dash.position.set(x + offset, 0.02, z);
        }
        this.scene.add(dash);
      }
    };

    // Main Avenue (North-South)
    createRoad(0, 0, 16, 240, 0);

    // Cross Boulevard (East-West)
    createRoad(0, 40, 16, 240, Math.PI / 2);
    createRoad(0, -60, 14, 240, Math.PI / 2);

    // Suburban Winding Streets
    createRoad(70, 0, 12, 140, 0);
    createRoad(-70, -10, 12, 160, 0);
    createRoad(0, 95, 12, 180, Math.PI / 2);
  }

  buildCheckersHub() {
    // Checkers Supermarket Mega Store
    const hubGroup = new THREE.Group();
    hubGroup.position.set(38, 0, -10);

    // Store building
    const storeMat = new THREE.MeshStandardMaterial({ color: 0x1c313a, roughness: 0.5 });
    const storeMesh = new THREE.Mesh(new THREE.BoxGeometry(32, 12, 28), storeMat);
    storeMesh.position.y = 6;
    storeMesh.castShadow = true;
    hubGroup.add(storeMesh);

    // Sixty60 Billboard Banner
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 512;
    bannerCanvas.height = 128;
    const ctx = bannerCanvas.getContext('2d');
    ctx.fillStyle = '#00bcd4';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 900 42px "Arial Black", Impact';
    ctx.fillText('Checkers Hyper SIXTY60', 16, 80);
    const bannerTex = new THREE.CanvasTexture(bannerCanvas);

    const bannerMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 6),
      new THREE.MeshBasicMaterial({ map: bannerTex })
    );
    bannerMesh.position.set(0, 10, -14.1);
    bannerMesh.rotation.y = Math.PI;
    hubGroup.add(bannerMesh);

    // Loading Bay Canopies
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x13b843, roughness: 0.4 });
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 8), canopyMat);
    canopy.position.set(0, 4.8, -17);
    hubGroup.add(canopy);

    this.scene.add(hubGroup);

    // Register collider
    this.colliders.push({
      type: 'box',
      x: hubGroup.position.x,
      z: hubGroup.position.y,
      width: 33,
      depth: 29
    });

    this.hubPosition.set(38, 0, -28);
  }

  buildHouses() {
    const houseConfigs = [
      { id: '1', name: 'Palm Villa', x: -35, z: 25, color: 0xf5f5f5, roof: 0xb71c1c },
      { id: '2', name: 'Hillside Modern', x: -40, z: -35, color: 0xe0e0e0, roof: 0x263238 },
      { id: '3', name: 'Sunny Crest Residence', x: 42, z: 65, color: 0xffecb3, roof: 0xbf360c },
      { id: '4', name: 'Orchid Court Apartments', x: -38, z: 80, color: 0xcfd8dc, roof: 0x37474f, height: 16 },
      { id: '5', name: 'Boutique Corner Cafe', x: 38, z: -85, color: 0xffcdd2, roof: 0x4e342e },
      { id: '6', name: 'Pine Avenue Manor', x: -85, z: 30, color: 0xd7ccc8, roof: 0x1b5e20 }
    ];

    const wallMat = (col) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 });
    const roofMat = (col) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 });

    for (const h of houseConfigs) {
      const houseGroup = new THREE.Group();
      houseGroup.position.set(h.x, 0, h.z);

      const hH = h.height || 7;
      const bMesh = new THREE.Mesh(new THREE.BoxGeometry(14, hH, 12), wallMat(h.color));
      bMesh.position.y = hH / 2;
      bMesh.castShadow = true;
      houseGroup.add(bMesh);

      // Roof
      const rMesh = new THREE.Mesh(new THREE.ConeGeometry(10.5, 4.5, 4), roofMat(h.roof));
      rMesh.position.y = hH + 2.25;
      rMesh.rotation.y = Math.PI / 4;
      rMesh.castShadow = true;
      houseGroup.add(rMesh);

      // Front Doorway / Porch
      const porch = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, 0.2, 3),
        new THREE.MeshStandardMaterial({ color: 0x78909c })
      );
      porch.position.set(0, 0.1, 7);
      houseGroup.add(porch);

      // Delivery Destination Zone: Drop-off marker on the porch
      const dropSpot = {
        id: h.id,
        name: h.name,
        position: new THREE.Vector3(h.x, 0.2, h.z + 7.2),
        drivewayPos: new THREE.Vector3(h.x, 0, h.z + 12)
      };
      this.deliverySpots.push(dropSpot);

      this.scene.add(houseGroup);

      // Register collision box
      this.colliders.push({
        type: 'box',
        x: h.x,
        z: h.z,
        width: 15,
        depth: 13
      });
    }
  }

  buildJumpRamps() {
    // Stunt ramps placed along open roads to test jumps and suspension!
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xffb300, roughness: 0.5 });

    const createRamp = (x, z, w, d, h, angleY = 0) => {
      const rampGeo = new THREE.BufferGeometry();
      // Wedge geometry
      const hw = w / 2, hd = d / 2;
      const vertices = new Float32Array([
        // Bottom
        -hw, 0, -hd,   hw, 0, -hd,   hw, 0, hd,
        -hw, 0, -hd,   hw, 0, hd,   -hw, 0, hd,
        // Slanted top ramp
        -hw, 0, -hd,   hw, 0, -hd,   hw, h, hd,
        -hw, 0, -hd,   hw, h, hd,   -hw, h, hd,
        // Back wall
        -hw, 0, hd,    hw, 0, hd,    hw, h, hd,
        -hw, 0, hd,    hw, h, hd,   -hw, h, hd,
      ]);
      rampGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      rampGeo.computeVertexNormals();

      const rampMesh = new THREE.Mesh(rampGeo, rampMat);
      rampMesh.position.set(x, 0, z);
      rampMesh.rotation.y = angleY;
      rampMesh.castShadow = true;
      rampMesh.receiveShadow = true;
      this.scene.add(rampMesh);

      // Register ramp physics
      this.colliders.push({
        type: 'ramp',
        x,
        z,
        width: w,
        depth: d,
        height: h,
        baseY: 0
      });
    };

    // Ramp 1 on Main Avenue (facing north)
    createRamp(0, -18, 5.5, 7.5, 2.2, 0);

    // Ramp 2 on East Boulevard
    createRamp(50, 40, 5.5, 8.0, 2.5, -Math.PI / 2);

    // Ramp 3 in open park space
    createRamp(-45, -5, 6.0, 9.0, 3.2, Math.PI / 4);
  }

  buildProps() {
    // Trees
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.7 });

    const treeGeoTrunk = new THREE.CylinderGeometry(0.25, 0.35, 2.8, 8);
    const treeGeoFoliage = new THREE.SphereGeometry(1.6, 8, 8);

    const createTree = (x, z) => {
      const tree = new THREE.Group();
      tree.position.set(x, 0, z);

      const trunk = new THREE.Mesh(treeGeoTrunk, trunkMat);
      trunk.position.y = 1.4;
      trunk.castShadow = true;

      const leaves = new THREE.Mesh(treeGeoFoliage, foliageMat);
      leaves.position.y = 3.6;
      leaves.castShadow = true;

      tree.add(trunk, leaves);
      this.scene.add(tree);

      this.colliders.push({
        type: 'box',
        x,
        z,
        width: 1.2,
        depth: 1.2
      });
    };

    // Place trees along roads
    for (let z = -100; z <= 100; z += 30) {
      if (Math.abs(z - 40) > 12 && Math.abs(z + 60) > 12) {
        createTree(-11, z);
        createTree(11, z);
      }
    }
  }
}
