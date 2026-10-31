import {
  Mesh,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  DynamicTexture,
  Texture,
  Color3,
  Vector3,
  Quaternion,
  VertexData,
  PhysicsMotionType,
  SceneLoader
} from '@babylonjs/core';
import '@babylonjs/loaders';

export class CityWorld {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.levelMeshes = [];
    this.physicsAggregates = [];
    this.dynamicCrates = [];
    this.currentLevel = 'city';
    this.cratesKnockedCount = 0;

    this.deliverySpots = [
      { id: 'spot_1', name: 'Palm Villa Delivery', position: new Vector3(0, 0.1, 48) },
      { id: 'spot_2', name: 'Canary North Bay', position: new Vector3(-70, 0.1, 115) },
      { id: 'spot_3', name: 'Victoria Tower Drop', position: new Vector3(90, 0.1, 85) },
      { id: 'spot_4', name: 'South Quay Plaza', position: new Vector3(115, 0.1, -95) },
      { id: 'spot_5', name: 'West India Gate', position: new Vector3(-125, 0.1, -65) },
      { id: 'spot_6', name: 'Meridian Avenue', position: new Vector3(-45, 0.1, -135) }
    ];
    this.cones = [];
    this.crates = [];
    this.boostPads = [];
    this.boostCooldown = 0;
    this.cardboardBoxTemplate = null;
    this.cardboardBoxLoading = false;

    this.initSharedMaterials();
    this.loadCardboardBoxTemplate();
    this.buildSeamlessRoadFloor();
    this.buildTestingRamps();
    this.buildSpeedBumpTestingArea();
  }

  async loadCardboardBoxTemplate() {
    if (this.cardboardBoxTemplate || this.cardboardBoxLoading) return;
    this.cardboardBoxLoading = true;
    try {
      const result = await SceneLoader.ImportMeshAsync('', '/models/', 'cardboard_box_01.glb', this.scene);
      const meshes = result.meshes;
      const rootNode = meshes[0];
      let boxMesh = null;

      for (const m of meshes) {
        if (m === rootNode) continue;
        const name = (m.name || '').toLowerCase();
        // Keep only the cardboard box mesh ("Box_Material.001_0"), dispose any reference human figure ("Lowpoly Male Standing" / "nik_HINU76")
        if (name.includes('box')) {
          boxMesh = m;
        } else {
          m.setEnabled(false);
          m.isVisible = false;
        }
      }

      if (boxMesh) {
        // Ensure world matrix is up to date before detaching or reading bounds
        boxMesh.computeWorldMatrix(true);
        boxMesh.setParent(null);

        // Enforce strictly matte, non-shiny, non-specular cardboard material
        const mat = boxMesh.material;
        if (mat) {
          const enhanceTex = (tex) => {
            if (tex) {
              tex.anisotropicFilteringLevel = 16;
              tex.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
            }
          };
          enhanceTex(mat.albedoTexture);
          enhanceTex(mat.diffuseTexture);
          enhanceTex(mat.bumpTexture);

          if (mat instanceof PBRMaterial || mat.getClassName?.() === 'PBRMaterial') {
            mat.roughness = 1.0;
            mat.metallic = 0.0;
            mat.specularIntensity = 0.0;
            mat.environmentIntensity = 0.45;
            mat.directIntensity = 1.35;
            mat.useRoughnessFromMetallicTextureAlpha = false;
            mat.useRoughnessFromMetallicTextureGreen = false;
            mat.useMetallnessFromMetallicTextureBlue = false;
            mat.metallicTexture = null;
            if (mat.clearCoat) {
              mat.clearCoat.isEnabled = false;
              mat.clearCoat.intensity = 0.0;
            }
            if (mat.sheen) {
              mat.sheen.isEnabled = false;
            }
            if (mat.reflectivityColor) {
              mat.reflectivityColor.set(0, 0, 0);
            }
            if (mat.microSurface !== undefined) {
              mat.microSurface = 0.0;
            }
          } else if (mat.specularColor) {
            mat.specularColor.set(0, 0, 0);
            mat.roughness = 1.0;
          }
        }

        // Hide template mesh in scene and attach visual clones to active crates
        boxMesh.setEnabled(false);
        boxMesh.isVisible = false;
        this.cardboardBoxTemplate = boxMesh;

        // Dispose unused hierarchy nodes from the GLB
        try { rootNode.dispose(false); } catch (_) {}

        this.attachCardboardVisualsToCrates();
      }
    } catch (err) {
      console.warn('Could not load cardboard_box_01.glb, using fallback crate material:', err);
    } finally {
      this.cardboardBoxLoading = false;
    }
  }

  attachCardboardVisualsToCrates() {
    if (!this.cardboardBoxTemplate || !this.dynamicCrates) return;
    const crateSize = 0.88;

    // Measure local bounding box of the template mesh to center and scale it to fit crateSize
    this.cardboardBoxTemplate.refreshBoundingInfo(true);
    const bbox = this.cardboardBoxTemplate.getBoundingInfo().boundingBox;
    const min = bbox.minimum;
    const max = bbox.maximum;
    const sizeX = Math.max(0.001, max.x - min.x);
    const sizeY = Math.max(0.001, max.y - min.y);
    const sizeZ = Math.max(0.001, max.z - min.z);
    const centerX = (min.x + max.x) * 0.5;
    const centerY = (min.y + max.y) * 0.5;
    const centerZ = (min.z + max.z) * 0.5;

    const scaleX = crateSize / sizeX;
    const scaleY = crateSize / sizeY;
    const scaleZ = crateSize / sizeZ;

    for (let i = 0; i < this.dynamicCrates.length; i++) {
      const item = this.dynamicCrates[i];
      if (!item.mesh || item.visualMesh) continue;

      // Hide the proxy physics box surface so only the cardboard box 3D model is rendered
      item.mesh.isVisible = false;

      const clone = this.cardboardBoxTemplate.clone(`CardboardBoxVisual_${i + 1}`);
      if (clone) {
        clone.setEnabled(true);
        clone.isVisible = true;
        clone.receiveShadows = true;
        clone.parent = item.mesh;
        clone.rotationQuaternion = Quaternion.Identity();
        clone.scaling.set(scaleX, scaleY, scaleZ);
        clone.position.set(
          -centerX * scaleX,
          -centerY * scaleY,
          -centerZ * scaleZ
        );
        item.visualMesh = clone;
      }
    }
  }

  initSharedMaterials() {
    // 1. High-Quality Architectural PBR Material (Luminous concrete composite)
    this.rampMat = new PBRMaterial('rampPBRMat', this.scene);
    this.rampMat.albedoColor = new Color3(0.86, 0.90, 0.95);
    this.rampMat.roughness = 0.62;
    this.rampMat.metallic = 0.06;
    this.rampMat.directIntensity = 1.9;
    this.rampMat.environmentIntensity = 0.35;
    this.rampMat.backFaceCulling = false;
    this.rampMat.twoSidedLighting = true;
    this.rampMat.zOffset = -2;

    // 2. High-Visibility Neon Cyan / Turquoise Edge Trim Material
    this.trimMat = new PBRMaterial('rampTrimPBRMat', this.scene);
    this.trimMat.albedoColor = new Color3(0.00, 0.88, 1.00);
    this.trimMat.emissiveColor = new Color3(0.00, 0.40, 0.50);
    this.trimMat.roughness = 0.30;
    this.trimMat.metallic = 0.15;
    this.trimMat.backFaceCulling = false;
    this.trimMat.twoSidedLighting = true;
    this.trimMat.zOffset = -6;

    // 3. Amber / Gold Trim Material for Proving Ground Specialty Obstacles (Moguls & Tabletop)
    this.amberTrimMat = new PBRMaterial('amberTrimPBRMat', this.scene);
    this.amberTrimMat.albedoColor = new Color3(1.00, 0.72, 0.00);
    this.amberTrimMat.emissiveColor = new Color3(0.55, 0.35, 0.00);
    this.amberTrimMat.roughness = 0.30;
    this.amberTrimMat.metallic = 0.15;
    this.amberTrimMat.backFaceCulling = false;
    this.amberTrimMat.twoSidedLighting = true;
    this.amberTrimMat.zOffset = -6;

    // 4. Emerald Green Trim Material for Canyon Gap Ramps
    this.emeraldTrimMat = new PBRMaterial('emeraldTrimPBRMat', this.scene);
    this.emeraldTrimMat.albedoColor = new Color3(0.10, 0.95, 0.55);
    this.emeraldTrimMat.emissiveColor = new Color3(0.04, 0.45, 0.25);
    this.emeraldTrimMat.roughness = 0.30;
    this.emeraldTrimMat.metallic = 0.15;
    this.emeraldTrimMat.backFaceCulling = false;
    this.emeraldTrimMat.twoSidedLighting = true;
    this.emeraldTrimMat.zOffset = -6;

    // 5. Havok Crash Crate Material (High-visibility Safety Orange & Cyan Lab Cube)
    const crateTex = new DynamicTexture('havokCrateTex', { width: 256, height: 256 }, this.scene, true);
    const ctx = crateTex.getContext();
    ctx.fillStyle = '#f97316';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 18;
    ctx.strokeRect(9, 9, 238, 238);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(24, 24);
    ctx.lineTo(84, 24);
    ctx.lineTo(24, 84);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(232, 232);
    ctx.lineTo(172, 232);
    ctx.lineTo(232, 172);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(42, 110, 172, 36);
    ctx.fillStyle = '#041217';
    ctx.font = '900 22px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HAVOK TEST', 128, 129);
    crateTex.update();

    this.crateMat = new PBRMaterial('havokCrateMat', this.scene);
    this.crateMat.albedoTexture = crateTex;
    this.crateMat.roughness = 0.48;
    this.crateMat.metallic = 0.08;
    this.crateMat.directIntensity = 1.7;
  }

  buildSeamlessRoadFloor() {
    // 1. Massive Driving Plane (500m x 500m open floor)
    const floorSize = 500;
    this.ground = MeshBuilder.CreateGround('roadFloor', {
      width: floorSize,
      height: floorSize,
      subdivisions: 4
    }, this.scene);
    this.ground.position.set(0, 0, 0);
    this.ground.receiveShadows = true;

    // 2. High-Resolution Seamless Road Textures (Road006 4K Diffuse & Normal)
    const diffuseTex = new Texture('/assets/textures/Road006_4K_Color.jpg', this.scene);
    const normalTex = new Texture('/assets/textures/Road006_4K_Normal.jpg', this.scene);

    const tilingScale = 36;
    diffuseTex.uScale = tilingScale;
    diffuseTex.vScale = tilingScale;
    diffuseTex.wrapU = Texture.WRAP_ADDRESSMODE;
    diffuseTex.wrapV = Texture.WRAP_ADDRESSMODE;
    diffuseTex.anisotropicFilteringLevel = 16;

    normalTex.uScale = tilingScale;
    normalTex.vScale = tilingScale;
    normalTex.wrapU = Texture.WRAP_ADDRESSMODE;
    normalTex.wrapV = Texture.WRAP_ADDRESSMODE;
    normalTex.anisotropicFilteringLevel = 16;

    // 3. Physically-Based Rendering (PBR) Road Material
    this.roadPBRMat = new PBRMaterial('roadPBRMat', this.scene);
    this.roadPBRMat.albedoTexture = diffuseTex;
    this.roadPBRMat.bumpTexture = normalTex;
    this.roadPBRMat.bumpTexture.level = 1.35;
    this.roadPBRMat.roughness = 0.80;
    this.roadPBRMat.metallic = 0.02;
    this.roadPBRMat.specularIntensity = 0.55;
    this.roadPBRMat.environmentIntensity = 0.16;
    this.roadPBRMat.directIntensity = 2.30;
    this.roadPBRMat.useRoughnessFromMetallicTextureAlpha = false;

    // 4. Precision 1m x 1m Proving Ground Grid Material
    // 1024x1024 texture representing a 5m x 5m block, tiled 100 times across 500m = exact 1.00m x 1.00m grid cells!
    this.gridPBRMat = this.createOneMeterGridMaterial();

    this.ground.material = this.roadPBRMat;
  }

  createOneMeterGridMaterial() {
    const texSize = 1024;
    const gridTex = new DynamicTexture('provingGround1mGridTex', { width: texSize, height: texSize }, this.scene, true);
    const ctx = gridTex.getContext();

    // Base light/medium grey laboratory test floor as requested
    ctx.fillStyle = '#8E9296';
    ctx.fillRect(0, 0, texSize, texSize);

    const cellPx = texSize / 5.0; // 1.00m per cell (5 cells across 5m tile)
    const subPx = cellPx / 4.0;   // 0.25m sub-grid increments

    // Subtle checkerboard tonal variation between adjacent 1m x 1m squares for immediate speed & scale perception
    for (let gx = 0; gx < 5; gx++) {
      for (let gz = 0; gz < 5; gz++) {
        if ((gx + gz) % 2 === 1) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
          ctx.fillRect(gx * cellPx, gz * cellPx, cellPx, cellPx);
        }
      }
    }

    // 0.25m fine measurement sub-grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 20; i++) {
      if (i % 4 === 0) continue;
      const p = Math.round(i * subPx) + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, texSize);
      ctx.moveTo(0, p);
      ctx.lineTo(texSize, p);
    }
    ctx.stroke();

    // Exact 1.00m x 1.00m primary grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 1; i < 5; i++) {
      const p = Math.round(i * cellPx);
      ctx.moveTo(p, 0);
      ctx.lineTo(p, texSize);
      ctx.moveTo(0, p);
      ctx.lineTo(texSize, p);
    }
    ctx.stroke();

    // Bold 5.00m major boundary lines along tile edges
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 5;
    ctx.strokeRect(2, 2, texSize - 4, texSize - 4);

    // Precision 1m scale labels & corner crosshairs
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '700 18px Rajdhani, monospace, sans-serif';
    for (let i = 0; i < 5; i++) {
      const x = Math.round(i * cellPx) + 10;
      const y = Math.round(i * cellPx) + 22;
      ctx.fillText('1.0m', x, y);
    }

    gridTex.update(true);
    gridTex.uScale = 100; // 500m / 5m = 100 repetitions -> exact 1.00m x 1.00m squares
    gridTex.vScale = 100;
    gridTex.wrapU = Texture.WRAP_ADDRESSMODE;
    gridTex.wrapV = Texture.WRAP_ADDRESSMODE;
    gridTex.anisotropicFilteringLevel = 16;

    // Strictly matte, non-specular, non-reflective PBR material
    const mat = new PBRMaterial('provingGroundGridPBRMat', this.scene);
    mat.albedoTexture = gridTex;
    mat.roughness = 1.0;
    mat.metallic = 0.0;
    mat.specularIntensity = 0.0;
    mat.reflectivityColor = new Color3(0, 0, 0);
    mat.microSurface = 0.0;
    mat.environmentIntensity = 0.25;
    mat.directIntensity = 1.45;
    mat.useRoughnessFromMetallicTextureAlpha = false;
    return mat;
  }

  /**
   * Switches between the 'city' level and the 'proving_ground' level.
   */
  loadLevel(levelName = 'city') {
    this.currentLevel = levelName;
    this.clearCurrentLevelObjects();

    if (levelName === 'proving_ground') {
      if (this.ground && this.gridPBRMat) {
        this.ground.material = this.gridPBRMat;
      }
      this.buildProvingGroundLevel();
    } else {
      if (this.ground && this.roadPBRMat) {
        this.ground.material = this.roadPBRMat;
      }
      this.buildTestingRamps();
      this.buildSpeedBumpTestingArea();
    }

    if (this.PhysicsAggregate && this.PhysicsShapeType) {
      this.rebuildObstacleHavokPhysics();
    }
  }

  clearCurrentLevelObjects() {
    // Dispose obstacle Havok aggregates (keep groundAggregate intact)
    if (this.physicsAggregates && this.physicsAggregates.length > 0) {
      for (const agg of this.physicsAggregates) {
        try { agg.dispose(); } catch (_) {}
      }
      this.physicsAggregates = [];
    }

    // Dispose dynamic Havok crates
    if (this.dynamicCrates && this.dynamicCrates.length > 0) {
      for (const item of this.dynamicCrates) {
        if (item.aggregate) {
          try { item.aggregate.dispose(); } catch (_) {}
        }
        if (item.mesh) {
          try { item.mesh.dispose(); } catch (_) {}
        }
      }
      this.dynamicCrates = [];
    }

    // Dispose static level meshes
    if (this.levelMeshes && this.levelMeshes.length > 0) {
      for (const m of this.levelMeshes) {
        try { m.dispose(false, false); } catch (_) {}
      }
      this.levelMeshes = [];
    }

    // Mutate in place so references in ArcadeVehicle & CameraManager stay live
    this.colliders.length = 0;
    this.cratesKnockedCount = 0;
  }

  /**
   * Evaluates the C1-continuous smooth architectural stunt ramp profile at localZ in [-hd, +hd].
   */
  static evaluateRampProfile(localZ, hd, h) {
    const absZ = Math.abs(localZ);
    if (absZ >= hd) {
      return { height: 0, slopeZ: 0 };
    }
    const u = absZ / hd;
    const u1 = 0.20;
    const u2 = 0.85;
    const m = 2.0 / (1.0 + u2 - u1);

    let normH = 0;
    let dNormDu = 0;
    if (u <= u1) {
      normH = 1.0 - (m / (2.0 * u1)) * u * u;
      dNormDu = -m * (u / u1);
    } else if (u < u2) {
      normH = 1.0 - 0.5 * m * u1 - m * (u - u1);
      dNormDu = -m;
    } else {
      const rem = 1.0 - u;
      normH = (m / (2.0 * (1.0 - u2))) * rem * rem;
      dNormDu = -m * (rem / (1.0 - u2));
    }

    const signZ = localZ >= 0 ? 1.0 : -1.0;
    const height = Math.max(0, h * normH);
    const slopeZ = signZ * (h / hd) * dNormDu;
    return { height, slopeZ };
  }

  /**
   * Evaluates an Elevated Tabletop Stunt Platform with a smooth C1 entry ramp on [-hd, -0.22*hd],
   * a flat elevated tabletop deck on [-0.22*hd, +0.22*hd], and a smooth C1 exit ramp on [+0.22*hd, +hd].
   * Eliminates any flat y=0 apron (zero Z-fighting) and allows smooth driving/launching from both directions.
   */
  static evaluateTabletopProfile(localZ, hd, h) {
    const absZ = Math.abs(localZ);
    if (absZ >= hd) {
      return { height: 0, slopeZ: 0 };
    }
    const deckHalf = hd * 0.22;
    if (absZ <= deckHalf) {
      return { height: h, slopeZ: 0 };
    }
    const rampSpan = Math.max(0.001, hd - deckHalf);
    const t = (hd - absZ) / rampSpan; // 0 at outer toe (±hd), 1 at tabletop lip (±deckHalf)
    const normH = 0.5 * (1.0 - Math.cos(Math.PI * t));
    const signZ = localZ >= 0 ? 1.0 : -1.0;
    const slopeZ = -signZ * (h * Math.PI / (2.0 * rampSpan)) * Math.sin(Math.PI * t);
    return { height: Math.max(0, h * normH), slopeZ };
  }

  createProfiledRampMesh(name, w, d, h, material, trimMaterial, profileFn = CityWorld.evaluateRampProfile) {
    const hw = w / 2;
    const hd = d / 2;
    const segments = 36;
    const baseLift = 0.005; // 5mm lift above ground plane prevents any toe Z-fighting with y=0 ground

    const positions = [];
    const indices = [];
    const normals = [];
    const uvs = [];

    // 1. Top Surface
    for (let i = 0; i <= segments; i++) {
      const v = i / segments;
      const z = -hd + v * d;
      const { height: rawY, slopeZ } = profileFn(z, hd, h);
      const y = rawY + baseLift;

      const len = Math.sqrt(1.0 + slopeZ * slopeZ);
      const ny = 1.0 / len;
      const nz = -slopeZ / len;

      positions.push(-hw, y, z);
      normals.push(0, ny, nz);
      uvs.push(0, v);

      positions.push(hw, y, z);
      normals.push(0, ny, nz);
      uvs.push(1, v);

      if (i < segments) {
        const row0 = i * 2;
        const row1 = (i + 1) * 2;
        indices.push(row0, row0 + 1, row1);
        indices.push(row0 + 1, row1 + 1, row1);
      }
    }

    // 2. Closed Left Gable Side Wall (-X) built as clean vertical quad strips (zero degenerate fan overlap)
    const leftBaseIdx = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const v = i / segments;
      const z = -hd + v * d;
      const { height: rawY } = profileFn(z, hd, h);
      const y = rawY + baseLift;

      // Bottom vertex on ground
      positions.push(-hw, 0.002, z);
      normals.push(-1, 0, 0);
      uvs.push(v, 0);

      // Top vertex on profile edge
      positions.push(-hw, y, z);
      normals.push(-1, 0, 0);
      uvs.push(v, y / Math.max(0.001, h));

      if (i < segments) {
        const r0 = leftBaseIdx + i * 2;
        const r1 = leftBaseIdx + (i + 1) * 2;
        indices.push(r0, r0 + 1, r1 + 1);
        indices.push(r0, r1 + 1, r1);
      }
    }

    // 3. Closed Right Gable Side Wall (+X) built as clean vertical quad strips
    const rightBaseIdx = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const v = i / segments;
      const z = -hd + v * d;
      const { height: rawY } = profileFn(z, hd, h);
      const y = rawY + baseLift;

      // Bottom vertex on ground
      positions.push(hw, 0.002, z);
      normals.push(1, 0, 0);
      uvs.push(v, 0);

      // Top vertex on profile edge
      positions.push(hw, y, z);
      normals.push(1, 0, 0);
      uvs.push(v, y / Math.max(0.001, h));

      if (i < segments) {
        const r0 = rightBaseIdx + i * 2;
        const r1 = rightBaseIdx + (i + 1) * 2;
        indices.push(r0, r1 + 1, r0 + 1);
        indices.push(r0, r1, r1 + 1);
      }
    }

    const rampMesh = new Mesh(name, this.scene);
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.uvs = uvs;
    vertexData.applyToMesh(rampMesh);

    rampMesh.material = material;
    rampMesh.receiveShadows = true;
    this.levelMeshes.push(rampMesh);

    // 4. Visual Neon Trim Rails displaced along true surface normal (zero Z-fighting on any slope)
    if (trimMaterial) {
      const railWidth = 0.32;
      const railPositions = [];
      const railIndices = [];
      const railNormals = [];
      const railUVs = [];

      const buildRail = (x0, x1) => {
        const startIdx = railPositions.length / 3;
        for (let i = 0; i <= segments; i++) {
          const v = i / segments;
          const rawZ = -hd + v * d;
          const { height: rawY, slopeZ } = profileFn(rawZ, hd, h);

          const len = Math.sqrt(1.0 + slopeZ * slopeZ);
          const ny = 1.0 / len;
          const nz = -slopeZ / len;

          const y = rawY + baseLift + ny * 0.015;
          const z = rawZ + nz * 0.015;

          railPositions.push(x0, y, z);
          railNormals.push(0, ny, nz);
          railUVs.push(0, v);

          railPositions.push(x1, y, z);
          railNormals.push(0, ny, nz);
          railUVs.push(1, v);

          if (i < segments) {
            const r0 = startIdx + i * 2;
            const r1 = startIdx + (i + 1) * 2;
            railIndices.push(r0, r0 + 1, r1);
            railIndices.push(r0 + 1, r1 + 1, r1);
          }
        }
      };

      buildRail(-hw, -hw + railWidth);
      buildRail(hw - railWidth, hw);

      const railMesh = new Mesh(`${name}_trim`, this.scene);
      const railVD = new VertexData();
      railVD.positions = railPositions;
      railVD.indices = railIndices;
      railVD.normals = railNormals;
      railVD.uvs = railUVs;
      railVD.applyToMesh(railMesh);
      railMesh.material = trimMaterial;
      railMesh.receiveShadows = true;
      railMesh.parent = rampMesh;
      this.levelMeshes.push(railMesh);
    }

    return rampMesh;
  }

  createDoubleSidedRampMesh(name, w, d, h, material, trimMaterial) {
    return this.createProfiledRampMesh(name, w, d, h, material, trimMaterial, CityWorld.evaluateRampProfile);
  }

  buildTestingRamps() {
    const addRamp = (name, x, z, w, d, h, angleY = 0) => {
      const mesh = this.createDoubleSidedRampMesh(name, w, d, h, this.rampMat, this.trimMat);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = angleY;

      this.colliders.push({
        type: 'ramp',
        name,
        mesh,
        isDoubleSided: true,
        x,
        z,
        width: w,
        depth: d,
        height: h,
        angleY,
        evaluateProfile: CityWorld.evaluateRampProfile
      });
    };

    // Ramp 1: Central Spine Jump & Slope (Straight ahead from van initial spawn/reset)
    addRamp('Ramp_Central', 0, -10, 7.5, 14.0, 2.2, 0);

    // Ramp 2: East Boulevard Jump & Slope
    addRamp('Ramp_East', 45, 50, 7.5, 14.0, 2.5, -Math.PI / 2);

    // Ramp 3: West Boulevard Jump & Slope
    addRamp('Ramp_West', -45, -65, 7.5, 14.0, 2.5, Math.PI / 2);

    // Ramp 4: North Loop Mega Stunt Jump
    addRamp('Ramp_NorthMega', 0, 85, 9.0, 16.0, 3.2, 0);
  }

  createSpeedBumpMesh(name, w, l, h, material, trimMaterial) {
    const hw = w / 2;
    const hl = l / 2;
    const segments = 12;

    const positions = [];
    const indices = [];
    const normals = [];
    const uvs = [];

    for (let i = 0; i <= segments; i++) {
      const v = i / segments;
      const z = -hl + v * l;
      const y = h * 0.5 * (1.0 - Math.cos(v * (2.0 * Math.PI)));

      const slope = (h * Math.PI / l) * Math.sin(v * (2.0 * Math.PI));
      const len = Math.sqrt(1.0 + slope * slope);
      const ny = 1.0 / len;
      const nz = -slope / len;

      positions.push(-hw, y, z);
      normals.push(0, ny, nz);
      uvs.push(0, v);

      positions.push(hw, y, z);
      normals.push(0, ny, nz);
      uvs.push(1, v);

      if (i < segments) {
        const row0 = i * 2;
        const row1 = (i + 1) * 2;
        indices.push(row0, row0 + 1, row1);
        indices.push(row0 + 1, row1 + 1, row1);
      }
    }

    const leftBaseIdx = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const v = i / segments;
      const z = -hl + v * l;
      const y = h * 0.5 * (1.0 - Math.cos(v * (2.0 * Math.PI)));
      positions.push(-hw, y, z);
      normals.push(-1, 0, 0);
      uvs.push(v, y / Math.max(0.001, h));
    }
    const leftCenterIdx = positions.length / 3;
    positions.push(-hw, 0, 0);
    normals.push(-1, 0, 0);
    uvs.push(0.5, 0);
    for (let i = 0; i < segments; i++) {
      indices.push(leftCenterIdx, leftBaseIdx + i, leftBaseIdx + i + 1);
    }

    const rightBaseIdx = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const v = i / segments;
      const z = -hl + v * l;
      const y = h * 0.5 * (1.0 - Math.cos(v * (2.0 * Math.PI)));
      positions.push(hw, y, z);
      normals.push(1, 0, 0);
      uvs.push(v, y / Math.max(0.001, h));
    }
    const rightCenterIdx = positions.length / 3;
    positions.push(hw, 0, 0);
    normals.push(1, 0, 0);
    uvs.push(0.5, 0);
    for (let i = 0; i < segments; i++) {
      indices.push(rightCenterIdx, rightBaseIdx + i + 1, rightBaseIdx + i);
    }

    const bumpMesh = new Mesh(name, this.scene);
    const vd = new VertexData();
    vd.positions = positions;
    vd.indices = indices;
    vd.normals = normals;
    vd.uvs = uvs;
    vd.applyToMesh(bumpMesh);
    bumpMesh.material = material;
    bumpMesh.receiveShadows = true;
    this.levelMeshes.push(bumpMesh);

    if (trimMaterial) {
      const railWidth = Math.min(0.28, w * 0.14);
      const railPositions = [];
      const railIndices = [];
      const railNormals = [];
      const railUVs = [];

      const buildRail = (x0, x1) => {
        const startIdx = railPositions.length / 3;
        for (let i = 0; i <= segments; i++) {
          const v = i / segments;
          const z = -hl + v * l;
          const y = h * 0.5 * (1.0 - Math.cos(v * (2.0 * Math.PI))) + 0.008;

          const slope = (h * Math.PI / l) * Math.sin(v * (2.0 * Math.PI));
          const len = Math.sqrt(1.0 + slope * slope);
          const ny = 1.0 / len;
          const nz = -slope / len;

          railPositions.push(x0, y, z);
          railNormals.push(0, ny, nz);
          railUVs.push(0, v);

          railPositions.push(x1, y, z);
          railNormals.push(0, ny, nz);
          railUVs.push(1, v);

          if (i < segments) {
            const r0 = startIdx + i * 2;
            const r1 = startIdx + (i + 1) * 2;
            railIndices.push(r0, r0 + 1, r1);
            railIndices.push(r0 + 1, r1 + 1, r1);
          }
        }
      };

      buildRail(-hw, -hw + railWidth);
      buildRail(hw - railWidth, hw);

      const railMesh = new Mesh(`${name}_trim`, this.scene);
      const rvd = new VertexData();
      rvd.positions = railPositions;
      rvd.indices = railIndices;
      rvd.normals = railNormals;
      rvd.uvs = railUVs;
      rvd.applyToMesh(railMesh);
      railMesh.material = trimMaterial;
      railMesh.receiveShadows = true;
      railMesh.parent = bumpMesh;
      this.levelMeshes.push(railMesh);
    }

    return bumpMesh;
  }

  buildSpeedBumpTestingArea() {
    const addSpeedBump = (name, x, z, w, l, h, angleY = 0, trimMat = this.trimMat) => {
      const mesh = this.createSpeedBumpMesh(name, w, l, h, this.rampMat, trimMat);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = angleY;

      this.colliders.push({
        type: 'speedbump',
        name,
        mesh,
        x,
        z,
        width: w,
        length: l,
        height: h,
        angleY
      });
    };

    const trackX = 16.0;

    // Zone 1: Rapid Washboard / High-Frequency Rumble Bumps
    addSpeedBump('Bump_Wash_1', trackX, -20.0, 7.5, 1.0, 0.08);
    addSpeedBump('Bump_Wash_2', trackX, -17.0, 7.5, 1.0, 0.08);
    addSpeedBump('Bump_Wash_3', trackX, -14.0, 7.5, 1.0, 0.08);
    addSpeedBump('Bump_Wash_4', trackX, -11.0, 7.5, 1.0, 0.08);

    // Zone 2: Medium Urban Speed Bumps
    addSpeedBump('Bump_Urban_1', trackX, 2.0, 7.5, 1.5, 0.12);
    addSpeedBump('Bump_Urban_2', trackX, 9.5, 7.5, 1.5, 0.12);
    addSpeedBump('Bump_Urban_3', trackX, 18.0, 7.5, 1.5, 0.12);
    addSpeedBump('Bump_Urban_4', trackX, 27.5, 7.5, 1.5, 0.12);

    // Zone 3: Wide Speed Tables / Highway Humps
    addSpeedBump('Bump_Table_1', trackX, 43.0, 7.5, 2.2, 0.15);
    addSpeedBump('Bump_Table_2', trackX, 63.0, 7.5, 2.5, 0.17);

    this.addBollard('Bollard_L', trackX - 4.1, -24.0, this.trimMat);
    this.addBollard('Bollard_R', trackX + 4.1, -24.0, this.trimMat);
  }

  addBollard(name, x, z, mat = this.trimMat) {
    const bMesh = MeshBuilder.CreateCylinder(name, { height: 1.2, diameter: 0.32 }, this.scene);
    bMesh.position.set(x, 0.6, z);
    bMesh.material = mat;
    bMesh.receiveShadows = true;
    this.levelMeshes.push(bMesh);

    this.colliders.push({
      type: 'cylinder',
      name,
      mesh: bMesh,
      x,
      z,
      radius: 0.28,
      height: 1.2
    });
  }

  /**
   * Builds the dedicated 6-Station Physics Proving Ground Level on the 1m x 1m Grid.
   */
  buildProvingGroundLevel() {
    const addProfileRamp = (name, x, z, w, d, h, angleY = 0, trimMat = this.trimMat, profileFn = CityWorld.evaluateRampProfile) => {
      const mesh = this.createProfiledRampMesh(name, w, d, h, this.rampMat, trimMat, profileFn);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = angleY;

      this.colliders.push({
        type: 'ramp',
        name,
        mesh,
        isDoubleSided: true,
        crestOffset: profileFn === CityWorld.evaluateTabletopProfile ? (d * 0.5 * 0.22) : 0,
        x,
        z,
        width: w,
        depth: d,
        height: h,
        angleY,
        evaluateProfile: profileFn
      });
    };

    const addBump = (name, x, z, w, l, h, angleY = 0, trimMat = this.trimMat) => {
      const mesh = this.createSpeedBumpMesh(name, w, l, h, this.rampMat, trimMat);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = angleY;

      this.colliders.push({
        type: 'speedbump',
        name,
        mesh,
        x,
        z,
        width: w,
        length: l,
        height: h,
        angleY
      });
    };

    // =========================================================================
    // STATION 1 (Center Lane, X = 0m, Z = -10m): Smooth C1 Crest Stunt Ramp
    // =========================================================================
    addProfileRamp('PG_Ramp_Center', 0, -10, 7.5, 14.0, 2.2, 0, this.trimMat, CityWorld.evaluateRampProfile);

    // =========================================================================
    // STATION 2 (Center North, X = 0m, Z = 36m): Elevated Tabletop & Cliff Drop
    // =========================================================================
    // 20m long tabletop: 10m smooth entry incline + 9.2m flat 1.95m-high deck + sheer cliff drop-off at Z = 45.2m
    addProfileRamp('PG_Tabletop_Cliff', 0, 36, 8.0, 20.0, 1.95, 0, this.amberTrimMat, CityWorld.evaluateTabletopProfile);

    // =========================================================================
    // STATION 3 (West Lane, X = -16m): Alternating 4-Wheel Twist Mogul Track
    // =========================================================================
    // Left and Right wheels hit staggered 0.21m humps independently every 3.8m
    const mogulX = -16.0;
    this.addBollard('PG_Mogul_Gate_L', mogulX - 4.2, -24.0, this.amberTrimMat);
    this.addBollard('PG_Mogul_Gate_R', mogulX + 4.2, -24.0, this.amberTrimMat);
    for (let i = 0; i < 8; i++) {
      const isLeft = (i % 2 === 0);
      const offsetX = isLeft ? (mogulX - 1.55) : (mogulX + 1.55);
      const zPos = -19.0 + i * 3.8;
      addBump(`PG_Mogul_${i + 1}`, offsetX, zPos, 3.1, 2.3, 0.20, 0, this.amberTrimMat);
    }

    // =========================================================================
    // STATION 4 (East Lane, X = 16m): High-Frequency Washboard & Progressive Bumps
    // =========================================================================
    this.buildSpeedBumpTestingArea();
    // Add 2 extra tight washboard strips in Proving Ground for 6-ripple harmonic test
    addBump('PG_Wash_5', 16.0, -8.5, 7.5, 1.0, 0.08, 0, this.trimMat);
    addBump('PG_Wash_6', 16.0, -6.0, 7.5, 1.0, 0.08, 0, this.trimMat);

    // =========================================================================
    // STATION 5 (Far West Lane, X = -32m): Canyon Gap Double-Ramp Stunt Jump
    // =========================================================================
    const gapX = -32.0;
    this.addBollard('PG_Gap_Gate_L', gapX - 4.4, -4.0, this.emeraldTrimMat);
    this.addBollard('PG_Gap_Gate_R', gapX + 4.4, -4.0, this.emeraldTrimMat);
    addProfileRamp('PG_Canyon_Launch', gapX, 8.0, 8.0, 14.0, 2.3, 0, this.emeraldTrimMat, CityWorld.evaluateRampProfile);
    addProfileRamp('PG_Canyon_Landing', gapX, 31.0, 8.5, 14.0, 2.1, 0, this.emeraldTrimMat, CityWorld.evaluateRampProfile);

    // =========================================================================
    // STATION 6 (Far East Lane, X = 32m): Bollard Slalom & Havok Dynamic Crash Wall
    // =========================================================================
    const crashX = 32.0;
    this.addBollard('PG_Slalom_1', crashX - 1.8, -16.0, this.amberTrimMat);
    this.addBollard('PG_Slalom_2', crashX + 1.8, -7.0, this.amberTrimMat);
    this.addBollard('PG_Slalom_3', crashX - 1.8, 2.0, this.amberTrimMat);

    this.spawnHavokCrashCrates(crashX, 20.0);
  }

  spawnHavokCrashCrates(centerX = 32.0, centerZ = 20.0) {
    // Clear existing dynamic crates if resetting
    if (this.dynamicCrates && this.dynamicCrates.length > 0) {
      for (const item of this.dynamicCrates) {
        if (item.aggregate) {
          try { item.aggregate.dispose(); } catch (_) {}
        }
        if (item.visualMesh) {
          try { item.visualMesh.dispose(); } catch (_) {}
        }
        if (item.mesh) {
          try { item.mesh.dispose(); } catch (_) {}
        }
      }
      this.dynamicCrates = [];
    }
    this.cratesKnockedCount = 0;
    this.crateStackAwake = false;

    const crateSize = 0.88;
    const rows = [5, 4, 3, 2, 1];
    let crateIdx = 0;

    for (let r = 0; r < rows.length; r++) {
      const count = rows[r];
      // Exact flush stacking with zero vertical air gap so crates never drop or topple on scene load
      const y = (crateSize * 0.5) + r * crateSize;
      const startX = centerX - ((count - 1) * (crateSize + 0.04)) * 0.5;

      for (let c = 0; c < count; c++) {
        crateIdx++;
        const x = startX + c * (crateSize + 0.04);
        const z = centerZ;

        const mesh = MeshBuilder.CreateBox(`HavokCrate_${crateIdx}`, {
          width: crateSize,
          height: crateSize,
          depth: crateSize
        }, this.scene);
        mesh.position.set(x, y, z);
        mesh.rotationQuaternion = Quaternion.Identity();
        mesh.material = this.crateMat;
        mesh.receiveShadows = true;

        const crateEntry = {
          mesh,
          visualMesh: null,
          aggregate: null,
          spawnPos: new Vector3(x, y, z),
          knocked: false
        };

        if (this.PhysicsAggregate && this.PhysicsShapeType) {
          crateEntry.aggregate = new this.PhysicsAggregate(
            mesh,
            this.PhysicsShapeType.BOX,
            { mass: 12, friction: 0.65, restitution: 0.12 },
            this.scene
          );
          if (crateEntry.aggregate.body) {
            // Keep locked in ANIMATED state until impacted by van so boxes never fall down on load
            crateEntry.aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
            crateEntry.aggregate.body.setLinearVelocity(Vector3.Zero());
            crateEntry.aggregate.body.setAngularVelocity(Vector3.Zero());
          }
        }

        this.dynamicCrates.push(crateEntry);
      }
    }

    if (this.cardboardBoxTemplate) {
      this.attachCardboardVisualsToCrates();
    } else {
      this.loadCardboardBoxTemplate();
    }
  }

  initHavokPhysics(PhysicsAggregate, PhysicsShapeType) {
    this.PhysicsAggregate = PhysicsAggregate;
    this.PhysicsShapeType = PhysicsShapeType;

    if (this.ground && !this.groundAggregate) {
      this.ground.computeWorldMatrix(true);
      this.groundAggregate = new PhysicsAggregate(
        this.ground,
        PhysicsShapeType.BOX,
        { mass: 0, friction: 0.85, restitution: 0.0 },
        this.scene
      );
    }

    this.rebuildObstacleHavokPhysics();
  }

  rebuildObstacleHavokPhysics() {
    if (!this.PhysicsAggregate || !this.PhysicsShapeType) return;

    if (this.physicsAggregates && this.physicsAggregates.length > 0) {
      for (const agg of this.physicsAggregates) {
        try { agg.dispose(); } catch (_) {}
      }
      this.physicsAggregates = [];
    }

    for (const c of this.colliders) {
      if (!c.mesh) continue;
      c.mesh.computeWorldMatrix(true);
      if (c.type === 'ramp' || c.type === 'speedbump') {
        this.physicsAggregates.push(
          new this.PhysicsAggregate(c.mesh, this.PhysicsShapeType.MESH, { mass: 0, friction: 0.65, restitution: 0.0 }, this.scene)
        );
      } else if (c.type === 'cylinder') {
        this.physicsAggregates.push(
          new this.PhysicsAggregate(c.mesh, this.PhysicsShapeType.CYLINDER, { mass: 0, friction: 0.5, restitution: 0.2 }, this.scene)
        );
      }
    }

    // Attach Havok dynamic aggregates to any un-initialized dynamic crates
    for (const item of this.dynamicCrates) {
      if (!item.aggregate && item.mesh) {
        item.aggregate = new this.PhysicsAggregate(
          item.mesh,
          this.PhysicsShapeType.BOX,
          { mass: 12, friction: 0.65, restitution: 0.12 },
          this.scene
        );
        if (!this.crateStackAwake && item.aggregate.body) {
          item.aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
          item.aggregate.body.setLinearVelocity(Vector3.Zero());
          item.aggregate.body.setAngularVelocity(Vector3.Zero());
        }
      }
    }
  }

  getSurfaceElevation(x, z) {
    return 0.0;
  }

  update(dt, vehicle, audio) {
    if (!this.dynamicCrates || this.dynamicCrates.length === 0 || !vehicle) return;

    const vanX = vehicle.position.x;
    const vanY = vehicle.position.y;
    const vanZ = vehicle.position.z;
    const vanVx = vehicle.velocity.x;
    const vanVz = vehicle.velocity.z;
    const vanSpeed = Math.hypot(vanVx, vanVz);

    const cosH = Math.cos(vehicle.heading || 0);
    const sinH = Math.sin(vehicle.heading || 0);
    const halfW = (vehicle.halfCarWidth || 0.92);
    const halfL = (vehicle.length ? vehicle.length * 0.5 : 2.255);
    const crateRadius = 0.54; // Effective half-size + corner margin for 0.88m cardboard box

    // Helper: compute closest point on the van's oriented 2D footprint to (cx, cz)
    const testVanFootprint = (cx, cy, cz) => {
      const dy = cy - vanY;
      if (dy < -0.45 || dy > 2.25) return null;

      const dx = cx - vanX;
      const dz = cz - vanZ;
      // Transform crate center into van local space (lx = right, lz = forward)
      const lx = dx * cosH - dz * sinH;
      const lz = dx * sinH + dz * cosH;

      const clampedX = Math.max(-halfW, Math.min(halfW, lx));
      const clampedZ = Math.max(-halfL, Math.min(halfL, lz));
      const diffX = lx - clampedX;
      const diffZ = lz - clampedZ;
      const distSq = diffX * diffX + diffZ * diffZ;

      if (distSq >= crateRadius * crateRadius) return null;

      const dist = Math.sqrt(distSq);
      let nLocalX = 0;
      let nLocalZ = 0;
      let pen = 0;

      if (dist > 0.0001) {
        nLocalX = diffX / dist;
        nLocalZ = diffZ / dist;
        pen = crateRadius - dist;
      } else {
        // Crate center is inside the van OBB — push out along shallowest axis
        const penX = halfW - Math.abs(lx);
        const penZ = halfL - Math.abs(lz);
        if (penX < penZ) {
          nLocalX = lx >= 0 ? 1 : -1;
          nLocalZ = 0;
          pen = crateRadius + penX;
        } else {
          nLocalX = 0;
          nLocalZ = lz >= 0 ? 1 : -1;
          pen = crateRadius + penZ;
        }
      }

      // Convert local outward normal (pointing from van to crate) back to world space
      const nx = nLocalX * cosH + nLocalZ * sinH;
      const nz = -nLocalX * sinH + nLocalZ * cosH;
      return { nx, nz, pen };
    };

    // 1. Check if the van footprint contacts any crate in the resting stack (even at very slow speed!)
    if (!this.crateStackAwake) {
      for (const item of this.dynamicCrates) {
        if (!item.mesh) continue;
        const hit = testVanFootprint(item.mesh.position.x, item.mesh.position.y, item.mesh.position.z);
        if (hit) {
          this.crateStackAwake = true;
          for (const cItem of this.dynamicCrates) {
            if (cItem.aggregate && cItem.aggregate.body) {
              cItem.aggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
            }
          }
          break;
        }
      }
    }

    // While stack is undisturbed, strictly hold exact spawn pose so boxes never fall down on load
    if (!this.crateStackAwake) {
      for (const item of this.dynamicCrates) {
        if (item.mesh) {
          item.mesh.position.copyFrom(item.spawnPos);
        }
      }
      this.cratesKnockedCount = 0;
      return;
    }

    let knockedCount = 0;

    // 2. Resolve solid non-penetration & momentum transfer between van OBB and every crate
    for (const item of this.dynamicCrates) {
      const m = item.mesh;
      if (!m) continue;

      const hit = testVanFootprint(m.position.x, m.position.y, m.position.z);
      if (hit) {
        const { nx, nz, pen } = hit;

        // Strictly push the crate outside the van's OBB so the van can NEVER drive through a box at slow, medium, or fast speed!
        const pushOut = pen + 0.04;
        const newCrateX = m.position.x + nx * pushOut;
        const newCrateZ = m.position.z + nz * pushOut;
        const newCrateY = Math.max(0.44, m.position.y);
        m.position.set(newCrateX, newCrateY, newCrateZ);

        // Apply slight physical resistance to the van proportional to impact
        const vInward = vanVx * nx + vanVz * nz;
        if (vInward > 0) {
          const speedDrag = Math.min(0.18, 0.045 * (1.0 / (1.0 + vanSpeed * 0.12)));
          vehicle.velocity.x -= nx * vInward * speedDrag;
          vehicle.velocity.z -= nz * vInward * speedDrag;
        }

        const pushSpeed = Math.max(2.6, Math.max(vanSpeed, vInward) * 1.25 + 1.2);
        const liftSpeed = vanSpeed > 6.0 ? Math.min(6.5, 1.2 + vanSpeed * 0.22) : Math.min(1.6, 0.35 + vanSpeed * 0.12);

        if (item.aggregate && item.aggregate.body) {
          item.aggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
          item.aggregate.body.disablePreStep = false;
          item.aggregate.body.setLinearVelocity(new Vector3(
            vanVx * 0.65 + nx * pushSpeed,
            liftSpeed,
            vanVz * 0.65 + nz * pushSpeed
          ));
          item.aggregate.body.setAngularVelocity(new Vector3(
            -nz * pushSpeed * 0.85 + (Math.random() - 0.5) * 3.5,
            (Math.random() - 0.5) * 3.5,
            nx * pushSpeed * 0.85 + (Math.random() - 0.5) * 3.5
          ));
        }

        if (audio && audio.playBoxThud) {
          audio.playBoxThud(Math.max(1.5, vanSpeed));
        }

        item.knocked = true;
      }

      const movedDist = Vector3.Distance(m.position, item.spawnPos);
      if (movedDist > 0.18 || item.knocked) {
        item.knocked = true;
        knockedCount++;
      }
    }

    this.cratesKnockedCount = knockedCount;
  }

  resetCones() {
    if (this.currentLevel === 'proving_ground') {
      this.spawnHavokCrashCrates(32.0, 20.0);
    }
  }
}
