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
  private vrmHipsInitialPosition: THREE.Vector3 | null = null;

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

  // Mode state: 'awake' | 'sleep' | 'dream'
  private currentMode = 'awake';
  private dreamParticles: THREE.Points | null = null;

  // Lip-Sync & Viseme State
  private activeVisemes: Array<{ time: number; shape: string; weight: number }> = [];
  private audioPlaybackStartTime = 0;
  private audioPlaybackDuration = 0;
  private audioAmplitude = 0; // 0.0 to 1.0 real-time audio volume

  // LookAt target
  private lookAtTarget: THREE.Vector3 | null = null;
  private currentLookTarget: THREE.Vector3 = new THREE.Vector3(0, 1.4, 3);
  private lookDamping = 5.0;

  // Biomechanical Damped Spring Interpolation Engine
  private smoothBoneRotations: Map<string, THREE.Euler> = new Map();
  private smoothBonePositions: Map<string, THREE.Vector3> = new Map();

  // Touch / Haptic sensory feedback ripples
  private activeRipples: Array<{ mesh: THREE.Mesh; startTime: number; lifetime: number }> = [];
  private touchRecoveryTimeout: any = null;

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

    // Create ethereal dream halo / particle system
    this.createDreamAura();
  }

  /**
   * Ethereal particle aura for dream state
   */
  private createDreamAura(): void {
    const count = 75;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.35 + Math.random() * 0.75;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 0.2 + Math.random() * 1.6;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      // Soft purple / cyan ethereal dream palette
      const isCyan = Math.random() > 0.5;
      colors[i * 3] = isCyan ? 0.2 : 0.75;
      colors[i * 3 + 1] = isCyan ? 0.9 : 0.35;
      colors[i * 3 + 2] = 1.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    this.dreamParticles = new THREE.Points(geometry, material);
    this.dreamParticles.name = 'DreamAura';
    this.dreamParticles.visible = false;
    this.avatarRoot.add(this.dreamParticles);
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
      this.activeVisemes = [];
      this.audioAmplitude = 0;
      if (this.currentVRM?.expressionManager) {
        const vowels = ['aa', 'ih', 'ou', 'ee', 'oh'];
        for (const v of vowels) {
          try {
            this.currentVRM.expressionManager.setValue(v, 0);
          } catch {
            // ignore
          }
        }
      }
      if (this.fallbackBones.jaw) {
        this.fallbackBones.jaw.position.y = 0;
      }
    }
  }

  public startLipSyncAudio(duration: number, visemes?: Array<{ time: number; shape: string; weight: number }>): void {
    this.isSpeaking = true;
    this.audioPlaybackDuration = duration;
    this.audioPlaybackStartTime = performance.now() / 1000;
    this.activeVisemes = visemes ? [...visemes].sort((a, b) => a.time - b.time) : [];
  }

  public stopLipSyncAudio(): void {
    this.setSpeaking(false);
  }

  public setAudioAmplitude(amplitude: number): void {
    this.audioAmplitude = Math.max(0, Math.min(1, amplitude));
  }

  public setLookAt(target: { x: number; y: number; z: number } | null): void {
    if (target) {
      this.lookAtTarget = new THREE.Vector3(target.x, target.y ?? 1.4, target.z);
    } else {
      this.lookAtTarget = null;
    }
  }

  public setMode(mode: 'awake' | 'sleep' | 'dream' | string): void {
    this.currentMode = mode.toLowerCase();
    if (this.currentMode === 'sleep') {
      if (this.dreamParticles) this.dreamParticles.visible = false;
      this.setExpression('blink', 1.0);
      this.setAnimation('sleep');
    } else if (this.currentMode === 'dream') {
      if (this.dreamParticles) this.dreamParticles.visible = true;
      this.setExpression('relaxed', 0.8);
      this.setAnimation('dream');
    } else {
      // awake
      if (this.dreamParticles) this.dreamParticles.visible = false;
      if (this.currentAnimation === 'sleep' || this.currentAnimation === 'dream') {
        this.setAnimation('idle');
      }
      this.setExpression(this.currentExpression, this.expressionIntensity);
    }
  }

  public getMode(): string {
    return this.currentMode;
  }

  /**
   * Generates synthesized acoustic sensory feedback tone for physical touch
   */
  private playTouchSound(type: 'head' | 'chest' | 'arm' | 'hand' | 'leg'): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'head') {
        // Soft cute high-pitch chime (sparkle / petting)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'chest') {
        // Warm heartbeat pulse
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.2);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'arm' || type === 'hand') {
        // Cheerful harmonic high-five chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else {
        // Playful tickle blip
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch {}
  }

  /**
   * Spawns a glowing Cyber-Haptic 3D particle ring at the touched point
   */
  private spawnTouchRipple(point: THREE.Vector3, part: string): void {
    const color =
      part === 'head'
        ? 0x38bdf8
        : part === 'chest'
        ? 0xf43f5e
        : part === 'arm' || part === 'hand'
        ? 0x10b981
        : 0xa855f7;

    const ringGeo = new THREE.RingGeometry(0.03, 0.05, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(point);
    ring.lookAt(point.x, point.y, point.z + 1);
    this.scene.add(ring);

    this.activeRipples.push({
      mesh: ring,
      startTime: performance.now(),
      lifetime: 550,
    });
  }

  /**
   * Interactive Touch / Haptic Sensation Handler
   * Triggers physical and emotional reaction when any part of the body is touched on screen
   */
  public handleTouch(
    part: 'head' | 'chest' | 'arm' | 'hand' | 'leg',
    worldPoint?: THREE.Vector3,
    onReactionText?: (text: string) => void
  ): void {
    // 1. Native Device Haptic Vibration (Smartphone / Tablet Touchscreen)
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        if (part === 'head') navigator.vibrate([25, 20, 35]);
        else if (part === 'chest') navigator.vibrate([40, 30, 40]);
        else navigator.vibrate(30);
      }
    } catch {}

    // 2. Play acoustic sensory feedback chime
    this.playTouchSound(part);

    // 3. Spawn Cyber-Haptic Visual Particle Ring
    if (worldPoint) {
      this.spawnTouchRipple(worldPoint, part);
    }

    // 4. Physical / Emotional Sensation Reaction
    if (this.touchRecoveryTimeout) {
      clearTimeout(this.touchRecoveryTimeout);
      this.touchRecoveryTimeout = null;
    }

    if (part === 'head') {
      this.setExpression('happy', 1.0);
      this.setAnimation('nod');
      this.setLookAt({ x: 0, y: 1.5, z: 2.5 });
      onReactionText?.('✨ Sentiu o carinho na cabeça... (Adorou!)');
    } else if (part === 'chest') {
      this.setExpression('surprised', 0.85);
      this.setAnimation('talk');
      this.setLookAt({ x: 0, y: 1.4, z: 2.5 });
      onReactionText?.('💖 Sentiu o toque no peito! (Coração acelerou)');
    } else if (part === 'arm' || part === 'hand') {
      this.setExpression('happy', 0.9);
      this.setAnimation('wave');
      this.setLookAt({ x: 0, y: 1.4, z: 2.5 });
      onReactionText?.('👋 Sentiu o toque no braço/mão! (Acena de volta)');
    } else {
      this.setExpression('happy', 1.0);
      this.setAnimation('cheer');
      this.setLookAt({ x: 0, y: 1.2, z: 2.5 });
      onReactionText?.('⚡ Sentiu o toque na perna! (Cócegas)');
    }

    // Smoothly return to natural idle breathing after 3 seconds
    this.touchRecoveryTimeout = setTimeout(() => {
      this.setAnimation('idle');
      this.setExpression('neutral', 0.4);
      this.setLookAt({ x: 0, y: 1.4, z: 2.8 });
    }, 3000);
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

      this.vrmHipsInitialPosition = null;
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
    this.vrmHipsInitialPosition = null;
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

    // 2. Speech Viseme / Mouth Flap / Lip-Sync
    if (this.isSpeaking) {
      if (this.activeVisemes.length > 0) {
        const currentTime = performance.now() / 1000 - this.audioPlaybackStartTime;
        const weights: Record<string, number> = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
        const windowSize = 0.12;

        for (let i = 0; i < this.activeVisemes.length; i++) {
          const v = this.activeVisemes[i];
          const diff = Math.abs(currentTime - v.time);
          if (diff < windowSize) {
            const factor = Math.max(0, 1 - diff / windowSize);
            const shape = v.shape.toLowerCase();
            const w = Math.min(1.0, v.weight * factor);
            weights[shape] = Math.max(weights[shape] || 0, w);
          }
        }

        // Add real-time audio amplitude if available
        if (this.audioAmplitude > 0.04) {
          weights['aa'] = Math.max(weights['aa'] || 0, this.audioAmplitude * 0.8);
        }

        let maxWeight = 0;
        if (this.currentVRM?.expressionManager) {
          for (const [shape, weight] of Object.entries(weights)) {
            try {
              this.currentVRM.expressionManager.setValue(shape, weight);
              if (weight > maxWeight) maxWeight = weight;
            } catch {
              // ignore unsupported viseme
            }
          }
        }

        this.speechMouthOpen = maxWeight;
        if (this.fallbackBones.jaw) {
          this.fallbackBones.jaw.position.y = -0.01 - maxWeight * 0.03;
        }
      } else {
        // Procedural speech flap boosted by audio amplitude
        const sineFlap =
          (Math.sin(this.animationTime * 14) + 1) *
          0.5 *
          (Math.sin(this.animationTime * 7) > 0 ? 0.8 : 0.4);
        const flap = this.audioAmplitude > 0.02
          ? Math.max(sineFlap * 0.5, this.audioAmplitude * 1.1)
          : sineFlap;

        this.speechMouthOpen = flap;

        if (this.currentVRM?.expressionManager) {
          try {
            this.currentVRM.expressionManager.setValue('aa', Math.min(1, flap));
          } catch {
            // ignore
          }
        }

        if (this.fallbackBones.jaw) {
          this.fallbackBones.jaw.position.y = -0.01 - Math.min(1, flap) * 0.025;
        }
      }
    } else {
      if (this.fallbackBones.jaw) {
        this.fallbackBones.jaw.position.y = 0;
      }
    }

    // 3. Natural Blinking Cycle (Every 3.5 - 5 seconds)
    if (this.currentVRM?.expressionManager && this.currentExpression !== 'blink') {
      const blinkCycle = Math.sin(this.animationTime * 1.5 + Math.sin(this.animationTime * 0.4) * 3);
      if (blinkCycle > 0.96) {
        try {
          const blinkProgress = (blinkCycle - 0.96) / 0.04;
          const blinkWeight = Math.sin(blinkProgress * Math.PI);
          this.currentVRM.expressionManager.setValue('blink', blinkWeight);
        } catch {}
      }
    }

    // 4. Update Cyber-Haptic Particle Ripples
    if (this.activeRipples.length > 0) {
      const now = performance.now();
      for (let i = this.activeRipples.length - 1; i >= 0; i--) {
        const ripple = this.activeRipples[i];
        const elapsed = now - ripple.startTime;
        if (elapsed > ripple.lifetime) {
          this.scene.remove(ripple.mesh);
          ripple.mesh.geometry.dispose();
          if (Array.isArray(ripple.mesh.material)) {
            ripple.mesh.material.forEach((m) => m.dispose());
          } else {
            ripple.mesh.material.dispose();
          }
          this.activeRipples.splice(i, 1);
        } else {
          const progress = elapsed / ripple.lifetime;
          const scale = 1 + progress * 3.5;
          ripple.mesh.scale.set(scale, scale, scale);
          if (ripple.mesh.material instanceof THREE.Material) {
            ripple.mesh.material.opacity = (1 - progress) * 0.95;
          }
        }
      }
    }

    // 5. Apply skeletal full-body animations (idle / walk / wave / talk / cheer / thinking / sleep / dream)
    if (this.currentVRM?.humanoid) {
      this.animateVRMBones(this.currentVRM, delta);
    } else if (this.fallbackGroup) {
      this.animateFallbackBones(delta);
    }
  }

  /**
   * Smoothly interpolates bone rotations with natural muscular spring damping
   */
  private smoothRotate(
    bone: THREE.Object3D | null | undefined,
    tx: number,
    ty: number,
    tz: number,
    speed: number,
    delta: number,
    key: string
  ): void {
    if (!bone) return;
    let current = this.smoothBoneRotations.get(key);
    if (!current) {
      current = new THREE.Euler(bone.rotation.x, bone.rotation.y, bone.rotation.z);
      this.smoothBoneRotations.set(key, current);
    }
    const factor = Math.min(1.0, 1 - Math.exp(-speed * delta));
    current.x += (tx - current.x) * factor;
    current.y += (ty - current.y) * factor;
    current.z += (tz - current.z) * factor;
    bone.rotation.set(current.x, current.y, current.z);
  }

  /**
   * Smoothly interpolates bone positions with physical inertia
   */
  private smoothPosition(
    bone: THREE.Object3D | null | undefined,
    tx: number,
    ty: number,
    tz: number,
    speed: number,
    delta: number,
    key: string
  ): void {
    if (!bone) return;
    let current = this.smoothBonePositions.get(key);
    if (!current) {
      current = new THREE.Vector3(bone.position.x, bone.position.y, bone.position.z);
      this.smoothBonePositions.set(key, current);
    }
    const factor = Math.min(1.0, 1 - Math.exp(-speed * delta));
    current.x += (tx - current.x) * factor;
    current.y += (ty - current.y) * factor;
    current.z += (tz - current.z) * factor;
    bone.position.set(current.x, current.y, current.z);
  }

  /**
   * Procedural full-body kinematics applied to VRM humanoid bones across all limbs
   */
  private animateVRMBones(vrm: VRM, delta: number): void {
    const t = this.animationTime;
    const humanoid = vrm.humanoid;

    // Retrieve all standard humanoid joints
    const hips = humanoid.getNormalizedBoneNode(VRMHumanBoneName.Hips);
    const spine = humanoid.getNormalizedBoneNode(VRMHumanBoneName.Spine);
    const chest = humanoid.getNormalizedBoneNode(VRMHumanBoneName.Chest);
    const upperChest = humanoid.getNormalizedBoneNode(VRMHumanBoneName.UpperChest);
    const neck = humanoid.getNormalizedBoneNode(VRMHumanBoneName.Neck);
    const head = humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head);

    const leftShoulder = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftShoulder);
    const rightShoulder = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightShoulder);
    const leftUpperArm = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm);
    const rightUpperArm = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
    const leftLowerArm = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftLowerArm);
    const rightLowerArm = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightLowerArm);
    const leftHand = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftHand);
    const rightHand = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightHand);

    const leftUpperLeg = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperLeg);
    const rightUpperLeg = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperLeg);
    const leftLowerLeg = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftLowerLeg);
    const rightLowerLeg = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightLowerLeg);
    const leftFoot = humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftFoot);
    const rightFoot = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightFoot);

    // Dynamic Organic Multi-Harmonic Respiration and Saccades
    const microDriftX = Math.sin(t * 0.7) * 0.01 + Math.sin(t * 1.9) * 0.005;
    const microDriftY = Math.cos(t * 0.9) * 0.012 + Math.cos(t * 2.3) * 0.004;

    // Multi-Harmonic Diaphragmatic Breathing
    const breath = Math.sin(t * 1.6) * 0.65 + Math.sin(t * 3.1 + 0.4) * 0.25 + Math.sin(t * 0.7) * 0.1;
    const weightShift = Math.sin(t * 0.35); // 18s natural weight cycle

    // Cache initial VRM hips height
    if (hips) {
      if (!this.vrmHipsInitialPosition) {
        this.vrmHipsInitialPosition = hips.position.clone();
        if (this.vrmHipsInitialPosition.y === 0) {
          this.vrmHipsInitialPosition.y = 0.95;
        }
      }
    }

    const baseHipsX = this.vrmHipsInitialPosition?.x ?? 0;
    const baseHipsY = this.vrmHipsInitialPosition?.y ?? 0.95;
    const baseHipsZ = this.vrmHipsInitialPosition?.z ?? 0;

    // Dynamic Joint Inertia Speeds
    const kTorso = 10.0;
    const kArm = 11.0;
    const kElbow = 13.0;
    const kWrist = 14.0;
    const kLeg = 12.0;

    if (this.currentAnimation === 'walk') {
      const walkFreq = 6.0;
      const stride = Math.sin(t * walkFreq);
      const absBounce = Math.abs(stride);

      // Pelvic locomotion: vertical bounce + lateral weight shift + pelvic yaw
      this.smoothPosition(hips, baseHipsX + Math.sin(t * walkFreq * 0.5) * 0.025, baseHipsY + absBounce * 0.035, baseHipsZ, kTorso, delta, 'vrm_hips_pos');
      this.smoothRotate(hips, 0.02, -stride * 0.08, Math.cos(t * walkFreq * 0.5) * 0.025, kTorso, delta, 'vrm_hips');
      this.smoothRotate(spine, 0.03 + absBounce * 0.015, stride * 0.07, 0, kTorso, delta, 'vrm_spine');
      this.smoothRotate(chest, 0.015, stride * 0.04, -Math.cos(t * walkFreq * 0.5) * 0.015, kTorso, delta, 'vrm_chest');
      this.smoothRotate(upperChest, 0, 0, 0, kTorso, delta, 'vrm_upperChest');

      // Lower limbs: hip flexion/extension + true anatomical knee flexion (backward only) + ankle pitch
      this.smoothRotate(leftUpperLeg, stride * 0.44, 0, -0.02, kLeg, delta, 'vrm_l_uleg');
      this.smoothRotate(rightUpperLeg, -stride * 0.44, 0, 0.02, kLeg, delta, 'vrm_r_uleg');
      this.smoothRotate(leftLowerLeg, -Math.max(0, -stride * 0.75), 0, 0, kLeg, delta, 'vrm_l_lleg');
      this.smoothRotate(rightLowerLeg, -Math.max(0, stride * 0.75), 0, 0, kLeg, delta, 'vrm_r_lleg');
      this.smoothRotate(leftFoot, -stride * 0.18, 0, 0, kLeg, delta, 'vrm_l_foot');
      this.smoothRotate(rightFoot, stride * 0.18, 0, 0, kLeg, delta, 'vrm_r_foot');

      // Upper limbs: opposing arm swing with natural forward elbow flexion and wrist trailing
      this.smoothRotate(leftShoulder, -stride * 0.025, 0, 0, kArm, delta, 'vrm_l_sh');
      this.smoothRotate(rightShoulder, stride * 0.025, 0, 0, kArm, delta, 'vrm_r_sh');
      this.smoothRotate(leftUpperArm, -stride * 0.35, 0, 1.22, kArm, delta, 'vrm_l_uarm');
      this.smoothRotate(rightUpperArm, stride * 0.35, 0, -1.22, kArm, delta, 'vrm_r_uarm');
      this.smoothRotate(leftLowerArm, 0, -Math.max(0.1, -stride * 0.35), 0, kElbow, delta, 'vrm_l_larm');
      this.smoothRotate(rightLowerArm, 0, Math.max(0.1, stride * 0.35), 0, kElbow, delta, 'vrm_r_larm');
      this.smoothRotate(leftHand, 0, -stride * 0.08, 0.04, kWrist, delta, 'vrm_l_hand');
      this.smoothRotate(rightHand, 0, stride * 0.08, -0.04, kWrist, delta, 'vrm_r_hand');

      if (!this.lookAtTarget) {
        this.smoothRotate(head, absBounce * 0.015, -stride * 0.025, 0, kTorso, delta, 'vrm_head');
      }

    } else if (this.currentAnimation === 'wave') {
      const waveAngle = Math.sin(t * 7.5) * 0.35;

      this.smoothPosition(hips, baseHipsX - 0.015, baseHipsY, baseHipsZ, kTorso, delta, 'vrm_hips_pos');
      this.smoothRotate(hips, 0, 0.04, 0.02, kTorso, delta, 'vrm_hips');
      this.smoothRotate(spine, 0.02, 0.04, -0.015, kTorso, delta, 'vrm_spine');
      this.smoothRotate(chest, 0.01, 0.03, 0, kTorso, delta, 'vrm_chest');
      this.smoothRotate(upperChest, 0, 0, 0, kTorso, delta, 'vrm_upperChest');

      this.smoothRotate(leftUpperLeg, 0, 0, -0.03, kLeg, delta, 'vrm_l_uleg');
      this.smoothRotate(rightUpperLeg, 0.02, 0, 0.03, kLeg, delta, 'vrm_r_uleg');
      this.smoothRotate(leftLowerLeg, 0, 0, 0, kLeg, delta, 'vrm_l_lleg');
      this.smoothRotate(rightLowerLeg, -0.04, 0, 0, kLeg, delta, 'vrm_r_lleg');

      this.smoothRotate(leftShoulder, 0, 0, 0, kArm, delta, 'vrm_l_sh');
      this.smoothRotate(leftUpperArm, 0.04, 0, 1.25, kArm, delta, 'vrm_l_uarm');
      this.smoothRotate(leftLowerArm, 0, -0.12, 0, kElbow, delta, 'vrm_l_larm');
      this.smoothRotate(leftHand, 0.04, 0, 0.04, kWrist, delta, 'vrm_l_hand');

      // Right arm: lifted with elbow bent forward at ~80 deg and hand oscillating
      this.smoothRotate(rightShoulder, 0.05, 0, -0.12, kArm, delta, 'vrm_r_sh');
      this.smoothRotate(rightUpperArm, 0.25, -0.1, -1.45, kArm, delta, 'vrm_r_uarm');
      this.smoothRotate(rightLowerArm, 0, 1.35, 0, kElbow, delta, 'vrm_r_larm');
      this.smoothRotate(rightHand, 0, 0, waveAngle, 20.0, delta, 'vrm_r_hand');

      if (!this.lookAtTarget) {
        this.smoothRotate(head, -0.03, 0.06, waveAngle * 0.05, kTorso, delta, 'vrm_head');
      }

    } else if (this.currentAnimation === 'talk') {
      const speakCadence = Math.sin(t * 3.0);
      const subCadence = Math.cos(t * 1.5);

      this.smoothPosition(hips, baseHipsX, baseHipsY + speakCadence * 0.003, baseHipsZ + 0.012, kTorso, delta, 'vrm_hips_pos');
      this.smoothRotate(hips, 0.015, subCadence * 0.02, 0, kTorso, delta, 'vrm_hips');
      this.smoothRotate(spine, 0.035 + speakCadence * 0.015, subCadence * 0.018, 0, kTorso, delta, 'vrm_spine');
      this.smoothRotate(chest, 0.02 + speakCadence * 0.012, 0, 0, kTorso, delta, 'vrm_chest');
      this.smoothRotate(upperChest, 0.01 * speakCadence, 0, 0, kTorso, delta, 'vrm_upperChest');

      this.smoothRotate(leftUpperLeg, 0.02, 0, -0.02, kLeg, delta, 'vrm_l_uleg');
      this.smoothRotate(rightUpperLeg, -0.02, 0, 0.03, kLeg, delta, 'vrm_r_uleg');
      this.smoothRotate(leftLowerLeg, -0.02, 0, 0, kLeg, delta, 'vrm_l_lleg');
      this.smoothRotate(rightLowerLeg, -0.04, 0, 0, kLeg, delta, 'vrm_r_lleg');

      // Right arm expressive conversational gesture
      this.smoothRotate(rightShoulder, 0.03, 0.02, -0.03, kArm, delta, 'vrm_r_sh');
      this.smoothRotate(rightUpperArm, 0.22 + speakCadence * 0.08, -0.1, -0.85 + subCadence * 0.06, kArm, delta, 'vrm_r_uarm');
      this.smoothRotate(rightLowerArm, 0, 0.65 + subCadence * 0.18, 0, kElbow, delta, 'vrm_r_larm');
      this.smoothRotate(rightHand, 0.08, speakCadence * 0.1, -0.08, kWrist, delta, 'vrm_r_hand');

      // Left arm supportive natural posture
      this.smoothRotate(leftShoulder, 0, 0, 0, kArm, delta, 'vrm_l_sh');
      this.smoothRotate(leftUpperArm, 0.06 + subCadence * 0.04, 0, 1.22, kArm, delta, 'vrm_l_uarm');
      this.smoothRotate(leftLowerArm, 0, -0.16 - speakCadence * 0.05, 0, kElbow, delta, 'vrm_l_larm');
      this.smoothRotate(leftHand, 0.05, 0, 0.04, kWrist, delta, 'vrm_l_hand');

      if (!this.lookAtTarget) {
        this.smoothRotate(head, speakCadence * 0.05 + microDriftY, subCadence * 0.04 + microDriftX, 0, kTorso, delta, 'vrm_head');
      }

    } else if (this.currentAnimation === 'nod') {
      const nodSine = Math.sin(t * 6.0);

      this.smoothPosition(hips, baseHipsX, baseHipsY + Math.max(0, -nodSine * 0.008), baseHipsZ, kTorso, delta, 'vrm_hips_pos');
      this.smoothRotate(hips, 0, 0, 0, kTorso, delta, 'vrm_hips');
      this.smoothRotate(spine, 0.025 + Math.max(0, nodSine * 0.03), 0, 0, kTorso, delta, 'vrm_spine');
      this.smoothRotate(chest, 0.015 + Math.max(0, nodSine * 0.02), 0, 0, kTorso, delta, 'vrm_chest');

      this.smoothRotate(leftUpperLeg, 0, 0, -0.02, kLeg, delta, 'vrm_l_uleg');
      this.smoothRotate(rightUpperLeg, 0, 0, 0.02, kLeg, delta, 'vrm_r_uleg');
      this.smoothRotate(leftLowerLeg, -Math.max(0, nodSine * 0.025), 0, 0, kLeg, delta, 'vrm_l_lleg');
      this.smoothRotate(rightLowerLeg, -Math.max(0, nodSine * 0.025), 0, 0, kLeg, delta, 'vrm_r_lleg');

      this.smoothRotate(leftUpperArm, 0.04, 0, 1.25, kArm, delta, 'vrm_l_uarm');
      this.smoothRotate(rightUpperArm, 0.04, 0, -1.25, kArm, delta, 'vrm_r_uarm');
      this.smoothRotate(leftLowerArm, 0, -0.12, 0, kElbow, delta, 'vrm_l_larm');
      this.smoothRotate(rightLowerArm, 0, 0.12, 0, kElbow, delta, 'vrm_r_larm');

      if (!this.lookAtTarget) {
        this.smoothRotate(head, nodSine * 0.25, 0, 0, 18.0, delta, 'vrm_head');
      }

    } else if (this.currentAnimation === 'thinking') {
      this.smoothPosition(hips, baseHipsX + 0.015, baseHipsY, baseHipsZ - 0.01, kTorso, delta, 'vrm_hips_pos');
      this.smoothRotate(hips, -0.015, -0.05, -0.02, kTorso, delta, 'vrm_hips');
      this.smoothRotate(spine, 0.03, -0.05, 0.015, kTorso, delta, 'vrm_spine');
      this.smoothRotate(chest, 0.02, -0.03, 0, kTorso, delta, 'vrm_chest');

      this.smoothRotate(rightUpperLeg, -0.02, 0, 0.03, kLeg, delta, 'vrm_r_uleg');
      this.smoothRotate(leftUpperLeg, 0.03, 0, -0.03, kLeg, delta, 'vrm_l_uleg');
      this.smoothRotate(leftLowerLeg, -0.05, 0, 0, kLeg, delta, 'vrm_l_lleg');

      // Right arm raised with hand to chin
      this.smoothRotate(rightShoulder, 0.06, 0.04, -0.03, kArm, delta, 'vrm_r_sh');
      this.smoothRotate(rightUpperArm, 0.45, -0.18, -0.7, kArm, delta, 'vrm_r_uarm');
      this.smoothRotate(rightLowerArm, 0, 1.75, 0, kElbow, delta, 'vrm_r_larm');
      this.smoothRotate(rightHand, 0.15, 0, -0.12, kWrist, delta, 'vrm_r_hand');

      // Left arm crossed near stomach
      this.smoothRotate(leftShoulder, 0.03, 0, 0.03, kArm, delta, 'vrm_l_sh');
      this.smoothRotate(leftUpperArm, 0.3, 0.08, 1.05, kArm, delta, 'vrm_l_uarm');
      this.smoothRotate(leftLowerArm, 0, -1.35, 0, kElbow, delta, 'vrm_l_larm');
      this.smoothRotate(leftHand, 0, 0.15, 0, kWrist, delta, 'vrm_l_hand');

      if (!this.lookAtTarget) {
        this.smoothRotate(head, 0.12, -0.14, 0.06, kTorso, delta, 'vrm_head');
      }

    } else if (this.currentAnimation === 'cheer') {
      const cheerSway = Math.sin(t * 5.2);
      const cheerBounce = Math.abs(cheerSway);

      this.smoothPosition(hips, baseHipsX + cheerSway * 0.03, baseHipsY + cheerBounce * 0.04, baseHipsZ, kTorso, delta, 'vrm_hips_pos');
      this.smoothRotate(hips, 0, cheerSway * 0.07, cheerSway * 0.04, kTorso, delta, 'vrm_hips');
      this.smoothRotate(spine, -0.03, -cheerSway * 0.05, -cheerSway * 0.03, kTorso, delta, 'vrm_spine');
      this.smoothRotate(chest, -0.02, -cheerSway * 0.03, 0, kTorso, delta, 'vrm_chest');

      this.smoothRotate(leftUpperLeg, cheerSway * 0.15, 0, -0.04 - cheerBounce * 0.02, kLeg, delta, 'vrm_l_uleg');
      this.smoothRotate(rightUpperLeg, -cheerSway * 0.15, 0, 0.04 + cheerBounce * 0.02, kLeg, delta, 'vrm_r_uleg');
      this.smoothRotate(leftLowerLeg, -Math.max(0, -cheerSway * 0.3), 0, 0, kLeg, delta, 'vrm_l_lleg');
      this.smoothRotate(rightLowerLeg, -Math.max(0, cheerSway * 0.3), 0, 0, kLeg, delta, 'vrm_r_lleg');

      this.smoothRotate(leftShoulder, 0, 0, 0.1, kArm, delta, 'vrm_l_sh');
      this.smoothRotate(rightShoulder, 0, 0, -0.1, kArm, delta, 'vrm_r_sh');
      this.smoothRotate(leftUpperArm, 0.18, cheerSway * 0.1, 2.05, kArm, delta, 'vrm_l_uarm');
      this.smoothRotate(rightUpperArm, 0.18, -cheerSway * 0.1, -2.05, kArm, delta, 'vrm_r_uarm');
      this.smoothRotate(leftLowerArm, 0, -0.5 - cheerBounce * 0.12, 0, kElbow, delta, 'vrm_l_larm');
      this.smoothRotate(rightLowerArm, 0, 0.5 + cheerBounce * 0.12, 0, kElbow, delta, 'vrm_r_larm');
      this.smoothRotate(leftHand, 0, 0, cheerSway * 0.18, kWrist, delta, 'vrm_l_hand');
      this.smoothRotate(rightHand, 0, 0, -cheerSway * 0.18, kWrist, delta, 'vrm_r_hand');

      if (!this.lookAtTarget) {
        this.smoothRotate(head, -0.1, cheerSway * 0.08, cheerSway * 0.08, kTorso, delta, 'vrm_head');
      }

    } else if (this.currentAnimation === 'sleep') {
      const slowBreath = Math.sin(t * 1.0);

      this.smoothPosition(hips, baseHipsX, baseHipsY - 0.015 + slowBreath * 0.005, baseHipsZ, 5.0, delta, 'vrm_hips_pos');
      this.smoothRotate(hips, 0.03, 0, 0, 5.0, delta, 'vrm_hips');
      this.smoothRotate(spine, 0.06 + slowBreath * 0.018, 0, 0, 5.0, delta, 'vrm_spine');
      this.smoothRotate(chest, 0.04 + slowBreath * 0.02, 0, 0, 5.0, delta, 'vrm_chest');

      this.smoothRotate(leftUpperLeg, 0.04, 0, -0.03, 5.0, delta, 'vrm_l_uleg');
      this.smoothRotate(rightUpperLeg, 0.04, 0, 0.03, 5.0, delta, 'vrm_r_uleg');
      this.smoothRotate(leftLowerLeg, -0.05, 0, 0, 5.0, delta, 'vrm_l_lleg');
      this.smoothRotate(rightLowerLeg, -0.05, 0, 0, 5.0, delta, 'vrm_r_lleg');

      this.smoothRotate(leftUpperArm, 0.06, 0, 1.25, 5.0, delta, 'vrm_l_uarm');
      this.smoothRotate(rightUpperArm, 0.06, 0, -1.25, 5.0, delta, 'vrm_r_uarm');
      this.smoothRotate(leftLowerArm, 0, -0.08, 0, 5.0, delta, 'vrm_l_larm');
      this.smoothRotate(rightLowerArm, 0, 0.08, 0, 5.0, delta, 'vrm_r_larm');

      if (!this.lookAtTarget) {
        this.smoothRotate(head, 0.22 + slowBreath * 0.015, 0, 0, 5.0, delta, 'vrm_head');
      }

    } else if (this.currentAnimation === 'dream') {
      const floatA = Math.sin(t * 1.4);
      const floatB = Math.cos(t * 1.0);

      this.smoothPosition(hips, baseHipsX + floatB * 0.025, baseHipsY + floatA * 0.05, baseHipsZ, 4.0, delta, 'vrm_hips_pos');
      this.smoothRotate(hips, floatA * 0.025, floatB * 0.03, floatA * 0.03, 4.0, delta, 'vrm_hips');
      this.smoothRotate(spine, -0.015, floatB * 0.025, floatA * 0.025, 4.0, delta, 'vrm_spine');
      this.smoothRotate(chest, -0.015, 0, floatA * 0.018, 4.0, delta, 'vrm_chest');

      this.smoothRotate(leftUpperLeg, -0.06 + floatA * 0.05, 0, -0.06, 4.0, delta, 'vrm_l_uleg');
      this.smoothRotate(rightUpperLeg, 0.1 - floatA * 0.05, 0, 0.06, 4.0, delta, 'vrm_r_uleg');
      this.smoothRotate(leftLowerLeg, -0.18 - floatB * 0.05, 0, 0, 4.0, delta, 'vrm_l_lleg');
      this.smoothRotate(rightLowerLeg, -0.1 - floatB * 0.05, 0, 0, 4.0, delta, 'vrm_r_lleg');
      this.smoothRotate(leftFoot, 0.15 + floatA * 0.08, 0, 0, 4.0, delta, 'vrm_l_foot');
      this.smoothRotate(rightFoot, 0.15 - floatA * 0.08, 0, 0, 4.0, delta, 'vrm_r_foot');

      this.smoothRotate(leftUpperArm, 0.08 + floatA * 0.04, 0, 1.35 + floatB * 0.06, 4.0, delta, 'vrm_l_uarm');
      this.smoothRotate(rightUpperArm, 0.08 - floatA * 0.04, 0, -1.35 - floatB * 0.06, 4.0, delta, 'vrm_r_uarm');
      this.smoothRotate(leftLowerArm, 0, -0.22 - floatB * 0.08, 0, 4.0, delta, 'vrm_l_larm');
      this.smoothRotate(rightLowerArm, 0, 0.22 + floatB * 0.08, 0, 4.0, delta, 'vrm_r_larm');
      this.smoothRotate(leftHand, floatA * 0.1, floatB * 0.08, 0, 4.0, delta, 'vrm_l_hand');
      this.smoothRotate(rightHand, -floatA * 0.1, -floatB * 0.08, 0, 4.0, delta, 'vrm_r_hand');

      if (!this.lookAtTarget) {
        this.smoothRotate(head, -0.06 + floatA * 0.03, floatB * 0.03, floatA * 0.03, 4.0, delta, 'vrm_head');
      }

    } else if (this.currentAnimation === 'idle_slow') {
      const slowBreath = Math.sin(t * 1.1);

      this.smoothPosition(hips, baseHipsX, baseHipsY + slowBreath * 0.003, baseHipsZ, 6.0, delta, 'vrm_hips_pos');
      this.smoothRotate(hips, 0.02, 0, 0, 6.0, delta, 'vrm_hips');
      this.smoothRotate(spine, 0.05 + slowBreath * 0.012, 0, 0, 6.0, delta, 'vrm_spine');
      this.smoothRotate(chest, 0.03 + slowBreath * 0.015, 0, 0, 6.0, delta, 'vrm_chest');

      this.smoothRotate(leftUpperLeg, 0.025, 0, -0.025, 6.0, delta, 'vrm_l_uleg');
      this.smoothRotate(rightUpperLeg, 0.025, 0, 0.025, 6.0, delta, 'vrm_r_uleg');
      this.smoothRotate(leftLowerLeg, -0.03, 0, 0, 6.0, delta, 'vrm_l_lleg');
      this.smoothRotate(rightLowerLeg, -0.03, 0, 0, 6.0, delta, 'vrm_r_lleg');

      this.smoothRotate(leftUpperArm, 0.04, 0, 1.24, 6.0, delta, 'vrm_l_uarm');
      this.smoothRotate(rightUpperArm, 0.04, 0, -1.24, 6.0, delta, 'vrm_r_uarm');
      this.smoothRotate(leftLowerArm, 0, -0.1, 0, 6.0, delta, 'vrm_l_larm');
      this.smoothRotate(rightLowerArm, 0, 0.1, 0, 6.0, delta, 'vrm_r_larm');

      if (!this.lookAtTarget) {
        this.smoothRotate(head, 0.16 + slowBreath * 0.008, 0, 0, 6.0, delta, 'vrm_head');
      }

    } else {
      // ----------------------------------------------------
      // FULL-BODY NATURAL IDLE: CONTRAPPOSTO WEIGHT SHIFTING & RESPIRATION
      // ----------------------------------------------------
      this.smoothPosition(
        hips,
        baseHipsX + weightShift * 0.018,
        baseHipsY + breath * 0.005,
        baseHipsZ,
        8.0,
        delta,
        'vrm_hips_pos'
      );
      this.smoothRotate(hips, 0.01, weightShift * 0.015, weightShift * 0.025, 8.0, delta, 'vrm_hips');

      this.smoothRotate(
        spine,
        0.018 + breath * 0.018,
        -weightShift * 0.012,
        -weightShift * 0.02,
        8.0,
        delta,
        'vrm_spine'
      );
      this.smoothRotate(
        chest,
        0.012 + breath * 0.014,
        -weightShift * 0.008,
        -weightShift * 0.01,
        8.0,
        delta,
        'vrm_chest'
      );
      this.smoothRotate(upperChest, breath * 0.008, 0, 0, 8.0, delta, 'vrm_upperChest');

      this.smoothRotate(leftUpperLeg, -weightShift * 0.015, 0, -0.025 - weightShift * 0.02, 8.0, delta, 'vrm_l_uleg');
      this.smoothRotate(rightUpperLeg, weightShift * 0.015, 0, 0.025 - weightShift * 0.02, 8.0, delta, 'vrm_r_uleg');
      this.smoothRotate(leftLowerLeg, -Math.max(0, -weightShift * 0.04), 0, 0, 8.0, delta, 'vrm_l_lleg');
      this.smoothRotate(rightLowerLeg, -Math.max(0, weightShift * 0.04), 0, 0, 8.0, delta, 'vrm_r_lleg');
      this.smoothRotate(leftFoot, 0, 0, weightShift * 0.015, 8.0, delta, 'vrm_l_foot');
      this.smoothRotate(rightFoot, 0, 0, weightShift * 0.015, 8.0, delta, 'vrm_r_foot');

      this.smoothRotate(leftShoulder, 0, 0, -weightShift * 0.015, 8.0, delta, 'vrm_l_sh');
      this.smoothRotate(rightShoulder, 0, 0, -weightShift * 0.015, 8.0, delta, 'vrm_r_sh');

      this.smoothRotate(leftUpperArm, 0.04 + breath * 0.01, 0, 1.24 + breath * 0.012 - weightShift * 0.012, 8.0, delta, 'vrm_l_uarm');
      this.smoothRotate(rightUpperArm, 0.04 + breath * 0.01, 0, -1.24 - breath * 0.012 - weightShift * 0.012, 8.0, delta, 'vrm_r_uarm');

      // Subtle natural elbow flexion in resting tonus (~8 degrees anteriorly)
      this.smoothRotate(leftLowerArm, 0, -0.12 - breath * 0.012, 0, 8.0, delta, 'vrm_l_larm');
      this.smoothRotate(rightLowerArm, 0, 0.12 + breath * 0.012, 0, 8.0, delta, 'vrm_r_larm');

      this.smoothRotate(leftHand, 0.04, 0, 0.04, 8.0, delta, 'vrm_l_hand');
      this.smoothRotate(rightHand, 0.04, 0, -0.04, 8.0, delta, 'vrm_r_hand');

      if (!this.lookAtTarget) {
        this.smoothRotate(head, microDriftY + breath * 0.006, microDriftX + weightShift * 0.008, 0, 8.0, delta, 'vrm_head');
      }
    }

    // Gaze / LookAt tracking overrides head orientation smoothly
    if (this.lookAtTarget && head) {
      const localTarget = this.lookAtTarget.clone();
      this.avatarRoot.worldToLocal(localTarget);
      const angleY = Math.atan2(localTarget.x, localTarget.z);
      const angleX = -Math.atan2(localTarget.y - 1.4, Math.sqrt(localTarget.x * localTarget.x + localTarget.z * localTarget.z));
      const targetHeadY = THREE.MathUtils.clamp(angleY + microDriftX, -Math.PI / 3, Math.PI / 3);
      const targetHeadX = THREE.MathUtils.clamp(angleX + microDriftY, -Math.PI / 4, Math.PI / 4);
      this.smoothRotate(head, targetHeadX, targetHeadY, 0, this.lookDamping, delta, 'vrm_head');
    }
  }

  /**
   * Procedural animation applied to Fallback Humanoid mannequin across all limbs
   */
  private animateFallbackBones(delta: number): void {
    const t = this.animationTime;
    const bones = this.fallbackBones;

    const microDriftX = Math.sin(t * 0.7) * 0.01 + Math.sin(t * 1.9) * 0.005;
    const microDriftY = Math.cos(t * 0.9) * 0.012 + Math.cos(t * 2.3) * 0.004;

    const breath = Math.sin(t * 1.6) * 0.65 + Math.sin(t * 3.1 + 0.4) * 0.25 + Math.sin(t * 0.7) * 0.1;
    const weightShift = Math.sin(t * 0.35);

    const kTorso = 10.0;
    const kArm = 11.0;
    const kElbow = 13.0;
    const kLeg = 12.0;

    if (this.currentAnimation === 'walk') {
      const walkFreq = 6.0;
      const stride = Math.sin(t * walkFreq);
      const bounce = Math.abs(stride);

      this.smoothPosition(bones.hips, Math.sin(t * walkFreq * 0.5) * 0.02, 0.95 + bounce * 0.035, 0, kTorso, delta, 'fb_hips_pos');
      this.smoothRotate(bones.hips, 0.02, -stride * 0.07, 0, kTorso, delta, 'fb_hips');
      this.smoothRotate(bones.spine, 0.03 + bounce * 0.015, stride * 0.07, 0, kTorso, delta, 'fb_spine');

      this.smoothRotate(bones.leftLeg, stride * 0.44, 0, 0, kLeg, delta, 'fb_l_leg');
      this.smoothRotate(bones.rightLeg, -stride * 0.44, 0, 0, kLeg, delta, 'fb_r_leg');
      this.smoothRotate(bones.leftCalf, Math.max(0, -stride * 0.75), 0, 0, kLeg, delta, 'fb_l_calf');
      this.smoothRotate(bones.rightCalf, Math.max(0, stride * 0.75), 0, 0, kLeg, delta, 'fb_r_calf');

      this.smoothRotate(bones.leftArm, -stride * 0.35, 0, 0.06, kArm, delta, 'fb_l_arm');
      this.smoothRotate(bones.rightArm, stride * 0.35, 0, -0.06, kArm, delta, 'fb_r_arm');
      this.smoothRotate(bones.leftForearm, -Math.max(0.1, -stride * 0.35), 0, 0, kElbow, delta, 'fb_l_farm');
      this.smoothRotate(bones.rightForearm, -Math.max(0.1, stride * 0.35), 0, 0, kElbow, delta, 'fb_r_farm');

      if (!this.lookAtTarget) {
        this.smoothRotate(bones.head, bounce * 0.015, -stride * 0.025, 0, kTorso, delta, 'fb_head');
      }

    } else if (this.currentAnimation === 'wave') {
      const waveAngle = Math.sin(t * 7.5) * 0.35;

      this.smoothPosition(bones.hips, -0.015, 0.95, 0, kTorso, delta, 'fb_hips_pos');
      this.smoothRotate(bones.hips, 0, 0.04, 0.02, kTorso, delta, 'fb_hips');
      this.smoothRotate(bones.spine, 0.02, 0.04, -0.015, kTorso, delta, 'fb_spine');

      this.smoothRotate(bones.leftLeg, 0, 0, -0.03, kLeg, delta, 'fb_l_leg');
      this.smoothRotate(bones.rightLeg, 0.02, 0, 0.03, kLeg, delta, 'fb_r_leg');
      this.smoothRotate(bones.leftCalf, 0, 0, 0, kLeg, delta, 'fb_l_calf');
      this.smoothRotate(bones.rightCalf, 0.04, 0, 0, kLeg, delta, 'fb_r_calf');

      this.smoothRotate(bones.leftArm, 0.04, 0, 0.06, kArm, delta, 'fb_l_arm');
      this.smoothRotate(bones.leftForearm, -0.12, 0, 0, kElbow, delta, 'fb_l_farm');

      this.smoothRotate(bones.rightArm, 0.25, 0, -1.45, kArm, delta, 'fb_r_arm');
      this.smoothRotate(bones.rightForearm, -1.35, 0, waveAngle, 20.0, delta, 'fb_r_farm');

      if (!this.lookAtTarget) {
        this.smoothRotate(bones.head, -0.03, 0.06, waveAngle * 0.05, kTorso, delta, 'fb_head');
      }

    } else if (this.currentAnimation === 'talk') {
      const speakCadence = Math.sin(t * 3.0);
      const subCadence = Math.cos(t * 1.5);

      this.smoothPosition(bones.hips, 0, 0.95 + speakCadence * 0.003, 0.012, kTorso, delta, 'fb_hips_pos');
      this.smoothRotate(bones.hips, 0.015, subCadence * 0.02, 0, kTorso, delta, 'fb_hips');
      this.smoothRotate(bones.spine, 0.035 + speakCadence * 0.015, subCadence * 0.018, 0, kTorso, delta, 'fb_spine');

      this.smoothRotate(bones.leftLeg, 0.02, 0, -0.02, kLeg, delta, 'fb_l_leg');
      this.smoothRotate(bones.rightLeg, -0.02, 0, 0.03, kLeg, delta, 'fb_r_leg');
      this.smoothRotate(bones.leftCalf, 0.02, 0, 0, kLeg, delta, 'fb_l_calf');
      this.smoothRotate(bones.rightCalf, 0.04, 0, 0, kLeg, delta, 'fb_r_calf');

      this.smoothRotate(bones.rightArm, 0.22 + speakCadence * 0.08, 0, -0.25 + subCadence * 0.06, kArm, delta, 'fb_r_arm');
      this.smoothRotate(bones.rightForearm, -0.65 - subCadence * 0.18, 0, 0, kElbow, delta, 'fb_r_farm');

      this.smoothRotate(bones.leftArm, 0.06 + subCadence * 0.04, 0, 0.06, kArm, delta, 'fb_l_arm');
      this.smoothRotate(bones.leftForearm, -0.16 - speakCadence * 0.05, 0, 0, kElbow, delta, 'fb_l_farm');

      if (!this.lookAtTarget) {
        this.smoothRotate(bones.head, speakCadence * 0.05 + microDriftY, subCadence * 0.04 + microDriftX, 0, kTorso, delta, 'fb_head');
      }

    } else if (this.currentAnimation === 'nod') {
      const nodSine = Math.sin(t * 6.0);

      this.smoothPosition(bones.hips, 0, 0.95 + Math.max(0, -nodSine * 0.008), 0, kTorso, delta, 'fb_hips_pos');
      this.smoothRotate(bones.spine, 0.025 + Math.max(0, nodSine * 0.03), 0, 0, kTorso, delta, 'fb_spine');

      this.smoothRotate(bones.leftLeg, 0, 0, -0.02, kLeg, delta, 'fb_l_leg');
      this.smoothRotate(bones.rightLeg, 0, 0, 0.02, kLeg, delta, 'fb_r_leg');
      this.smoothRotate(bones.leftCalf, Math.max(0, nodSine * 0.025), 0, 0, kLeg, delta, 'fb_l_calf');
      this.smoothRotate(bones.rightCalf, Math.max(0, nodSine * 0.025), 0, 0, kLeg, delta, 'fb_r_calf');

      this.smoothRotate(bones.leftArm, 0.04, 0, 0.06, kArm, delta, 'fb_l_arm');
      this.smoothRotate(bones.rightArm, 0.04, 0, -0.06, kArm, delta, 'fb_r_arm');
      this.smoothRotate(bones.leftForearm, -0.12, 0, 0, kElbow, delta, 'fb_l_farm');
      this.smoothRotate(bones.rightForearm, -0.12, 0, 0, kElbow, delta, 'fb_r_farm');

      if (!this.lookAtTarget) {
        this.smoothRotate(bones.head, nodSine * 0.25, 0, 0, 18.0, delta, 'fb_head');
      }

    } else if (this.currentAnimation === 'thinking') {
      this.smoothPosition(bones.hips, 0.015, 0.95, -0.01, kTorso, delta, 'fb_hips_pos');
      this.smoothRotate(bones.hips, -0.015, -0.05, -0.02, kTorso, delta, 'fb_hips');
      this.smoothRotate(bones.spine, 0.03, -0.05, 0.015, kTorso, delta, 'fb_spine');

      this.smoothRotate(bones.rightLeg, -0.02, 0, 0.03, kLeg, delta, 'fb_r_leg');
      this.smoothRotate(bones.leftLeg, 0.03, 0, -0.03, kLeg, delta, 'fb_l_leg');
      this.smoothRotate(bones.leftCalf, 0.05, 0, 0, kLeg, delta, 'fb_l_calf');

      this.smoothRotate(bones.rightArm, 0.45, 0, -0.7, kArm, delta, 'fb_r_arm');
      this.smoothRotate(bones.rightForearm, -1.75, 0, 0, kElbow, delta, 'fb_r_farm');

      this.smoothRotate(bones.leftArm, 0.3, 0, 0.65, kArm, delta, 'fb_l_arm');
      this.smoothRotate(bones.leftForearm, -1.35, 0, 0, kElbow, delta, 'fb_l_farm');

      if (!this.lookAtTarget) {
        this.smoothRotate(bones.head, 0.12, -0.14, 0.06, kTorso, delta, 'fb_head');
      }

    } else if (this.currentAnimation === 'cheer') {
      const sway = Math.sin(t * 5.2);
      const bounce = Math.abs(sway);

      this.smoothPosition(bones.hips, sway * 0.03, 0.95 + bounce * 0.04, 0, kTorso, delta, 'fb_hips_pos');
      this.smoothRotate(bones.hips, 0, sway * 0.07, sway * 0.04, kTorso, delta, 'fb_hips');
      this.smoothRotate(bones.spine, -0.03, -sway * 0.05, -sway * 0.03, kTorso, delta, 'fb_spine');

      this.smoothRotate(bones.leftLeg, sway * 0.15, 0, -0.04, kLeg, delta, 'fb_l_leg');
      this.smoothRotate(bones.rightLeg, -sway * 0.15, 0, 0.04, kLeg, delta, 'fb_r_leg');
      this.smoothRotate(bones.leftCalf, Math.max(0, -sway * 0.3), 0, 0, kLeg, delta, 'fb_l_calf');
      this.smoothRotate(bones.rightCalf, Math.max(0, sway * 0.3), 0, 0, kLeg, delta, 'fb_r_calf');

      this.smoothRotate(bones.leftArm, 0.18, 0, 2.05, kArm, delta, 'fb_l_arm');
      this.smoothRotate(bones.rightArm, 0.18, 0, -2.05, kArm, delta, 'fb_r_arm');
      this.smoothRotate(bones.leftForearm, -0.5, 0, 0, kElbow, delta, 'fb_l_farm');
      this.smoothRotate(bones.rightForearm, -0.5, 0, 0, kElbow, delta, 'fb_r_farm');

      if (!this.lookAtTarget) {
        this.smoothRotate(bones.head, -0.1, sway * 0.08, sway * 0.08, kTorso, delta, 'fb_head');
      }

    } else if (this.currentAnimation === 'sleep') {
      const slowBreath = Math.sin(t * 1.0);

      this.smoothPosition(bones.hips, 0, 0.93 + slowBreath * 0.005, 0, 5.0, delta, 'fb_hips_pos');
      this.smoothRotate(bones.spine, 0.06 + slowBreath * 0.018, 0, 0, 5.0, delta, 'fb_spine');

      this.smoothRotate(bones.leftLeg, 0.04, 0, -0.03, 5.0, delta, 'fb_l_leg');
      this.smoothRotate(bones.rightLeg, 0.04, 0, 0.03, 5.0, delta, 'fb_r_leg');
      this.smoothRotate(bones.leftCalf, 0.05, 0, 0, 5.0, delta, 'fb_l_calf');
      this.smoothRotate(bones.rightCalf, 0.05, 0, 0, 5.0, delta, 'fb_r_calf');

      this.smoothRotate(bones.leftArm, 0.06, 0, 0.06, 5.0, delta, 'fb_l_arm');
      this.smoothRotate(bones.rightArm, 0.06, 0, -0.06, 5.0, delta, 'fb_r_arm');
      this.smoothRotate(bones.leftForearm, -0.08, 0, 0, 5.0, delta, 'fb_l_farm');
      this.smoothRotate(bones.rightForearm, -0.08, 0, 0, 5.0, delta, 'fb_r_farm');

      if (!this.lookAtTarget) {
        this.smoothRotate(bones.head, 0.22 + slowBreath * 0.015, 0, 0, 5.0, delta, 'fb_head');
      }

    } else if (this.currentAnimation === 'dream') {
      const floatA = Math.sin(t * 1.4);
      const floatB = Math.cos(t * 1.0);

      this.smoothPosition(bones.hips, floatB * 0.025, 0.95 + floatA * 0.05, 0, 4.0, delta, 'fb_hips_pos');
      this.smoothRotate(bones.spine, -0.015, floatB * 0.025, floatA * 0.025, 4.0, delta, 'fb_spine');

      this.smoothRotate(bones.leftLeg, -0.06 + floatA * 0.05, 0, -0.06, 4.0, delta, 'fb_l_leg');
      this.smoothRotate(bones.rightLeg, 0.1 - floatA * 0.05, 0, 0.06, 4.0, delta, 'fb_r_leg');
      this.smoothRotate(bones.leftCalf, 0.18 + floatB * 0.05, 0, 0, 4.0, delta, 'fb_l_calf');
      this.smoothRotate(bones.rightCalf, 0.1 - floatB * 0.05, 0, 0, 4.0, delta, 'fb_r_calf');

      this.smoothRotate(bones.leftArm, 0.08 + floatA * 0.04, 0, 0.35 + floatB * 0.06, 4.0, delta, 'fb_l_arm');
      this.smoothRotate(bones.rightArm, 0.08 - floatA * 0.04, 0, -0.35 - floatB * 0.06, 4.0, delta, 'fb_r_arm');
      this.smoothRotate(bones.leftForearm, -0.22, 0, 0, 4.0, delta, 'fb_l_farm');
      this.smoothRotate(bones.rightForearm, -0.22, 0, 0, 4.0, delta, 'fb_r_farm');

      if (!this.lookAtTarget) {
        this.smoothRotate(bones.head, -0.06 + floatA * 0.03, floatB * 0.03, floatA * 0.03, 4.0, delta, 'fb_head');
      }

    } else if (this.currentAnimation === 'idle_slow') {
      const slowBreath = Math.sin(t * 1.1);

      this.smoothPosition(bones.hips, 0, 0.95 + slowBreath * 0.003, 0, 6.0, delta, 'fb_hips_pos');
      this.smoothRotate(bones.spine, 0.05 + slowBreath * 0.012, 0, 0, 6.0, delta, 'fb_spine');

      this.smoothRotate(bones.leftLeg, 0.025, 0, -0.025, 6.0, delta, 'fb_l_leg');
      this.smoothRotate(bones.rightLeg, 0.025, 0, 0.025, 6.0, delta, 'fb_r_leg');
      this.smoothRotate(bones.leftCalf, 0.03, 0, 0, 6.0, delta, 'fb_l_calf');
      this.smoothRotate(bones.rightCalf, 0.03, 0, 0, 6.0, delta, 'fb_r_calf');

      this.smoothRotate(bones.leftArm, 0.04, 0, 0.06, 6.0, delta, 'fb_l_arm');
      this.smoothRotate(bones.rightArm, 0.04, 0, -0.06, 6.0, delta, 'fb_r_arm');
      this.smoothRotate(bones.leftForearm, -0.1, 0, 0, 6.0, delta, 'fb_l_farm');
      this.smoothRotate(bones.rightForearm, -0.1, 0, 0, 6.0, delta, 'fb_r_farm');

      if (!this.lookAtTarget) {
        this.smoothRotate(bones.head, 0.16 + slowBreath * 0.008, 0, 0, 6.0, delta, 'fb_head');
      }

    } else {
      // Full-Body Natural Idle with Contrapposto Weight Shifting & Multi-Joint Breathing
      this.smoothPosition(bones.hips, weightShift * 0.018, 0.95 + breath * 0.005, 0, 8.0, delta, 'fb_hips_pos');
      this.smoothRotate(bones.hips, 0.01, weightShift * 0.015, weightShift * 0.025, 8.0, delta, 'fb_hips');
      this.smoothRotate(bones.spine, 0.018 + breath * 0.018, -weightShift * 0.012, -weightShift * 0.02, 8.0, delta, 'fb_spine');

      this.smoothRotate(bones.leftLeg, -weightShift * 0.015, 0, -0.025 - weightShift * 0.02, 8.0, delta, 'fb_l_leg');
      this.smoothRotate(bones.rightLeg, weightShift * 0.015, 0, 0.025 - weightShift * 0.02, 8.0, delta, 'fb_r_leg');
      this.smoothRotate(bones.leftCalf, Math.max(0, -weightShift * 0.04), 0, 0, 8.0, delta, 'fb_l_calf');
      this.smoothRotate(bones.rightCalf, Math.max(0, weightShift * 0.04), 0, 0, 8.0, delta, 'fb_r_calf');

      this.smoothRotate(bones.leftArm, 0.04 + breath * 0.01, 0, 0.06 + breath * 0.012 - weightShift * 0.012, 8.0, delta, 'fb_l_arm');
      this.smoothRotate(bones.rightArm, 0.04 + breath * 0.01, 0, -0.06 - breath * 0.012 - weightShift * 0.012, 8.0, delta, 'fb_r_arm');

      this.smoothRotate(bones.leftForearm, -0.12 - breath * 0.012, 0, 0, 8.0, delta, 'fb_l_farm');
      this.smoothRotate(bones.rightForearm, -0.12 - breath * 0.012, 0, 0, 8.0, delta, 'fb_r_farm');

      if (!this.lookAtTarget) {
        this.smoothRotate(bones.head, microDriftY + breath * 0.006, microDriftX + weightShift * 0.008, 0, 8.0, delta, 'fb_head');
      }
    }

    // Gaze tracking
    if (this.lookAtTarget && bones.head) {
      const localTarget = this.lookAtTarget.clone();
      this.avatarRoot.worldToLocal(localTarget);
      const angleY = Math.atan2(localTarget.x, localTarget.z);
      const angleX = -Math.atan2(localTarget.y - 1.4, Math.sqrt(localTarget.x * localTarget.x + localTarget.z * localTarget.z));
      const targetHeadY = THREE.MathUtils.clamp(angleY + microDriftX, -Math.PI / 3, Math.PI / 3);
      const targetHeadX = THREE.MathUtils.clamp(angleX + microDriftY, -Math.PI / 4, Math.PI / 4);
      this.smoothRotate(bones.head, targetHeadX, targetHeadY, 0, this.lookDamping, delta, 'fb_head');
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
