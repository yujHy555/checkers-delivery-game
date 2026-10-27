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

    // 2. Continuous Closed Loop Racetrack Circuit with Modern Rounded Corners & Edges
    this.buildRoads();

    // 3. SOLID DOUBLE-SIDED 3D JUMP RAMPS (NO RAILINGS, architectural off-white matte geometry - UNCHANGED)
    this.buildDoubleSidedRamps();

    // 4. Interactive Traffic Cones with Modern Rounded Edges & Accurate Physics
    this.buildSlalomArea();

    // 5. Buildings with Modern Rounded Edges & Architectural GI Aesthetics
    this.buildBuildings();
  }

  buildRoads() {
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x485460, // Modern slate-grey racetrack asphalt
      roughness: 0.72,
      metalness: 0.05
    });

    const curbMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1, // Modern rounded edge border curb
      roughness: 0.8
    });

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

    // Creates a straight road segment with modern rounded edge borders and crisp dashed lines
    const createStraightRoad = (x, z, width, length, rot = 0) => {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(width, length), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = rot;
      road.position.set(x, 0.015, z);
      road.receiveShadow = true;
      this.scene.add(road);

      // Rounded edge borders
      const curbWidth = 0.45;
      const hw = width / 2;
      [-hw, hw].forEach((offset) => {
        const curb = new THREE.Mesh(new THREE.PlaneGeometry(curbWidth, length), curbMat);
        curb.rotation.x = -Math.PI / 2;
        curb.rotation.z = rot;
        if (rot === 0) {
          curb.position.set(x + offset, 0.018, z);
        } else {
          curb.position.set(x, 0.018, z + offset);
        }
        curb.receiveShadow = true;
        this.scene.add(curb);
      });

      // Crisp White Dashes
      const numDashes = Math.floor(length / 7);
      for (let i = 0; i < numDashes; i++) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 3.8), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = rot;
        const offset = (i - numDashes / 2 + 0.5) * 7;
        if (rot === 0) {
          dash.position.set(x, 0.02, z + offset);
        } else {
          dash.position.set(x + offset, 0.02, z);
        }
        this.scene.add(dash);
      }
    };

    // Creates a smooth curved corner road arc connecting straights into a seamless closed circuit
    const createCurvedRoadCorner = (cx, cz, rIn, rOut, a1, a2, segs = 20) => {
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

      // Curved outer and inner curbs
      const createCurbArc = (radius, width) => {
        const curbPos = [];
        const r1 = radius - width / 2;
        const r2 = radius + width / 2;
        for (let i = 0; i < segs; i++) {
          const t1 = a1 + (i / segs) * (a2 - a1);
          const t2 = a1 + ((i + 1) / segs) * (a2 - a1);
          const c1 = Math.cos(t1), s1 = Math.sin(t1);
          const c2 = Math.cos(t2), s2 = Math.sin(t2);
          const cp1 = [cx + r1 * c1, 0.018, cz + r1 * s1];
          const cp2 = [cx + r2 * c1, 0.018, cz + r2 * s1];
          const cp3 = [cx + r1 * c2, 0.018, cz + r1 * s2];
          const cp4 = [cx + r2 * c2, 0.018, cz + r2 * s2];
          curbPos.push(...cp1, ...cp3, ...cp2, ...cp2, ...cp3, ...cp4);
        }
        const curbGeo = new THREE.BufferGeometry();
        curbGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(curbPos), 3));
        curbGeo.computeVertexNormals();
        const curbMesh = new THREE.Mesh(curbGeo, curbMat);
        curbMesh.receiveShadow = true;
        this.scene.add(curbMesh);
      };

      createCurbArc(rIn, 0.45);
      createCurbArc(rOut, 0.45);

      // Curved lane dashes along centerline radius
      const numCornerDashes = 4;
      for (let j = 0; j < numCornerDashes; j++) {
        const angle = a1 + ((j + 0.5) / numCornerDashes) * (a2 - a1);
        const dx = cx + Rc * Math.cos(angle);
        const dz = cz + Rc * Math.sin(angle);
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 3.2), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = -angle + Math.PI / 2;
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

  buildSlalomArea() {
    // Factory for Modern Rounded Traffic Cones
    const createModernRoundedConeMesh = () => {
      const root = new THREE.Group();
      const model = new THREE.Group();
      root.add(model);
      root.model = model;

      const coneMat = new THREE.MeshStandardMaterial({
        color: 0x64748b, // Modern matte slate-grey
        roughness: 0.45,
        metalness: 0.05
      });
      const stripeMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc, // Crisp off-white reflective collar
        roughness: 0.25,
        metalness: 0.05
      });
      const baseRimMat = new THREE.MeshStandardMaterial({
        color: 0x334155, // Architectural dark slate rounded base
        roughness: 0.6,
        metalness: 0.05
      });

      // 1. Modern rounded cylindrical base plate
      const baseGeo = new THREE.CylinderGeometry(0.50, 0.54, 0.08, 24);
      const baseMesh = new THREE.Mesh(baseGeo, baseRimMat);
      baseMesh.position.y = 0.04;
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      model.add(baseMesh);

      // 2. Soft rounded toroidal edge rim around base plate
      const torusGeo = new THREE.TorusGeometry(0.50, 0.035, 8, 24);
      const torusMesh = new THREE.Mesh(torusGeo, baseRimMat);
      torusMesh.rotation.x = Math.PI / 2;
      torusMesh.position.y = 0.05;
      model.add(torusMesh);

      // 3. Smooth tapered conical body
      const bodyGeo = new THREE.CylinderGeometry(0.12, 0.35, 0.72, 24);
      const bodyMesh = new THREE.Mesh(bodyGeo, coneMat);
      bodyMesh.position.y = 0.42;
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      model.add(bodyMesh);

      // 4. Crown Dome (rounded spherical tip instead of sharp cone point)
      const domeGeo = new THREE.SphereGeometry(0.12, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const domeMesh = new THREE.Mesh(domeGeo, coneMat);
      domeMesh.position.y = 0.78;
      domeMesh.castShadow = true;
      model.add(domeMesh);

      // 5. Rounded reflective middle stripe band
      const stripeGeo = new THREE.CylinderGeometry(0.19, 0.24, 0.16, 24);
      const stripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
      stripeMesh.position.y = 0.42;
      model.add(stripeMesh);

      return root;
    };

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
      coneMesh.position.set(pos.x, 0, pos.z);
      this.scene.add(coneMesh);

      this.cones.push({
        mesh: coneMesh,
        model: coneMesh.model,
        homePos: new THREE.Vector3(pos.x, 0, pos.z),
        pos: new THREE.Vector3(pos.x, 0, pos.z),
        vel: new THREE.Vector3(0, 0, 0),
        rot: new THREE.Euler(0, 0, 0),
        angVel: new THREE.Vector3(0, 0, 0),
        radius: 0.45,
        height: 0.85,
        isSleeping: true,
        isFallen: false,
        fallHeading: 0,
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
        metalness: 0.04
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
        metalness: 0.04
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
        metalness: 0.05
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
        depth: b.d + 0.6
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

    // 1. VAN-TO-CONE IMPACT DETECTION (Does not skip physics integration of other cones!)
    for (const cone of this.cones) {
      if (cone.hitCooldown > 0) {
        cone.hitCooldown -= dt;
      }

      const dx = cone.pos.x - vanPos.x;
      const dz = cone.pos.z - vanPos.z;
      const dy = cone.pos.y - vanPos.y;

      // Only check van collision if cone is within proximity
      if (dx * dx + dz * dz <= 22.0) {
        const df = dx * forward.x + dz * forward.z; // Along van forward axis
        const dr = dx * right.x + dz * right.z;     // Along van right axis

        const overlapF = (hl + cone.radius) - Math.abs(df);
        const overlapR = (hw + cone.radius) - Math.abs(dr);

        if (overlapF > 0 && overlapR > 0 && dy > -0.6 && dy < 2.0) {
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
            cone.pos.x += pushDir.x * 0.45;
            cone.pos.z += pushDir.z * 0.45;

            const impactSpeed = Math.max(3.5, absSpeed);

            // Forward & radial momentum transfer
            cone.vel.x = vanVel.x * 1.25 + pushDir.x * (impactSpeed * 0.55 + 2.5) + (Math.random() - 0.5) * 1.5;
            cone.vel.z = vanVel.z * 1.25 + pushDir.z * (impactSpeed * 0.55 + 2.5) + (Math.random() - 0.5) * 1.5;
            // Pop into air
            cone.vel.y = Math.min(6.5, impactSpeed * 0.35 + 2.2);

            // 3D tumble angular spin
            cone.angVel.x = (Math.random() - 0.5) * impactSpeed * 2.5 + pushDir.z * impactSpeed * 1.5;
            cone.angVel.y = (Math.random() - 0.5) * impactSpeed * 3.5;
            cone.angVel.z = (Math.random() - 0.5) * impactSpeed * 2.5 - pushDir.x * impactSpeed * 1.5;

            cone.isSleeping = false;
            cone.isFallen = false;

            // Reset sub-model to standard un-tilted alignment while airborne
            cone.model.position.set(0, 0, 0);
            cone.model.rotation.set(0, 0, 0);

            if (audio && audio.playConeHit) {
              audio.playConeHit(impactSpeed);
            }
          }
        }
      }
    }

    // 2. PHYSICAL INTEGRATION & OBSTACLE/RAMP COLLISIONS (RUNS FOR ALL ACTIVE CONES REGARDLESS OF DISTANCE)
    for (const cone of this.cones) {
      if (cone.isSleeping) continue;

      // Gravity
      cone.vel.y -= 19.6 * dt;

      // Position update
      cone.pos.x += cone.vel.x * dt;
      cone.pos.y += cone.vel.y * dt;
      cone.pos.z += cone.vel.z * dt;

      // 2A. BUILDING & RAMP SIDE-WALL COLLISIONS
      for (const col of this.colliders) {
        if (col.type === 'box') {
          // Building box collision
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
          // Ramp solid side-wall collision
          const dx = cone.pos.x - col.x;
          const dz = cone.pos.z - col.z;
          const cosA = Math.cos(col.angleY);
          const sinA = Math.sin(col.angleY);
          const localX = dx * cosA - dz * sinA;
          const localZ = dx * sinA + dz * cosA;

          const rhw = col.width / 2;
          const rhd = col.depth / 2;

          // Check if along ramp length
          if (Math.abs(localZ) <= rhd) {
            const distFromPeak = Math.abs(localZ);
            const progress = Math.max(0, 1.0 - (distFromPeak / rhd));
            const rampH = progress * col.height;

            // If cone is at the side of the ramp and below ramp surface, bounce off solid side wall
            if (Math.abs(localX) < rhw + cone.radius && cone.pos.y < rampH - 0.1) {
              const signX = Math.sign(localX) || 1;
              const newLocalX = (rhw + cone.radius) * signX;
              cone.pos.x = col.x + newLocalX * cosA + localZ * sinA;
              cone.pos.z = col.z - newLocalX * sinA + localZ * cosA;

              // Reflect velocity off ramp wall
              const lvx = cone.vel.x * cosA - cone.vel.z * sinA;
              const lvz = cone.vel.x * sinA + cone.vel.z * cosA;
              const newLvx = -lvx * 0.45;
              cone.vel.x = newLvx * cosA + lvz * sinA;
              cone.vel.z = -newLvx * sinA + lvz * cosA;
            }
          }
        }
      }

      // 2B. GROUND & RAMP SURFACE SAMPLING
      const rampSample = this.sampleRampAt(cone.pos.x, cone.pos.z);
      const groundY = rampSample.isOnRamp ? rampSample.height : 0.0;

      // Surface contact (lands on either flat road surface or ramp slope)
      if (cone.pos.y <= groundY) {
        cone.pos.y = groundY;
        if (cone.vel.y < -1.0) {
          cone.vel.y = -cone.vel.y * 0.32; // Elastic restitution bounce
        } else {
          cone.vel.y = 0;
        }

        // Strong ground sliding friction
        cone.vel.x *= Math.pow(0.06, dt);
        cone.vel.z *= Math.pow(0.06, dt);
        // Ground angular friction
        cone.angVel.x *= Math.pow(0.04, dt);
        cone.angVel.y *= Math.pow(0.04, dt);
        cone.angVel.z *= Math.pow(0.04, dt);
      } else {
        // Air drag
        cone.vel.x *= Math.pow(0.92, dt);
        cone.vel.z *= Math.pow(0.92, dt);
        cone.angVel.x *= Math.pow(0.90, dt);
        cone.angVel.y *= Math.pow(0.90, dt);
        cone.angVel.z *= Math.pow(0.90, dt);
      }

      // Angular integration
      cone.rot.x += cone.angVel.x * dt;
      cone.rot.y += cone.angVel.y * dt;
      cone.rot.z += cone.angVel.z * dt;

      // 2C. SETTLING & SLEEP CHECK (ROCKSOLID RESTING ON GROUND/RAMP SURFACE - ZERO AIR SETTLE)
      const horizSpeed = Math.hypot(cone.vel.x, cone.vel.z);
      const angSpeed = Math.hypot(cone.angVel.x, cone.angVel.y, cone.angVel.z);

      if (cone.pos.y <= groundY + 0.01 && horizSpeed < 0.12 && angSpeed < 0.20) {
        cone.vel.set(0, 0, 0);
        cone.angVel.set(0, 0, 0);
        cone.pos.y = groundY;

        const tilt = Math.hypot(cone.rot.x, cone.rot.z);
        if (tilt < 0.35) {
          // Settled upright
          cone.isFallen = false;
          cone.mesh.position.set(cone.pos.x, groundY, cone.pos.z);
          cone.mesh.rotation.set(0, cone.rot.y, 0);
          cone.model.position.set(0, 0, 0);
          cone.model.rotation.set(0, 0, 0);
        } else {
          // Settled flat on side
          cone.isFallen = true;
          cone.fallHeading = cone.rot.y + Math.atan2(cone.rot.x, cone.rot.z || 0.001);
          cone.mesh.position.set(cone.pos.x, groundY, cone.pos.z);
          cone.mesh.rotation.set(0, cone.fallHeading, 0);
          // Precise 74 degree taper alignment so bottom edge touches ground surface perfectly
          cone.model.position.set(0, 0.52, 0.12);
          cone.model.rotation.set(Math.PI / 2 - 0.28, 0, 0);
        }
        cone.isSleeping = true;
      } else {
        // While moving/tumbling in air
        cone.mesh.position.set(cone.pos.x, cone.pos.y, cone.pos.z);
        cone.mesh.rotation.copy(cone.rot);
        cone.model.position.set(0, 0, 0);
        cone.model.rotation.set(0, 0, 0);
      }
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
      cone.isFallen = false;
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
