/**
 * AvatarController: Controls the 3D Avatar (VRM or procedural humanoid fallback),
 * including bone animations, expressions, speech visemes, and gaze.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMHumanBoneName } from '@pixiv/three-vrm';

export interface AvatarControllerOptions {
  scene: THREE.Scene;
  onModelLoaded?: (modelName: string) => void;
  onError?: (error: string) => void;
}

export class AvatarController {
  private scene: THREE.Scene;
  private currentVRM: VRM | null = null;
  private fallbackGroup: THREE.Group | null = null;
  private avatarRoot: THREE.Group;

  // Fallback humanoid parts
  private fallbackBones: {
    hips?: THREE.Group;
    spine?: THREE.Group;
    chest?: THREE.Group;
    neck?: THREE.Group;
    head?: THREE.Group;
    leftArm?: THREE.Group;
    leftForearm?: THREE.Group;
    rightArm?: THREE.Group;
    rightForearm?: THREE.Group;
    leftLeg?: THREE.Group;
    leftCalf?: THREE.Group;
    rightLeg?: THREE.Group;
    rightCalf?: THREE.Group;
    jaw?: THREE.Mesh;
    eyes?: THREE.Mesh[];
  } = {};

  // Animation State
  private currentAnimation = 'idle';
  private animationTime = 0;
  private currentExpression = 'neutral';
  private expressionIntensity = 1.0;
  private isSpeaking = false;
  private speechMouthOpen = 0;

  // LookAt target
  private lookAtTarget: THREE.Vector3 | null = null;
  private currentLookTarget: THREE.Vector3 = new THREE.Vector3(0, 1.4, 3);
  private lookDamping = 5.0;

  // Callbacks
  private onModelLoaded?: (modelName: string) => void;
  private onError?: (error: string) => void;

  constructor(options: AvatarControllerOptions) {
    this.scene = options.scene;
    this.onModelLoaded = options.onModelLoaded;
    this.onError = options.onError;

    this.avatarRoot = new THREE.Group();
    this.avatarRoot.name = 'AvatarRoot';
    this.scene.add(this.avatarRoot);

    // Build the default procedural humanoid mannequin
    this.buildFallbackHumanoid();
  }

  public getRoot(): THREE.Group {
    return this.avatarRoot;
  }

  public getPosition(): THREE.Vector3 {
    return this.avatarRoot.position;
  }

  public setPosition(x: number, y: number, z: number): void {
    this.avatarRoot.position.set(x, y, z);
  }

  public getRotationY(): number {
    return this.avatarRoot.rotation.y;
  }

  public setRotationY(rad: number): void {
    this.avatarRoot.rotation.y = rad;
  }

  public setAnimation(name: string): void {
    if (this.currentAnimation !== name) {
      this.currentAnimation = name;
      this.animationTime = 0;
    }
  }

  public getAnimation(): string {
    return this.currentAnimation;
  }

  public setExpression(name: string, intensity = 1.0): void {
    this.currentExpression = name.toLowerCase();
    this.expressionIntensity = Math.max(0, Math.min(1, intensity));

    if (this.currentVRM?.expressionManager) {
      // Clear previous expressions except neutral
      const standardExpressions = ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral', 'blink'];
      for (const expr of standardExpressions) {
        try {
          this.currentVRM.expressionManager.setValue(expr, 0);
        } catch {
          // ignore unsupported expression
        }
      }

      try {
        this.currentVRM.expressionManager.setValue(this.currentExpression, this.expressionIntensity);
      } catch {
        console.warn(`VRM expression '${this.currentExpression}' not supported by model.`);
      }
    }

    // Update fallback eye/glow color based on expression
    if (this.fallbackBones.eyes) {
      let color = 0x38bdf8; // Sky blue default
      if (this.currentExpression === 'happy') color = 0x34d399; // Green
      else if (this.currentExpression === 'angry') color = 0xf87171; // Red
      else if (this.currentExpression === 'sad') color = 0x818cf8; // Indigo
      else if (this.currentExpression === 'surprised') color = 0xfbbf24; // Amber

      for (const eye of this.fallbackBones.eyes) {
        if (eye.material instanceof THREE.MeshStandardMaterial) {
          eye.material.color.setHex(color);
          eye.material.emissive.setHex(color);
        }
      }
    }
  }

  public setSpeaking(speaking: boolean): void {
    this.isSpeaking = speaking;
    if (!speaking) {
      this.speechMouthOpen = 0;
      if (this.currentVRM?.expressionManager) {
        try {
          this.currentVRM.expressionManager.setValue('aa', 0);
          this.currentVRM.expressionManager.setValue('ih', 0);
          this.currentVRM.expressionManager.setValue('ou', 0);
        } catch {
          // ignore
        }
      }
    }
  }

  public setLookAt(target: { x: number; y: number; z: number } | null): void {
    if (target) {
      this.lookAtTarget = new THREE.Vector3(target.x, target.y ?? 1.4, target.z);
    } else {
      this.lookAtTarget = null;
    }
  }

  /**
   * Load a VRM file from URL or File/Blob URL
   */
  public async loadVRM(url: string, fileName = 'Avatar.vrm'): Promise<void> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    try {
      const gltf = await loader.loadAsync(url);
      const vrm = gltf.userData.vrm as VRM;

      if (!vrm) {
        throw new Error('Arquivo não contém dados VRM válidos.');
      }

      // Remove fallback humanoid
      if (this.fallbackGroup) {
        this.avatarRoot.remove(this.fallbackGroup);
        this.fallbackGroup = null;
      }

      // Remove previous VRM
      if (this.currentVRM) {
        this.avatarRoot.remove(this.currentVRM.scene);
        this.currentVRM = null;
      }

      this.currentVRM = vrm;
      this.avatarRoot.add(vrm.scene);

      // Rotate model 180 deg to face forward if needed in standard VRM coordinate system
      vrm.scene.rotation.y = Math.PI;

      // Enable shadows
      vrm.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      this.setExpression(this.currentExpression, this.expressionIntensity);

      if (this.onModelLoaded) {
        this.onModelLoaded(fileName);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Erro ao carregar VRM:', errorMsg);
      if (this.onError) {
        this.onError(`Falha ao carregar VRM: ${errorMsg}`);
      }
      // Keep fallback humanoid active
      if (!this.fallbackGroup) {
        this.buildFallbackHumanoid();
      }
    }
  }

  /**
   * Reset to the default procedural humanoid mannequin
   */
  public loadDefaultMannequin(): void {
    if (this.currentVRM) {
      this.avatarRoot.remove(this.currentVRM.scene);
      this.currentVRM = null;
    }
    if (!this.fallbackGroup) {
      this.buildFallbackHumanoid();
    }
  }

  /**
   * Build an articulated procedural humanoid mannequin
   */
  private buildFallbackHumanoid(): void {
    if (this.fallbackGroup) {
      this.avatarRoot.remove(this.fallbackGroup);
    }

    const group = new THREE.Group();
    group.name = 'FallbackHumanoid';

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // slate-700
      roughness: 0.4,
      metalness: 0.2,
    });
    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // sky-600
      roughness: 0.2,
      metalness: 0.8,
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      roughness: 0.1,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x64748b, // slate-500
      roughness: 0.3,
    });

    const createJoint = () => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), jointMat);
      mesh.castShadow = true;
      return mesh;
    };

    // 1. Hips / Root
    const hips = new THREE.Group();
    hips.position.y = 0.95;
    group.add(hips);

    const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.14, 16), accentMat);
    pelvis.castShadow = true;
    hips.add(pelvis);

    // 2. Spine / Torso
    const spine = new THREE.Group();
    spine.position.y = 0.12;
    hips.add(spine);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.18), bodyMat);
    chest.position.y = 0.18;
    chest.castShadow = true;
    spine.add(chest);

    // 3. Neck & Head
    const neck = new THREE.Group();
    neck.position.y = 0.38;
    spine.add(neck);

    const head = new THREE.Group();
    head.position.y = 0.12;
    neck.add(head);

    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.22), bodyMat);
    headMesh.position.y = 0.08;
    headMesh.castShadow = true;
    head.add(headMesh);

    // Visor / Face
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.04), visorMat);
    visor.position.set(0, 0.09, 0.11);
    head.add(visor);

    // Mouth / Jaw
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.03), jointMat);
    jaw.position.set(0, 0.0, 0.11);
    head.add(jaw);

    // 4. Arms (Left & Right)
    // Left Arm
    const leftShoulderJoint = createJoint();
    leftShoulderJoint.position.set(0.2, 0.3, 0);
    spine.add(leftShoulderJoint);

    const leftArm = new THREE.Group();
    leftShoulderJoint.add(leftArm);
    const leftUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.24, 12), bodyMat);
    leftUpperArm.position.y = -0.12;
    leftUpperArm.castShadow = true;
    leftArm.add(leftUpperArm);

    const leftElbowJoint = createJoint();
    leftElbowJoint.position.y = -0.24;
    leftArm.add(leftElbowJoint);

    const leftForearm = new THREE.Group();
    leftElbowJoint.add(leftForearm);
    const leftLowerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.22, 12), bodyMat);
    leftLowerArm.position.y = -0.11;
    leftLowerArm.castShadow = true;
    leftForearm.add(leftLowerArm);

    const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), accentMat);
    leftHand.position.y = -0.23;
    leftHand.castShadow = true;
    leftForearm.add(leftHand);

    // Right Arm
    const rightShoulderJoint = createJoint();
    rightShoulderJoint.position.set(-0.2, 0.3, 0);
    spine.add(rightShoulderJoint);

    const rightArm = new THREE.Group();
    rightShoulderJoint.add(rightArm);
    const rightUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.24, 12), bodyMat);
    rightUpperArm.position.y = -0.12;
    rightUpperArm.castShadow = true;
    rightArm.add(rightUpperArm);

    const rightElbowJoint = createJoint();
    rightElbowJoint.position.y = -0.24;
    rightArm.add(rightElbowJoint);

    const rightForearm = new THREE.Group();
    rightElbowJoint.add(rightForearm);
    const rightLowerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.22, 12), bodyMat);
    rightLowerArm.position.y = -0.11;
    rightLowerArm.castShadow = true;
    rightForearm.add(rightLowerArm);

    const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), accentMat);
    rightHand.position.y = -0.23;
    rightHand.castShadow = true;
    rightForearm.add(rightHand);

    // 5. Legs (Left & Right)
    // Left Leg
    const leftHipJoint = createJoint();
    leftHipJoint.position.set(0.1, -0.06, 0);
    hips.add(leftHipJoint);

    const leftLeg = new THREE.Group();
    leftHipJoint.add(leftLeg);
    const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.38, 12), bodyMat);
    leftThigh.position.y = -0.19;
    leftThigh.castShadow = true;
    leftLeg.add(leftThigh);

    const leftKneeJoint = createJoint();
    leftKneeJoint.position.y = -0.38;
    leftLeg.add(leftKneeJoint);

    const leftCalf = new THREE.Group();
    leftKneeJoint.add(leftCalf);
    const leftShin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.38, 12), bodyMat);
    leftShin.position.y = -0.19;
    leftShin.castShadow = true;
    leftCalf.add(leftShin);

    const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.16), accentMat);
    leftFoot.position.set(0, -0.38, 0.04);
    leftFoot.castShadow = true;
    leftCalf.add(leftFoot);

    // Right Leg
    const rightHipJoint = createJoint();
    rightHipJoint.position.set(-0.1, -0.06, 0);
    hips.add(rightHipJoint);

    const rightLeg = new THREE.Group();
    rightHipJoint.add(rightLeg);
    const rightThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.38, 12), bodyMat);
    rightThigh.position.y = -0.19;
    rightThigh.castShadow = true;
    rightLeg.add(rightThigh);

    const rightKneeJoint = createJoint();
    rightKneeJoint.position.y = -0.38;
    rightLeg.add(rightKneeJoint);

    const rightCalf = new THREE.Group();
    rightKneeJoint.add(rightCalf);
    const rightShin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.38, 12), bodyMat);
    rightShin.position.y = -0.19;
    rightShin.castShadow = true;
    rightCalf.add(rightShin);

    const rightFoot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.16), accentMat);
    rightFoot.position.set(0, -0.38, 0.04);
    rightFoot.castShadow = true;
    rightCalf.add(rightFoot);

    this.fallbackBones = {
      hips,
      spine,
      neck,
      head,
      leftArm,
      leftForearm,
      rightArm,
      rightForearm,
      leftLeg,
      leftCalf,
      rightLeg,
      rightCalf,
      jaw,
      eyes: [visor],
    };

    this.fallbackGroup = group;
    this.avatarRoot.add(group);
  }

  /**
   * Main per-frame update loop
   */
  public update(delta: number): void {
    this.animationTime += delta;

    // 1. Update VRM internal components if loaded
    if (this.currentVRM) {
      this.currentVRM.update(delta);
    }

    // 2. Speech Viseme / Mouth Flap
    if (this.isSpeaking) {
      const flap = (Math.sin(this.animationTime * 14) + 1) * 0.5 * (Math.sin(this.animationTime * 7) > 0 ? 0.8 : 0.4);
      this.speechMouthOpen = flap;

      if (this.currentVRM?.expressionManager) {
        try {
          this.currentVRM.expressionManager.setValue('aa', flap);
        } catch {
          // ignore
        }
      }

      if (this.fallbackBones.jaw) {
        this.fallbackBones.jaw.position.y = -0.01 - flap * 0.025;
      }
    } else {
      if (this.fallbackBones.jaw) {
        this.fallbackBones.jaw.position.y = 0;
      }
    }

    // 3. Apply skeletal animations (idle / walk / wave / talk)
    if (this.currentVRM?.humanoid) {
      this.animateVRMBones(this.currentVRM, delta);
    } else if (this.fallbackGroup) {
      this.animateFallbackBones(delta);
    }
  }

  /**
   * Procedural animation applied to VRM humanoid bones
   */
  private animateVRMBones(vrm: VRM, delta: number): void {
    const t = this.animationTime;
    const humanoid = vrm.humanoid;

    const leftUpperArm = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm);
    const rightUpperArm = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
    const leftLowerArm = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftLowerArm);
    const rightLowerArm = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightLowerArm);
    const leftUpperLeg = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperLeg);
    const rightUpperLeg = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperLeg);
    const leftLowerLeg = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftLowerLeg);
    const rightLowerLeg = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightLowerLeg);
    const spine = humanoid.getNormalizedBoneNode(VRMHumanBoneName.Spine);
    const head = humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head);
    const hips = humanoid.getNormalizedBoneNode(VRMHumanBoneName.Hips);

    if (this.currentAnimation === 'walk') {
      const walkFreq = 7.0;
      const legAngle = Math.sin(t * walkFreq) * 0.45;
      const armAngle = Math.sin(t * walkFreq) * 0.4;

      if (leftUpperLeg) leftUpperLeg.rotation.x = legAngle;
      if (rightUpperLeg) rightUpperLeg.rotation.x = -legAngle;

      if (leftLowerLeg) leftLowerLeg.rotation.x = Math.max(0, -legAngle * 0.8);
      if (rightLowerLeg) rightLowerLeg.rotation.x = Math.max(0, legAngle * 0.8);

      if (leftUpperArm) {
        leftUpperArm.rotation.x = -armAngle;
        leftUpperArm.rotation.z = 1.1; // natural resting out
      }
      if (rightUpperArm) {
        rightUpperArm.rotation.x = armAngle;
        rightUpperArm.rotation.z = -1.1;
      }

      if (hips) {
        hips.position.y = Math.abs(Math.sin(t * walkFreq)) * 0.04;
      }
      if (spine) {
        spine.rotation.y = Math.sin(t * walkFreq) * 0.08;
      }
    } else if (this.currentAnimation === 'wave') {
      // Resting left side
      if (leftUpperArm) {
        leftUpperArm.rotation.set(0, 0, 1.2);
      }
      if (leftUpperLeg) leftUpperLeg.rotation.set(0, 0, 0);
      if (rightUpperLeg) rightUpperLeg.rotation.set(0, 0, 0);

      // Right arm raised waving
      if (rightUpperArm) {
        rightUpperArm.rotation.set(0, 0, -2.4);
      }
      if (rightLowerArm) {
        const waveAngle = Math.sin(t * 8.0) * 0.45;
        rightLowerArm.rotation.set(0, waveAngle, -0.6);
      }
      if (head) {
        head.rotation.z = Math.sin(t * 4.0) * 0.05;
      }
    } else if (this.currentAnimation === 'talk') {
      // Talking posture: gentle gesture
      if (leftUpperArm) leftUpperArm.rotation.set(0.2, 0, 1.1);
      if (rightUpperArm) {
        rightUpperArm.rotation.set(0.4 + Math.sin(t * 3.0) * 0.15, 0, -1.0);
      }
      if (rightLowerArm) {
        rightLowerArm.rotation.set(0.6 + Math.cos(t * 3.0) * 0.2, 0, 0);
      }
      if (head) {
        head.rotation.x = Math.sin(t * 4.0) * 0.08;
        head.rotation.y = Math.cos(t * 2.0) * 0.06;
      }
      if (leftUpperLeg) leftUpperLeg.rotation.set(0, 0, 0);
      if (rightUpperLeg) rightUpperLeg.rotation.set(0, 0, 0);
    } else {
      // Idle Animation: gentle breathing
      const breath = Math.sin(t * 2.0);
      if (spine) spine.rotation.x = breath * 0.02;
      if (leftUpperArm) {
        leftUpperArm.rotation.set(breath * 0.02, 0, 1.25 + breath * 0.02);
      }
      if (rightUpperArm) {
        rightUpperArm.rotation.set(breath * 0.02, 0, -1.25 - breath * 0.02);
      }
      if (leftLowerArm) leftLowerArm.rotation.set(0, 0, 0);
      if (rightLowerArm) rightLowerArm.rotation.set(0, 0, 0);
      if (leftUpperLeg) leftUpperLeg.rotation.set(0, 0, 0);
      if (rightUpperLeg) rightUpperLeg.rotation.set(0, 0, 0);
      if (leftLowerLeg) leftLowerLeg.rotation.set(0, 0, 0);
      if (rightLowerLeg) rightLowerLeg.rotation.set(0, 0, 0);
    }

    // LookAt orientation
    if (this.lookAtTarget && head) {
      const localTarget = this.lookAtTarget.clone();
      this.avatarRoot.worldToLocal(localTarget);
      const angleY = Math.atan2(localTarget.x, localTarget.z);
      const angleX = -Math.atan2(localTarget.y - 1.4, Math.sqrt(localTarget.x * localTarget.x + localTarget.z * localTarget.z));
      head.rotation.y = THREE.MathUtils.clamp(angleY, -Math.PI / 3, Math.PI / 3);
      head.rotation.x = THREE.MathUtils.clamp(angleX, -Math.PI / 4, Math.PI / 4);
    }
  }

  /**
   * Procedural animation applied to Fallback Humanoid
   */
  private animateFallbackBones(delta: number): void {
    const t = this.animationTime;
    const bones = this.fallbackBones;

    if (this.currentAnimation === 'walk') {
      const walkFreq = 7.0;
      const legAngle = Math.sin(t * walkFreq) * 0.5;
      const armAngle = Math.sin(t * walkFreq) * 0.45;

      if (bones.leftLeg) bones.leftLeg.rotation.x = legAngle;
      if (bones.rightLeg) bones.rightLeg.rotation.x = -legAngle;

      if (bones.leftCalf) bones.leftCalf.rotation.x = Math.max(0, -legAngle * 0.7);
      if (bones.rightCalf) bones.rightCalf.rotation.x = Math.max(0, legAngle * 0.7);

      if (bones.leftArm) bones.leftArm.rotation.x = -armAngle;
      if (bones.rightArm) bones.rightArm.rotation.x = armAngle;

      if (bones.hips) {
        bones.hips.position.y = 0.95 + Math.abs(Math.sin(t * walkFreq)) * 0.04;
      }
      if (bones.spine) {
        bones.spine.rotation.y = Math.sin(t * walkFreq) * 0.08;
      }
    } else if (this.currentAnimation === 'wave') {
      // Left arm idle
      if (bones.leftArm) bones.leftArm.rotation.set(0, 0, 0.1);
      if (bones.leftForearm) bones.leftForearm.rotation.set(0, 0, 0);

      // Right arm raised waving
      if (bones.rightArm) bones.rightArm.rotation.set(0, 0, -2.4);
      if (bones.rightForearm) {
        bones.rightForearm.rotation.set(0, Math.sin(t * 8.0) * 0.45, -0.6);
      }

      if (bones.leftLeg) bones.leftLeg.rotation.set(0, 0, 0);
      if (bones.rightLeg) bones.rightLeg.rotation.set(0, 0, 0);
      if (bones.leftCalf) bones.leftCalf.rotation.set(0, 0, 0);
      if (bones.rightCalf) bones.rightCalf.rotation.set(0, 0, 0);
      if (bones.hips) bones.hips.position.y = 0.95;
    } else if (this.currentAnimation === 'talk') {
      if (bones.leftArm) bones.leftArm.rotation.set(0.1, 0, 0.1);
      if (bones.rightArm) {
        bones.rightArm.rotation.set(0.3 + Math.sin(t * 3.0) * 0.15, 0, -0.2);
      }
      if (bones.rightForearm) {
        bones.rightForearm.rotation.set(-0.5 + Math.cos(t * 3.0) * 0.2, 0, 0);
      }
      if (bones.head) {
        bones.head.rotation.x = Math.sin(t * 4.0) * 0.08;
        bones.head.rotation.y = Math.cos(t * 2.0) * 0.06;
      }
      if (bones.leftLeg) bones.leftLeg.rotation.set(0, 0, 0);
      if (bones.rightLeg) bones.rightLeg.rotation.set(0, 0, 0);
      if (bones.hips) bones.hips.position.y = 0.95;
    } else {
      // Idle Animation: gentle breathing and arm sway
      const breath = Math.sin(t * 2.0);
      if (bones.spine) bones.spine.rotation.x = breath * 0.025;
      if (bones.leftArm) bones.leftArm.rotation.set(breath * 0.02, 0, 0.08 + breath * 0.02);
      if (bones.rightArm) bones.rightArm.rotation.set(breath * 0.02, 0, -0.08 - breath * 0.02);
      if (bones.leftForearm) bones.leftForearm.rotation.set(0, 0, 0);
      if (bones.rightForearm) bones.rightForearm.rotation.set(0, 0, 0);
      if (bones.leftLeg) bones.leftLeg.rotation.set(0, 0, 0);
      if (bones.rightLeg) bones.rightLeg.rotation.set(0, 0, 0);
      if (bones.leftCalf) bones.leftCalf.rotation.set(0, 0, 0);
      if (bones.rightCalf) bones.rightCalf.rotation.set(0, 0, 0);
      if (bones.hips) bones.hips.position.y = 0.95;
    }

    // LookAt
    if (this.lookAtTarget && bones.head) {
      const localTarget = this.lookAtTarget.clone();
      this.avatarRoot.worldToLocal(localTarget);
      const angleY = Math.atan2(localTarget.x, localTarget.z);
      const angleX = -Math.atan2(localTarget.y - 1.4, Math.sqrt(localTarget.x * localTarget.x + localTarget.z * localTarget.z));
      bones.head.rotation.y = THREE.MathUtils.clamp(angleY, -Math.PI / 3, Math.PI / 3);
      bones.head.rotation.x = THREE.MathUtils.clamp(angleX, -Math.PI / 4, Math.PI / 4);
    }
  }

  public dispose(): void {
    if (this.currentVRM) {
      this.avatarRoot.remove(this.currentVRM.scene);
      this.currentVRM = null;
    }
    if (this.fallbackGroup) {
      this.avatarRoot.remove(this.fallbackGroup);
      this.fallbackGroup = null;
    }
    this.scene.remove(this.avatarRoot);
  }
}
