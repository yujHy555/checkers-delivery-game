import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class CustomModelLoader {
  constructor(scene, characterEntity, vanEntity) {
    this.scene = scene;
    this.characterEntity = characterEntity;
    this.vanEntity = vanEntity;
    this.loader = new GLTFLoader();

    this.mixer = null;
    this.customCharacterModel = null;
    this.customAnimations = {};

    this.setupDropZone();
  }

  setupDropZone() {
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      document.body.classList.add('drag-active');
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      document.body.classList.remove('drag-active');
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      document.body.classList.remove('drag-active');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.loadFile(e.dataTransfer.files[0]);
      }
    });

    const fileInput = document.getElementById('glb-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.loadFile(e.target.files[0]);
        }
      });
    }
  }

  loadFile(file) {
    const filename = file.name.toLowerCase();
    if (!filename.endsWith('.glb') && !filename.endsWith('.gltf')) {
      alert('Please upload a valid .glb or .gltf 3D model exported from Blender!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const contents = e.target.result;
      this.loader.parse(contents, '', (gltf) => {
        this.handleLoadedGltf(gltf, filename);
      }, (err) => {
        console.error('Error parsing GLTF file:', err);
        alert('Could not parse 3D model. Check console for details.');
      });
    };
    reader.readAsArrayBuffer(file);
  }

  handleLoadedGltf(gltf, filename) {
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Detect if this is a Character (Mixamo armature / SkinnedMesh) or a Vehicle
    const hasBones = Boolean(model.getObjectByProperty('isBone', true));
    const isCharacter = hasBones || filename.includes('character') || filename.includes('driver') || filename.includes('mixamo');

    if (isCharacter) {
      console.log('✅ Loaded Custom Mixamo Character Model:', model);
      if (this.customCharacterModel) {
        this.characterEntity.root.remove(this.customCharacterModel);
      }

      // Hide procedural character body parts
      this.characterEntity.hips.visible = false;

      // Add custom rigged character
      this.customCharacterModel = model;
      this.characterEntity.root.add(model);

      // Handle Mixamo animations if present in glb
      if (gltf.animations && gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => {
          this.customAnimations[clip.name.toLowerCase()] = this.mixer.clipAction(clip);
        });
        // Play first clip (usually idle or walk)
        const firstAction = this.mixer.clipAction(gltf.animations[0]);
        firstAction.play();
      }

      this.showToast(`Custom Character Loaded: "${filename}"`);
    } else {
      console.log('✅ Loaded Custom Vehicle Model:', model);
      // Replace van mesh
      this.vanEntity.chassisGroup.visible = false;
      this.vanEntity.root.add(model);
      this.showToast(`Custom Van Model Loaded: "${filename}"`);
    }
  }

  showToast(msg) {
    const toast = document.getElementById('toast-msg');
    if (toast) {
      toast.innerText = msg;
      toast.classList.add('visible');
      setTimeout(() => toast.classList.remove('visible'), 4000);
    }
  }

  update(dt) {
    if (this.mixer) {
      this.mixer.update(dt);
    }
  }
}
