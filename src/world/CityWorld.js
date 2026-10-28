import * as THREE from 'three';
import { TextureGenerator } from '../utils/TextureGenerator.js';

export class CityWorld {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.deliverySpots = [];
    this.cones = [];

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

    // 2. SOLID DOUBLE-SIDED 3D JUMP RAMPS (NO RAILINGS - registered first so road lines know ramp bounds)
    this.buildDoubleSidedRamps();

    // 2b. ELEVATED SKYWAY BRIDGE SECTION (Bridge 1 + Connecting Ramp + Bridge 2)
    this.buildElevatedSkywayBridge();

    // 3. Continuous Closed Loop Racetrack Circuit with Modern Rounded Corners & Edges
    this.buildRoads();

    // 4. Interactive Traffic Cones with Modern Rounded Edges & Accurate Physics
    this.buildSlalomArea();

    // 5. Buildings with Modern Rounded Edges & Architectural GI Aesthetics
    this.buildBuildings();
  }

  // Checks if a point lies within or immediately adjacent to any jump ramp or bridge
  isPointOnOrNearRamp(x, z, margin = 2.5) {
    if (!this.colliders) return false;
    for (const c of this.colliders) {
      if (c.type === 'ramp' || c.type === 'bridge' || c.type === 'elevated_ramp') {
        const dx = x - c.x;
        const dz = z - c.z;
        const ang = c.angleY || 0;
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);
        const localX = dx * cosA - dz * sinA;
        const localZ = dx * sinA + dz * cosA;

        const hw = c.width / 2 + margin;
        const hd = (c.depth || c.length || 0) / 2 + margin;

        if (Math.abs(localX) <= hw && Math.abs(localZ) <= hd) {
          return true;
        }
      }
    }
    return false;
  }

  buildRoads() {
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x485460, // Modern slate-grey racetrack asphalt
      roughness: 0.72,
      metalness: 0.05
    });

    // AAA Racing Track Curbs (Alternating White & Turquoise Rumble Strips)
    const curbWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.40,
      metalness: 0.05
    });

    const curbTurquoiseMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4, // Vibrant modern turquoise
      roughness: 0.35,
      metalness: 0.08
    });

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

    // Creates reusable geometry for curb rumble blocks with smooth rounded corners & soft top bevel
    const createRoundedCurbGeo = (w, l, h = 0.095, radius = 0.08, bevel = 0.015) => {
      const shape = new THREE.Shape();
      const hw = w / 2;
      const hl = l / 2;
      const r = Math.min(radius, hw * 0.35, hl * 0.35);

      shape.moveTo(-hw + r, -hl);
      shape.lineTo(hw - r, -hl);
      shape.quadraticCurveTo(hw, -hl, hw, -hl + r);
      shape.lineTo(hw, hl - r);
      shape.quadraticCurveTo(hw, hl, hw - r, hl);
      shape.lineTo(-hw + r, hl);
      shape.quadraticCurveTo(-hw, hl, -hw, hl - r);
      shape.lineTo(-hw, -hl + r);
      shape.quadraticCurveTo(-hw, -hl, -hw + r, -hl);

      const extrudeSettings = {
        curveSegments: 3,
        depth: h - bevel * 2,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: bevel,
        bevelThickness: bevel
      };

      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geo.center();
      geo.computeVertexNormals();
      return geo;
    };

    const straightCurbGeo = createRoundedCurbGeo(0.90, 2.30, 0.095, 0.08, 0.015);

    // Road Junction Clearing Zones (Curbs never cross into active intersections)
    const junctions = [
      { minX: -10.2, maxX: 10.2, minZ: 100.5, maxZ: 119.5 }, // Center Spine & North Straight
      { minX: -10.2, maxX: 10.2, minZ: -109.5, maxZ: -90.5 }, // Center Spine & South Straight
      { minX: -10.2, maxX: 10.2, minZ: 40.5, maxZ: 59.5 },    // Center Spine & North Cross
      { minX: -10.2, maxX: 10.2, minZ: -74.5, maxZ: -55.5 },  // Center Spine & South Cross
      { minX: 62.5, maxX: 81.5, minZ: 40.5, maxZ: 59.5 },     // East Straight & North Cross
      { minX: -81.5, maxX: -62.5, minZ: 40.5, maxZ: 59.5 },   // West Straight & North Cross
      { minX: 62.5, maxX: 81.5, minZ: -74.5, maxZ: -55.5 },   // East Straight & South Cross
      { minX: -81.5, maxX: -62.5, minZ: -74.5, maxZ: -55.5 }   // West Straight & South Cross
    ];

    const isInsideAnyJunction = (minX, maxX, minZ, maxZ) => {
      for (const j of junctions) {
        const xOver = Math.min(maxX, j.maxX) - Math.max(minX, j.minX);
        const zOver = Math.min(maxZ, j.maxZ) - Math.max(minZ, j.minZ);
        if (xOver > 0.05 && zOver > 0.05) return true;
      }
      return false;
    };

    const placedCurbBoxes = [];

    // Creates a straight road segment with elevated 3D rounded-corner alternating white & turquoise curbs
    const createStraightRoad = (x, z, width, length, rot = 0) => {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(width, length), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = rot;
      road.position.set(x, 0.015, z);
      road.receiveShadow = true;
      this.scene.add(road);

      // Elevated 3D Racing Rumble Strip Curbs along left and right borders
      const curbWidth = 0.90;
      const hw = width / 2;
      const segLength = 2.30;
      const segStep = 2.40; // 2.30m block + 0.10m clean expansion gap
      const numCurbSegs = Math.floor(length / segStep);

      [-hw - curbWidth / 2, hw + curbWidth / 2].forEach((offsetDist) => {
        for (let s = 0; s < numCurbSegs; s++) {
          const posAlong = (s - numCurbSegs / 2 + 0.5) * segStep;
          let curbX, curbZ;
          if (rot === 0) {
            curbX = x + offsetDist;
            curbZ = z + posAlong;
          } else {
            curbX = x + posAlong;
            curbZ = z + offsetDist;
          }

          // Exact bounding box of candidate curb block
          const halfW = (rot === 0 ? curbWidth : segLength) / 2;
          const halfL = (rot === 0 ? segLength : curbWidth) / 2;
          const minX = curbX - halfW;
          const maxX = curbX + halfW;
          const minZ = curbZ - halfL;
          const maxZ = curbZ + halfL;

          // 1. Skip if entering any intersection zone to keep roadways open
          if (isInsideAnyJunction(minX, maxX, minZ, maxZ)) {
            continue;
          }

          // 2. Corner tangent buffers: do not place straight curbs beyond corner boundaries
          if (x === 72 && maxZ > 88.5) continue; // East Road south end near SE corner
          if (x === 72 && minZ < -78.5) continue; // East Road north end near NE corner
          if (x === -72 && maxZ > 88.5) continue; // West Road south end near SW corner
          if (x === -72 && minZ < -78.5) continue; // West Road north end near NW corner
          if (z === 110 && maxX > 50.5) continue; // North Road east end near SE corner
          if (z === 110 && minX < -50.5) continue; // North Road west end near SW corner
          if (z === -100 && maxX > 50.5) continue; // South Road east end near NE corner
          if (z === -100 && minX < -50.5) continue; // South Road west end near NW corner

          // 3. Skip if overlapping any already placed curb box (prevents ANY z-fighting flashing)
          let overlaps = false;
          for (const p of placedCurbBoxes) {
            const xOver = Math.min(maxX, p.maxX) - Math.max(minX, p.minX);
            const zOver = Math.min(maxZ, p.maxZ) - Math.max(minZ, p.minZ);
            if (xOver > 0.05 && zOver > 0.05) {
              overlaps = true;
              break;
            }
          }
          if (overlaps) continue;

          placedCurbBoxes.push({ minX, maxX, minZ, maxZ });

          const mat = (s % 2 === 0) ? curbWhiteMat : curbTurquoiseMat;
          const curbMesh = new THREE.Mesh(straightCurbGeo, mat);
          curbMesh.rotation.x = -Math.PI / 2;
          if (rot !== 0) curbMesh.rotation.z = rot;
          curbMesh.position.set(curbX, 0.095 / 2, curbZ);
          curbMesh.castShadow = true;
          curbMesh.receiveShadow = true;
          this.scene.add(curbMesh);

          // Register in physical colliders for 4-wheel height sampling & suspension reaction
          this.colliders.push({
            type: 'curb_straight',
            x: curbX,
            z: curbZ,
            width: curbWidth,
            length: segLength,
            rot: rot,
            height: 0.095
          });
        }
      });

      // Crisp White Dashes (Strictly skipped if falling on or entering any ramp footprint)
      const numDashes = Math.floor(length / 7);
      for (let i = 0; i < numDashes; i++) {
        const offset = (i - numDashes / 2 + 0.5) * 7;
        const dashX = (rot === 0) ? x : x + offset;
        const dashZ = (rot === 0) ? z + offset : z;

        // Ensure road lines do NOT go on ramps (with 2.5m buffer covering the dash length)
        if (this.isPointOnOrNearRamp(dashX, dashZ, 2.5)) {
          continue;
        }

        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 3.8), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = rot;
        dash.position.set(dashX, 0.02, dashZ);
        this.scene.add(dash);
      }
    };

    // Creates a smooth curved corner road arc connecting straights into a seamless closed circuit
    const createCurvedRoadCorner = (cx, cz, rIn, rOut, a1, a2, segs = 24) => {
      const pos = [];
      const Rc = (rIn + rOut) * 0.5;

      for (let i = 0; i < segs; i++) {
        const t1 = a1 + (i / segs) * (a2 - a1);
        const t2 = a1 + ((i + 1) / segs) * (a2 - a1);

        const c1 = Math.cos(t1), s1 = Math.sin(t1);
        const c2 = Math.cos(t2), s2 = Math.sin(t2);

        const p1 = [cx + rIn * c1, 0.015, cz + rIn * s1];
        const p2 = [cx + rOut * c1, 0.015, cz + rOut * s1];
        const p3 = [cx + rIn * c2, 0.015, cz + rIn * s2];
        const p4 = [cx + rOut * c2, 0.015, cz + rOut * s2];

        // Normal pointing straight up
        pos.push(...p1, ...p3, ...p2);
        pos.push(...p2, ...p3, ...p4);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, roadMat);
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Elevated 3D Alternating White & Turquoise Racing Rumble Strip Curbs with Rounded Beveled Edges
      const createElevatedCurbArc = (rInner, rOuter, isInsideApex) => {
        const curbSegs = 14;
        const padAngle = 0.035; // ~0.7m buffer from corner entry/exit so curbs never touch straight roads
        const startA = a1 + padAngle;
        const endA = a2 - padAngle;
        const arcSpan = endA - startA;
        const dAngle = arcSpan / curbSegs;
        const gap = dAngle * 0.10; // 10% expansion gap between alternating rumble strips

        for (let i = 0; i < curbSegs; i++) {
          const t1 = startA + i * dAngle + gap / 2;
          const t2 = startA + (i + 1) * dAngle - gap / 2;
          const mat = (i % 2 === 0) ? curbWhiteMat : curbTurquoiseMat;

          const c1 = Math.cos(t1), s1 = Math.sin(t1);
          const c2 = Math.cos(t2), s2 = Math.sin(t2);

          const rRoad = isInsideApex ? rOuter : rInner;
          const rGrass = isInsideApex ? rInner : rOuter;
          const rMid = (rRoad + rGrass) * 0.5;

          // 3D Beveled Ridge Profile with rounded endcaps
          const pRoad1 = [cx + rRoad * c1, 0.018, cz + rRoad * s1];
          const pRoad2 = [cx + rRoad * c2, 0.018, cz + rRoad * s2];
          const pMid1  = [cx + rMid * c1,  0.095, cz + rMid * s1];
          const pMid2  = [cx + rMid * c2,  0.095, cz + rMid * s2];
          const pGrass1= [cx + rGrass * c1, 0.025, cz + rGrass * s1];
          const pGrass2= [cx + rGrass * c2, 0.025, cz + rGrass * s2];

          const verts = new Float32Array([
            // Incline face (from road to ridge crest)
            ...pRoad1, ...pRoad2, ...pMid1,
            ...pRoad2, ...pMid2, ...pMid1,
            // Back bevel face (from ridge crest to grass edge)
            ...pMid1, ...pMid2, ...pGrass1,
            ...pMid2, ...pGrass2, ...pGrass1,
            // Endcap 1 beveled face
            ...pRoad1, ...pMid1, ...pGrass1,
            // Endcap 2 beveled face
            ...pRoad2, ...pGrass2, ...pMid2
          ]);

          const curbBlockGeo = new THREE.BufferGeometry();
          curbBlockGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
          curbBlockGeo.computeVertexNormals();
          const curbBlockMesh = new THREE.Mesh(curbBlockGeo, mat);
          curbBlockMesh.castShadow = true;
          curbBlockMesh.receiveShadow = true;
          this.scene.add(curbBlockMesh);
        }

        // Register in physical colliders for 4-wheel height sampling & suspension reaction
        this.colliders.push({
          type: 'curb_arc',
          cx,
          cz,
          rMin: Math.min(rInner, rOuter),
          rMax: Math.max(rInner, rOuter),
          a1: startA,
          a2: endA,
          height: 0.095
        });
      };

      // Inner apex curb: width 1.2m (from radius 10.8m to 12.0m)
      createElevatedCurbArc(10.8, 12.0, true);
      // Outer exit/entry curb: width 1.2m (from radius 28.0m to 29.2m)
      createElevatedCurbArc(28.0, 29.2, false);

      // Curved lane dashes along centerline radius (exact tangent curve alignment!)
      const numCornerDashes = 7;
      for (let j = 0; j < numCornerDashes; j++) {
        const angle = a1 + ((j + 0.5) / numCornerDashes) * (a2 - a1);
        const dx = cx + Rc * Math.cos(angle);
        const dz = cz + Rc * Math.sin(angle);
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 3.2), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = -angle; // Exactly follows curve tangent with 0 error!
        dash.position.set(dx, 0.02, dz);
        this.scene.add(dash);
      }
    };

    // 1. OUTER CLOSED LOOP CIRCUIT (Width 16m, Corner Center Radius 20m)
    // North Straightaway (z = 110, from x = -52 to 52)
    createStraightRoad(0, 110, 16, 104, Math.PI / 2);

    // South Straightaway (z = -100, from x = -52 to 52)
    createStraightRoad(0, -100, 16, 104, Math.PI / 2);

    // East Straightaway (x = 72, from z = -80 to 90)
    createStraightRoad(72, 5, 16, 170, 0);

    // West Straightaway (x = -72, from z = -80 to 90)
    createStraightRoad(-72, 5, 16, 170, 0);

    // 4 Smooth Curved Corners connecting the loop
    // South-East Corner
    createCurvedRoadCorner(52, 90, 12, 28, 0, Math.PI / 2);
    // South-West Corner
    createCurvedRoadCorner(-52, 90, 12, 28, Math.PI / 2, Math.PI);
    // North-West Corner
    createCurvedRoadCorner(-52, -80, 12, 28, Math.PI, Math.PI * 1.5);
    // North-East Corner
    createCurvedRoadCorner(52, -80, 12, 28, Math.PI * 1.5, Math.PI * 2);

    // 2. INTERIOR JUMP LINES & BOULEVARDS
    // Center Spine Boulevard (x = 0, connecting South to North through Ramp 1 at z = -10 and Ramp 4 at z = 80)
    createStraightRoad(0, 5, 18, 210, 0);

    // North Cross Boulevard (z = 50, connecting West to East through Ramp 2 at x = 45)
    createStraightRoad(0, 50, 16, 144, Math.PI / 2);

    // South Cross Boulevard (z = -65, connecting West to East through Ramp 3 at x = -45)
    createStraightRoad(0, -65, 16, 144, Math.PI / 2);
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

  buildElevatedSkywayBridge() {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'ElevatedSkywayBridgeSection';

    // Materials: AAA Greybox Architecture with zero z-fighting
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x3a444e, // Slate-grey asphalt
      roughness: 0.72,
      metalness: 0.05
    });

    const structureMat = new THREE.MeshStandardMaterial({
      color: 0xd8e0e8, // Concrete pier columns
      roughness: 0.85,
      metalness: 0.04
    });

    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4, // Vibrant turquoise safety crash barriers
      roughness: 0.35,
      metalness: 0.15,
      emissive: 0x0369a1,
      emissiveIntensity: 0.35
    });

    const jumpRampMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Dark contrast deck for stunt jump
      roughness: 0.65,
      metalness: 0.10
    });

    const chevronMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15, // Bright energetic yellow jump chevrons
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });

    const cyanNeonMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff
    });

    const bx = -22.0;
    const bridgeW = 10.8; // Super wide 10.8m roadway
    const hw = bridgeW / 2;
    const hBridge = 3.6; // Uniform bridge deck height

    // 1. Helper: Flat Bridge Deck Segment (Airtight geometry, zero overlap)
    const createDeckSegment = (zCenter, length, height) => {
      const seg = new THREE.Group();

      // Top road deck (Box: height 0.30m, top flush with 'height')
      const roadGeo = new THREE.BoxGeometry(bridgeW, 0.30, length);
      const roadMesh = new THREE.Mesh(roadGeo, deckMat);
      roadMesh.position.set(0, height - 0.15, 0);
      roadMesh.receiveShadow = true;
      roadMesh.castShadow = true;
      seg.add(roadMesh);

      // Underside structural concrete support girder
      const girderGeo = new THREE.BoxGeometry(bridgeW - 0.8, 0.50, length);
      const girderMesh = new THREE.Mesh(girderGeo, structureMat);
      girderMesh.position.set(0, height - 0.55, 0);
      girderMesh.receiveShadow = true;
      girderMesh.castShadow = true;
      seg.add(girderMesh);

      // Left & Right turquoise safety crash barriers with glowing neon tops
      [-hw + 0.22, hw - 0.22].forEach((barrierX) => {
        const barGeo = new THREE.BoxGeometry(0.35, 0.95, length);
        const barMesh = new THREE.Mesh(barGeo, barrierMat);
        barMesh.position.set(barrierX, height + 0.475, 0);
        barMesh.castShadow = true;
        barMesh.receiveShadow = true;
        seg.add(barMesh);

        // Glowing neon rail on top of barrier
        const railGeo = new THREE.BoxGeometry(0.12, 0.08, length);
        const railMesh = new THREE.Mesh(railGeo, cyanNeonMat);
        railMesh.position.set(barrierX, height + 0.97, 0);
        seg.add(railMesh);
      });

      seg.position.set(bx, 0, zCenter);
      bridgeGroup.add(seg);
    };

    // 2. Helper: Inclined Roadway Ramp Segment
    const createRampSegment = (zCenter, length, hStart, hEnd, isStuntRamp = false) => {
      const seg = new THREE.Group();
      const hl = length / 2;

      // Solid wedge geometry for ramp surface
      const positions = new Float32Array([
        // Top driving surface
        -hw, hStart, -hl,   hw, hEnd, hl,    hw, hStart, -hl,
        -hw, hStart, -hl,  -hw, hEnd, hl,    hw, hEnd, hl,
        // Bottom base
        -hw, 0, -hl,       -hw, 0, hl,       hw, 0, hl,
        -hw, 0, -hl,        hw, 0, hl,       hw, 0, -hl,
        // Left flank
        -hw, 0, -hl,       -hw, 0, hl,      -hw, hEnd, hl,
        -hw, 0, -hl,       -hw, hEnd, hl,   -hw, hStart, -hl,
        // Right flank
        hw, 0, -hl,        hw, hEnd, hl,     hw, 0, hl,
        hw, 0, -hl,        hw, hStart, -hl,  hw, hEnd, hl
      ]);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.computeVertexNormals();

      const rampMesh = new THREE.Mesh(geo, isStuntRamp ? jumpRampMat : deckMat);
      rampMesh.receiveShadow = true;
      rampMesh.castShadow = true;
      seg.add(rampMesh);

      // Angled safety barriers along sides
      const slopeAngle = Math.atan2(hEnd - hStart, length);
      const barrierLen = Math.hypot(length, hEnd - hStart);

      [-hw + 0.22, hw - 0.22].forEach((barrierX) => {
        const barGeo = new THREE.BoxGeometry(0.35, 0.95, barrierLen);
        const barMesh = new THREE.Mesh(barGeo, barrierMat);
        barMesh.position.set(barrierX, (hStart + hEnd) / 2 + 0.475, 0);
        barMesh.rotation.x = slopeAngle;
        barMesh.castShadow = true;
        barMesh.receiveShadow = true;
        seg.add(barMesh);

        // Glowing neon rail on ramp barrier
        const railGeo = new THREE.BoxGeometry(0.12, 0.08, barrierLen);
        const railMesh = new THREE.Mesh(railGeo, cyanNeonMat);
        railMesh.position.set(barrierX, (hStart + hEnd) / 2 + 0.97, 0);
        railMesh.rotation.x = slopeAngle;
        seg.add(railMesh);
      });

      // Stunt jump chevron markings on the ramp surface
      if (isStuntRamp) {
        const numChevrons = 3;
        for (let c = 0; c < numChevrons; c++) {
          const t = 0.25 + c * 0.28;
          const cz = -hl + t * length;
          const cy = THREE.MathUtils.lerp(hStart, hEnd, t) + 0.025;

          const chevGeo = new THREE.PlaneGeometry(3.6, 1.2);
          const chevMesh = new THREE.Mesh(chevGeo, chevronMat);
          chevMesh.rotation.x = -Math.PI / 2 + slopeAngle;
          chevMesh.position.set(0, cy, cz);
          seg.add(chevMesh);
        }
      }

      seg.position.set(bx, 0, zCenter);
      bridgeGroup.add(seg);
    };

    // 3. Helper: Structural Concrete Bridge Piers
    const addBridgePier = (zPos, h) => {
      [-hw + 1.2, hw - 1.2].forEach((px) => {
        const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.78, h - 0.2, 16), structureMat);
        pier.position.set(bx + px, (h - 0.2) / 2, zPos);
        pier.castShadow = true;
        pier.receiveShadow = true;
        bridgeGroup.add(pier);
      });
    };

    // ----------------------------------------------------
    // BRIDGE STUNT SEQUENCE (Non-overlapping, Wide, Triple-AAA)
    // ----------------------------------------------------

    // A. Approach Ramp 1 (Slopes up smoothly from Ground to Bridge 1)
    // z = -54 (y = 0m) to z = -32 (y = 3.6m), length = 22m
    createRampSegment(-43, 22, 0, hBridge, false);
    this.colliders.push({
      type: 'elevated_ramp',
      x: bx,
      z: -43,
      width: bridgeW,
      length: 22,
      hStart: 0,
      hEnd: hBridge
    });

    // B. Bridge 1 Deck (Run-up span at y = 3.6m)
    // z = -32 to z = -14, length = 18m
    createDeckSegment(-23, 18, hBridge);
    this.colliders.push({
      type: 'bridge',
      x: bx,
      z: -23,
      width: bridgeW,
      length: 18,
      height: hBridge
    });
    addBridgePier(-30, hBridge);
    addBridgePier(-16, hBridge);

    // C. Bridge Stunt Jump Ramp (Mounted on Bridge 1, launches over the chasm!)
    // Starts at z = -14 (y = 3.6m) and slopes up to z = -2 (y = 5.2m), length = 12m
    createRampSegment(-8, 12, hBridge, 5.2, true);
    this.colliders.push({
      type: 'elevated_ramp',
      x: bx,
      z: -8,
      width: bridgeW,
      length: 12,
      hStart: hBridge,
      hEnd: 5.2,
      isJumpRamp: true
    });
    addBridgePier(-2.8, 5.0);

    // D. The Stunt Gap (Chasm)
    // From z = -2 to z = +7 (9.0-meter open jump gap over the air!)

    // E. Bridge 2 Deck (Landing span at y = 3.6m)
    // Starts at z = +7, extends to z = +28, length = 21m
    createDeckSegment(17.5, 21, hBridge);
    this.colliders.push({
      type: 'bridge',
      x: bx,
      z: 17.5,
      width: bridgeW,
      length: 21,
      height: hBridge
    });
    addBridgePier(8.0, hBridge);
    addBridgePier(20.0, hBridge);

    // F. Descent Ramp 2 (Slopes down smoothly from Bridge 2 to Ground)
    // z = +28 (y = 3.6m) to z = +50 (y = 0m), length = 22m
    createRampSegment(39, 22, hBridge, 0, false);
    this.colliders.push({
      type: 'elevated_ramp',
      x: bx,
      z: 39,
      width: bridgeW,
      length: 22,
      hStart: hBridge,
      hEnd: 0
    });

    // G. Side Guardrail Colliders (Keep the van contained on elevated spans)
    // Uses minY: 2.5 so cars driving on the ground beneath NEVER hit these barriers!
    this.colliders.push(
      // Bridge 1 side barriers
      { type: 'box', x: bx - hw - 0.25, z: -23, width: 0.5, depth: 36, minY: 2.2, maxY: 7.5 },
      { type: 'box', x: bx + hw + 0.25, z: -23, width: 0.5, depth: 36, minY: 2.2, maxY: 7.5 },
      // Bridge 2 side barriers
      { type: 'box', x: bx - hw - 0.25, z: 17.5, width: 0.5, depth: 21, minY: 2.2, maxY: 7.5 },
      { type: 'box', x: bx + hw + 0.25, z: 17.5, width: 0.5, depth: 21, minY: 2.2, maxY: 7.5 }
    );

    // H. VIP Skyway Stunt Bridge Delivery Dropoff Spot on Bridge 2
    this.deliverySpots.push({
      id: 'bridge_skyway',
      name: 'Skyway Stunt Bridge',
      position: new THREE.Vector3(bx, hBridge + 0.35, 17.5)
    });

    this.scene.add(bridgeGroup);
  }

  buildSlalomArea() {
    // Factory for Modern Rounded Traffic Cones
    const createModernRoundedConeMesh = () => {
      const root = new THREE.Group();
      const model = new THREE.Group();
      root.add(model);
      root.model = model;

      const coneMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4, // Vibrant modern turquoise
        roughness: 0.35,
        metalness: 0.08
      });
      const stripeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff, // Pure crisp reflective white collar & accents
        roughness: 0.20,
        metalness: 0.05
      });
      const baseRimMat = new THREE.MeshStandardMaterial({
        color: 0x0891b2, // Deep rich architectural turquoise base
        roughness: 0.50,
        metalness: 0.05
      });

      // Shift all geometries so the physical Center of Mass (y = 0.28m) sits at (0, 0, 0)
      // 1. Modern rounded cylindrical base plate
      const baseGeo = new THREE.CylinderGeometry(0.50, 0.54, 0.08, 24);
      const baseMesh = new THREE.Mesh(baseGeo, baseRimMat);
      baseMesh.position.y = 0.04 - 0.28; // -0.24m
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      model.add(baseMesh);

      // 2. Soft rounded toroidal edge rim around base plate (crisp white accent)
      const torusGeo = new THREE.TorusGeometry(0.50, 0.035, 8, 24);
      const torusMesh = new THREE.Mesh(torusGeo, stripeMat);
      torusMesh.rotation.x = Math.PI / 2;
      torusMesh.position.y = 0.05 - 0.28; // -0.23m
      model.add(torusMesh);

      // 3. Smooth tapered conical body
      const bodyGeo = new THREE.CylinderGeometry(0.12, 0.35, 0.72, 24);
      const bodyMesh = new THREE.Mesh(bodyGeo, coneMat);
      bodyMesh.position.y = 0.42 - 0.28; // +0.14m
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      model.add(bodyMesh);

      // 4. Crown Dome (rounded spherical tip instead of sharp cone point)
      const domeGeo = new THREE.SphereGeometry(0.12, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const domeMesh = new THREE.Mesh(domeGeo, coneMat);
      domeMesh.position.y = 0.78 - 0.28; // +0.50m
      domeMesh.castShadow = true;
      model.add(domeMesh);

      // 5. Rounded reflective middle stripe band
      const stripeGeo = new THREE.CylinderGeometry(0.19, 0.24, 0.16, 24);
      const stripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
      stripeMesh.position.y = 0.42 - 0.28; // +0.14m
      model.add(stripeMesh);

      return root;
    };

    // Pre-calculate 29 convex support points in local Center-of-Mass coordinates
    this.coneSupportPoints = [];
    const baseRadius = 0.52;
    const baseTopRadius = 0.50;
    const midRadius = 0.31;
    const topRadius = 0.12;
    const baseBottomY = -0.28;
    const baseTopY = -0.20;
    const midY = 0.14;
    const topCollarY = 0.50;
    const apexY = 0.62;

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      this.coneSupportPoints.push(new THREE.Vector3(cosA * baseRadius, baseBottomY, sinA * baseRadius));
      this.coneSupportPoints.push(new THREE.Vector3(cosA * baseTopRadius, baseTopY, sinA * baseTopRadius));
      this.coneSupportPoints.push(new THREE.Vector3(cosA * midRadius, midY, sinA * midRadius));
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      this.coneSupportPoints.push(new THREE.Vector3(Math.cos(a) * topRadius, topCollarY, Math.sin(a) * topRadius));
    }
    this.coneSupportPoints.push(new THREE.Vector3(0, apexY, 0));

    // Strategic interactive cone placements (slaloms & racing corner apexes)
    const conePositions = [
      // Center Drag Slalom
      { x: 0, z: 15 },
      { x: 0, z: 28 },
      { x: 0, z: 41 },
      // South Straight Slalom
      { x: -20, z: -100 },
      { x: 0, z: -100 },
      { x: 20, z: -100 },
      // East Straight Slalom
      { x: 72, z: -20 },
      { x: 72, z: 0 },
      { x: 72, z: 20 },
      // West Straight Slalom
      { x: -72, z: -20 },
      { x: -72, z: 0 },
      { x: -72, z: 20 },
      // 4 Racing Corner Apex Markers
      { x: 54, z: 92 },
      { x: -54, z: 92 },
      { x: -54, z: -82 },
      { x: 54, z: -82 }
    ];

    this.cones = [];

    for (const pos of conePositions) {
      const coneMesh = createModernRoundedConeMesh();
      // Mesh pivot is at CoM (y = 0.28), placing the base plate bottom flush on ground at y = 0.00
      coneMesh.position.set(pos.x, 0.28, pos.z);
      this.scene.add(coneMesh);

      this.cones.push({
        mesh: coneMesh,
        model: coneMesh.model,
        homePos: new THREE.Vector3(pos.x, 0.28, pos.z),
        pos: new THREE.Vector3(pos.x, 0.28, pos.z),
        vel: new THREE.Vector3(0, 0, 0),
        rot: new THREE.Euler(0, 0, 0),
        angVel: new THREE.Vector3(0, 0, 0),
        radius: 0.52,
        height: 0.90,
        isSleeping: true,
        hitCooldown: 0
      });
    }
  }

  buildBuildings() {
    const buildingConfigs = [
      { id: '1', name: 'Palm Villa', x: -36, z: 20, w: 16, d: 14, h: 8.5, col: 0xf8fafc },
      { id: '2', name: 'Hillside Modern', x: -42, z: -32, w: 18, d: 14, h: 9.5, col: 0xe2e8f0 },
      { id: '3', name: 'Sunny Crest Residence', x: 42, z: 75, w: 16, d: 16, h: 8.5, col: 0xcbd5e1 },
      { id: '4', name: 'Orchid Court Complex', x: -38, z: 85, w: 20, d: 16, h: 14.0, col: 0xf1f5f9 },
      { id: '5', name: 'Checkers Mega Hub', x: 40, z: -15, w: 28, d: 24, h: 10.5, col: 0x94a3b8 }
    ];

    const createRoundedBuilding = (b) => {
      const group = new THREE.Group();
      group.position.set(b.x, 0, b.z);

      const r = Math.min(2.4, b.w * 0.18, b.d * 0.18);
      const hw = b.w / 2;
      const hd = b.d / 2;

      // 1. Smooth 2D Rounded Rectangle Floorplan
      const shape = new THREE.Shape();
      shape.moveTo(-hw + r, -hd);
      shape.lineTo(hw - r, -hd);
      shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
      shape.lineTo(hw, hd - r);
      shape.quadraticCurveTo(hw, hd, hw - r, hd);
      shape.lineTo(-hw + r, hd);
      shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
      shape.lineTo(-hw, -hd + r);
      shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

      // Main Modernist Pavilion Body with Smooth Beveled Edges
      const extrudeSettings = {
        depth: b.h,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 0.35,
        bevelThickness: 0.35
      };
      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geo.center();
      geo.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({
        color: b.col,
        roughness: 0.85,
        metalness: 0.04,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = (b.h + 0.7) / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // 2. Modernist Upper Terrace Tier (Apple Park style secondary rounded penthouse tier)
      const tierH = b.h * 0.35;
      const tierW = b.w * 0.65;
      const tierD = b.d * 0.65;
      const tierR = Math.min(1.8, tierW * 0.18);
      const thw = tierW / 2;
      const thd = tierD / 2;

      const tierShape = new THREE.Shape();
      tierShape.moveTo(-thw + tierR, -thd);
      tierShape.lineTo(thw - tierR, -thd);
      tierShape.quadraticCurveTo(thw, -thd, thw, -thd + tierR);
      tierShape.lineTo(thw, thd - tierR);
      tierShape.quadraticCurveTo(thw, thd, thw - tierR, thd);
      tierShape.lineTo(-thw + tierR, thd);
      tierShape.quadraticCurveTo(-thw, thd, -thw, thd - tierR);
      tierShape.lineTo(-thw, -thd + tierR);
      tierShape.quadraticCurveTo(-thw, -thd, -thw + tierR, -thd);

      const tierGeo = new THREE.ExtrudeGeometry(tierShape, {
        depth: tierH,
        bevelEnabled: true,
        bevelSegments: 3,
        bevelSize: 0.25,
        bevelThickness: 0.25
      });
      tierGeo.center();
      tierGeo.computeVertexNormals();

      const tierMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.8,
        metalness: 0.04,
        side: THREE.DoubleSide
      });
      const tierMesh = new THREE.Mesh(tierGeo, tierMat);
      tierMesh.rotation.x = -Math.PI / 2;
      tierMesh.position.y = b.h + 0.35 + (tierH + 0.5) / 2;
      tierMesh.castShadow = true;
      tierMesh.receiveShadow = true;
      group.add(tierMesh);

      // 3. Sleek Architectural Dark Slate Trim along Rooftop Perimeter
      const trimGeo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.35,
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: 0.15,
        bevelThickness: 0.15
      });
      trimGeo.center();
      const trimMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.5,
        metalness: 0.05,
        side: THREE.DoubleSide
      });
      const trimMesh = new THREE.Mesh(trimGeo, trimMat);
      trimMesh.rotation.x = -Math.PI / 2;
      trimMesh.position.y = b.h + 0.55;
      trimMesh.castShadow = true;
      group.add(trimMesh);

      this.scene.add(group);

      // Tight physical obstacle collision boundaries
      this.colliders.push({
        type: 'box',
        x: b.x,
        z: b.z,
        width: b.w + 0.6,
        depth: b.d + 0.6,
        height: b.h + tierH + 1.2
      });

      // Delivery Destination Zone
      this.deliverySpots.push({
        id: b.id,
        name: b.name,
        position: new THREE.Vector3(b.x, 0.2, b.z + b.d / 2 + 5.5)
      });
    };

    for (const b of buildingConfigs) {
      createRoundedBuilding(b);
    }
  }

  // Samples exact double-sided ramp surface height and local coordinate bounds
  sampleRampAt(x, z) {
    for (const c of this.colliders) {
      if (c.type === 'ramp') {
        const dx = x - c.x;
        const dz = z - c.z;
        const cosA = Math.cos(c.angleY);
        const sinA = Math.sin(c.angleY);
        const localX = dx * cosA - dz * sinA;
        const localZ = dx * sinA + dz * cosA;

        const hw = c.width / 2;
        const hd = c.depth / 2;

        if (Math.abs(localX) <= hw && Math.abs(localZ) <= hd) {
          const distFromPeak = Math.abs(localZ);
          const progress = Math.max(0, 1.0 - (distFromPeak / hd));
          const surfaceH = progress * c.height;
          return {
            isOnRamp: true,
            height: surfaceH,
            ramp: c,
            localX,
            localZ,
            hw,
            hd,
            cosA,
            sinA
          };
        }
      }
    }
    return { isOnRamp: false, height: 0 };
  }

  // Exact Convex Hull Support Evaluation for Traffic Cone (Zero Object Allocation)
  getConeLowestContact(rot) {
    let minY = Infinity;
    let contactLocalX = 0;
    let contactLocalZ = 0;

    const cx = Math.cos(rot.x), sx = Math.sin(rot.x);
    const cy = Math.cos(rot.y), sy = Math.sin(rot.y);
    const cz = Math.cos(rot.z), sz = Math.sin(rot.z);

    // Three.js Euler XYZ rotation matrix entries:
    const m00 = cy * cz;
    const m01 = -cy * sz;
    const m02 = sy;

    const m10 = sx * sy * cz + cx * sz;
    const m11 = -sx * sy * sz + cx * cz;
    const m12 = -sx * cy;

    const m20 = -cx * sy * cz + sx * sz;
    const m21 = cx * sy * sz + sx * cz;
    const m22 = cx * cy;

    for (let i = 0; i < this.coneSupportPoints.length; i++) {
      const p = this.coneSupportPoints[i];
      const vy = m10 * p.x + m11 * p.y + m12 * p.z;
      if (vy < minY) {
        minY = vy;
        contactLocalX = m00 * p.x + m01 * p.y + m02 * p.z;
        contactLocalZ = m20 * p.x + m21 * p.y + m22 * p.z;
      }
    }
    return { minY, contactLocalX, contactLocalZ, m01, m11, m21 };
  }

  // Super Accurate Physics & Van-Cone Collision Response System
  update(dt, vehicle, audio) {
    if (!vehicle || !this.cones || this.cones.length === 0) return;

    const vanPos = vehicle.position;
    const vanVel = vehicle.velocity;
    const heading = vehicle.heading;
    const absSpeed = Math.abs(vehicle.speed);

    const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const right = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));

    const hl = 1.95; // Half-length of van chassis with bumper
    const hw = 1.10; // Half-width of van chassis with fenders

    // 1. VAN-TO-CONE IMPACT DETECTION
    for (const cone of this.cones) {
      if (cone.hitCooldown > 0) {
        cone.hitCooldown -= dt;
      }

      const dx = cone.pos.x - vanPos.x;
      const dz = cone.pos.z - vanPos.z;
      const dy = cone.pos.y - vanPos.y;

      // Only check van collision if cone is within proximity
      if (dx * dx + dz * dz <= 24.0) {
        const df = dx * forward.x + dz * forward.z; // Along van forward axis
        const dr = dx * right.x + dz * right.z;     // Along van right axis

        const overlapF = (hl + cone.radius) - Math.abs(df);
        const overlapR = (hw + cone.radius) - Math.abs(dr);

        if (overlapF > 0 && overlapR > 0 && dy > -0.8 && dy < 2.2) {
          if (cone.hitCooldown <= 0) {
            cone.hitCooldown = 0.15;

            // Repulsion direction away from vehicle center
            let pushDir = new THREE.Vector3(dx, 0, dz);
            if (pushDir.lengthSq() < 0.01) {
              pushDir.copy(forward);
            } else {
              pushDir.normalize();
            }

            // Push cone cleanly outside van boundary
            const pushDist = overlapR > overlapF ? overlapF : overlapR;
            cone.pos.x += pushDir.x * pushDist;
            cone.pos.z += pushDir.z * pushDist;

            const impactSpeed = Math.max(3.5, absSpeed);

            // Forward & radial momentum transfer
            cone.vel.x = vanVel.x * 1.25 + pushDir.x * (impactSpeed * 0.55 + 2.5) + (Math.random() - 0.5) * 1.5;
            cone.vel.z = vanVel.z * 1.25 + pushDir.z * (impactSpeed * 0.55 + 2.5) + (Math.random() - 0.5) * 1.5;
            // Pop into air
            cone.vel.y = Math.min(6.5, impactSpeed * 0.38 + 2.2);

            // 3D tumble angular spin
            cone.angVel.x = (Math.random() - 0.5) * impactSpeed * 2.5 + pushDir.z * impactSpeed * 1.5;
            cone.angVel.y = (Math.random() - 0.5) * impactSpeed * 3.5;
            cone.angVel.z = (Math.random() - 0.5) * impactSpeed * 2.5 - pushDir.x * impactSpeed * 1.5;

            cone.isSleeping = false;

            if (audio && audio.playConeHit) {
              audio.playConeHit(impactSpeed);
            }
          }
        }
      }
    }

    // 2. AAA CONTINUOUS RIGID-BODY SIMULATION FOR ACTIVE CONES
    // Sub-stepping (2 steps per frame) for rock-solid stability and zero tunneling
    const subSteps = 2;
    const subDt = dt / subSteps;

    for (const cone of this.cones) {
      if (cone.isSleeping) continue;

      for (let s = 0; s < subSteps; s++) {
        // Gravity
        cone.vel.y -= 19.6 * subDt;

        // Position integration
        cone.pos.x += cone.vel.x * subDt;
        cone.pos.y += cone.vel.y * subDt;
        cone.pos.z += cone.vel.z * subDt;

        // Angular integration
        cone.rot.x += cone.angVel.x * subDt;
        cone.rot.y += cone.angVel.y * subDt;
        cone.rot.z += cone.angVel.z * subDt;

        // 2A. BUILDING OBSTACLES COLLISION
        for (const col of this.colliders) {
          if (col.type === 'box') {
            const chw = col.width / 2 + cone.radius;
            const chd = col.depth / 2 + cone.radius;
            const cdx = cone.pos.x - col.x;
            const cdz = cone.pos.z - col.z;
            if (Math.abs(cdx) < chw && Math.abs(cdz) < chd) {
              const penX = chw - Math.abs(cdx);
              const penZ = chd - Math.abs(cdz);
              if (penX < penZ) {
                cone.pos.x = col.x + chw * Math.sign(cdx);
                cone.vel.x = -cone.vel.x * 0.45;
              } else {
                cone.pos.z = col.z + chd * Math.sign(cdz);
                cone.vel.z = -cone.vel.z * 0.45;
              }
            }
          } else if (col.type === 'ramp') {
            // RAMP SOLID SIDE WALLS COLLISION
            const rdx = cone.pos.x - col.x;
            const rdz = cone.pos.z - col.z;
            const cosA = Math.cos(col.angleY);
            const sinA = Math.sin(col.angleY);
            const localX = rdx * cosA - rdz * sinA;
            const localZ = rdx * sinA + rdz * cosA;

            const rhw = col.width / 2;
            const rhd = col.depth / 2;

            // If within ramp length
            if (Math.abs(localZ) <= rhd) {
              const slopeH = Math.max(0, 1.0 - Math.abs(localZ) / rhd) * col.height;
              // If cone center of mass is below slope height and touching side wall from outside
              if (Math.abs(localX) < rhw + cone.radius && cone.pos.y < slopeH) {
                const signX = Math.sign(localX) || 1;
                const targetLocalX = (rhw + cone.radius) * signX;
                // Reconstruct world position pushed out from ramp wall
                cone.pos.x = col.x + targetLocalX * cosA + localZ * sinA;
                cone.pos.z = col.z - targetLocalX * sinA + localZ * cosA;

                // Reflect local X velocity off solid concrete side wall
                const lvx = cone.vel.x * cosA - cone.vel.z * sinA;
                const lvz = cone.vel.x * sinA + cone.vel.z * cosA;
                const newLvx = -lvx * 0.45;
                cone.vel.x = newLvx * cosA + lvz * sinA;
                cone.vel.z = -newLvx * sinA + lvz * cosA;
              }
            }
          }
        }

        // 2B. GROUND & RAMP TOP SURFACE COLLISION WITH CONVEX HULL CONTACT
        const contact = this.getConeLowestContact(cone.rot);
        const contactWorldX = cone.pos.x + contact.contactLocalX;
        const contactWorldZ = cone.pos.z + contact.contactLocalZ;
        const contactWorldY = cone.pos.y + contact.minY;

        // Sample surface height at exact lowest point (handles road or ramp slope)
        const rampSample = this.sampleRampAt(contactWorldX, contactWorldZ);
        const groundY = rampSample.isOnRamp ? rampSample.height : 0.015;

        // Immediate penetration resolution: ensure lowest point is never below surface
        const pen = groundY - contactWorldY;
        if (pen > 0) {
          cone.pos.y += pen;
        }

        // Physical ground contact dynamics
        if (contactWorldY <= groundY + 0.015) {
          if (cone.vel.y < -0.8) {
            cone.vel.y = -cone.vel.y * 0.35; // Physical restitution bounce
            cone.angVel.x += (Math.random() - 0.5) * 1.5;
            cone.angVel.z += (Math.random() - 0.5) * 1.5;
          } else {
            cone.vel.y = Math.max(0, cone.vel.y);
          }

          // Contact normal torque around Center of Mass: tau = r_contact x (0, N, 0)
          const normalForce = Math.max(22.0, -cone.vel.y * 12.0 + 26.0);
          let torqueX = -contact.contactLocalZ * normalForce;
          let torqueZ = contact.contactLocalX * normalForce;

          // Real-World Physical Stability Dynamics:
          // A real cone can ONLY rest in two stable equilibria:
          // 1. UPRIGHT (uy >= 0.85): Base is flat on ground, gravity pulls it upright.
          // 2. FLAT ON SIDE (|uy| <= 0.55): Conical body is resting along its taper.
          // Inverted on tip (uy < -0.65) or balancing on rim edge (0.55 <= uy < 0.85) are strictly unstable!
          const ux = contact.m01;
          const uy = contact.m11; // Up vector vertical component in world space
          const uz = contact.m21;

          if (uy >= 0.85) {
            // Zone 1: Restoring upright torque towards vertical
            torqueX -= uz * 38.0;
            torqueZ += ux * 38.0;
          } else if (uy < -0.65) {
            // Zone 3: Inverted / on tip: powerful overturning kick to fall flat on side
            const dirX = Math.sign(ux) || 1;
            const dirZ = Math.sign(uz) || 1;
            torqueX -= dirZ * 48.0;
            torqueZ += dirX * 48.0;
          } else if (uy >= 0.55 && uy < 0.85) {
            // Zone 4: Balancing on rim edge: gravity topples cone onto its side
            const dirX = Math.sign(ux) || 1;
            const dirZ = Math.sign(uz) || 1;
            torqueX += dirZ * 38.0;
            torqueZ -= dirX * 38.0;
          }
          // Zone 2: |uy| <= 0.55 (flat on side): naturally stable equilibrium

          cone.angVel.x += torqueX * subDt;
          cone.angVel.z += torqueZ * subDt;

          // Ground sliding friction
          cone.vel.x *= Math.pow(0.04, subDt);
          cone.vel.z *= Math.pow(0.04, subDt);

          // Ground rotational damping
          cone.angVel.x *= Math.pow(0.015, subDt);
          cone.angVel.y *= Math.pow(0.015, subDt);
          cone.angVel.z *= Math.pow(0.015, subDt);
        } else {
          // Air drag
          cone.vel.x *= Math.pow(0.92, subDt);
          cone.vel.z *= Math.pow(0.92, subDt);
          cone.angVel.multiplyScalar(Math.pow(0.90, subDt));
        }
      }

      // 2C. SLEEP CHECK & DIRECT MESH SYNCHRONIZATION
      const contactAfter = this.getConeLowestContact(cone.rot);
      const lowestWorldY = cone.pos.y + contactAfter.minY;
      const rampSampleAfter = this.sampleRampAt(cone.pos.x + contactAfter.contactLocalX, cone.pos.z + contactAfter.contactLocalZ);
      const groundYAfter = rampSampleAfter.isOnRamp ? rampSampleAfter.height : 0.015;

      const horizSpeed = Math.hypot(cone.vel.x, cone.vel.z);
      const angSpeed = cone.angVel.length();

      // STRICT EQUILIBRIUM GATE: A cone can NEVER sleep on its tip or balancing on rim edge!
      const m11 = contactAfter.m11;
      const isStableUpright = m11 >= 0.85;
      const isStableOnSide = Math.abs(m11) <= 0.55;

      if ((isStableUpright || isStableOnSide) && lowestWorldY <= groundYAfter + 0.015 && horizSpeed < 0.12 && angSpeed < 0.16) {
        cone.vel.set(0, 0, 0);
        cone.angVel.set(0, 0, 0);
        cone.isSleeping = true;

        if (isStableUpright) {
          // Settled upright: stand square and true on base plate
          cone.rot.x = 0;
          cone.rot.z = 0;
          cone.pos.y = groundYAfter + 0.28;
        } else {
          // Settled flat on side: ensure side taper rests flush against surface
          cone.pos.y = groundYAfter - contactAfter.minY;
        }
      }

      // Synchronize Three.js mesh directly to physical position and orientation
      cone.mesh.position.set(cone.pos.x, cone.pos.y, cone.pos.z);
      cone.mesh.rotation.copy(cone.rot);
    }
  }

  resetCones() {
    if (!this.cones) return;
    for (const cone of this.cones) {
      cone.pos.copy(cone.homePos);
      cone.vel.set(0, 0, 0);
      cone.rot.set(0, 0, 0);
      cone.angVel.set(0, 0, 0);
      cone.isSleeping = true;
      cone.hitCooldown = 0;
      cone.mesh.position.copy(cone.homePos);
      cone.mesh.rotation.set(0, 0, 0);
      if (cone.model) {
        cone.model.position.set(0, 0, 0);
        cone.model.rotation.set(0, 0, 0);
      }
    }
  }
}
