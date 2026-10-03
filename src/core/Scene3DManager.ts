/**
 * Scene3DManager: Dynamically creates and manages customizable 3D environments,
 * atmospheric lighting, weather particle systems, and props based on CDI Affect & State:
 * - CDI feliz: bright_room (sala iluminada, flores, pólen dourado, luz solar)
 * - CDI em luto: dark_grief_room (sala escura, chuva realista na janela, partículas de chuva)
 * - CDI a dormir: bedroom_night (quarto noturno, lua volumétrica, estrelas, luar suave)
 * - CDI em conversa activa: cozy_room (sala acolhedora, lareira crepitante com chamas 3D)
 * - CDI a criar: creative_studio (estúdio de arte/atelier, cavalete de pintura, livros e materiais)
 */

import * as THREE from 'three';
import { SceneSetMessage } from '../types/protocol';
import { SceneSoundtrackManager } from './SceneSoundtrackManager';

export interface SceneConfig {
  environment: 'cozy_room' | 'bright_room' | 'dark_grief_room' | 'bedroom_night' | 'creative_studio' | string;
  lighting: 'warm_evening' | 'bright_day' | 'dim_somber' | 'moonlight_night' | 'fireplace_glow' | 'studio_bright' | string;
  weather: 'clear' | 'rain' | 'snow' | 'storm' | 'gentle_breeze' | string;
  music: string;
}

export type SceneChangeListener = (config: SceneConfig) => void;

export class Scene3DManager {
  private scene: THREE.Scene;
  private currentConfig: SceneConfig;
  private soundtrack: SceneSoundtrackManager;
  private listeners: Set<SceneChangeListener> = new Set();

  // Root environment group containing dynamic 3D props
  private envGroup: THREE.Group;

  // Scene Specific Prop Groups
  private happyProps: THREE.Group;
  private griefProps: THREE.Group;
  private sleepProps: THREE.Group;
  private cozyProps: THREE.Group;
  private studioProps: THREE.Group;

  // Lighting References
  private mainAmbientLight: THREE.AmbientLight;
  private mainSunLight: THREE.DirectionalLight;
  private rimLight1: THREE.DirectionalLight;
  private rimLight2: THREE.DirectionalLight;
  private fireplacePointLight: THREE.PointLight;

  // Particle Systems
  private rainParticles: THREE.Points | null = null;
  private rainPositions: Float32Array | null = null;
  private fireParticles: THREE.Points | null = null;
  private firePositions: Float32Array | null = null;
  private dustParticles: THREE.Points | null = null;
  private dustPositions: Float32Array | null = null;

  // Rain Window Mesh
  private windowMesh: THREE.Mesh | null = null;

  // Target lighting for smooth cross-fades
  private targetAmbientColor = new THREE.Color(0x00f0ff);
  private targetSunColor = new THREE.Color(0xe0f2fe);
  private targetRim1Color = new THREE.Color(0x00f0ff);
  private targetRim2Color = new THREE.Color(0xff007f);
  private targetSunIntensity = 2.4;
  private targetAmbientIntensity = 0.4;
  private targetFogColor = new THREE.Color(0x030712);

  // Auto affect sync enabled
  private isAutoAffectSync: boolean = true;

  constructor(scene: THREE.Scene, soundtrack: SceneSoundtrackManager) {
    this.scene = scene;
    this.soundtrack = soundtrack;
    this.envGroup = new THREE.Group();
    this.scene.add(this.envGroup);

    this.happyProps = new THREE.Group();
    this.griefProps = new THREE.Group();
    this.sleepProps = new THREE.Group();
    this.cozyProps = new THREE.Group();
    this.studioProps = new THREE.Group();

    this.envGroup.add(this.happyProps);
    this.envGroup.add(this.griefProps);
    this.envGroup.add(this.sleepProps);
    this.envGroup.add(this.cozyProps);
    this.envGroup.add(this.studioProps);

    // Initial default setup
    this.currentConfig = {
      environment: 'cozy_room',
      lighting: 'warm_evening',
      weather: 'clear',
      music: 'fireplace_crackle',
    };

    // Lights
    this.mainAmbientLight = new THREE.AmbientLight(0xffeedd, 0.4);
    this.scene.add(this.mainAmbientLight);

    this.mainSunLight = new THREE.DirectionalLight(0xffeedd, 2.0);
    this.mainSunLight.position.set(3.5, 6.0, 4.0);
    this.mainSunLight.castShadow = true;
    this.scene.add(this.mainSunLight);

    this.rimLight1 = new THREE.DirectionalLight(0xffaa55, 1.8);
    this.rimLight1.position.set(-4.0, 4.5, -3.5);
    this.scene.add(this.rimLight1);

    this.rimLight2 = new THREE.DirectionalLight(0xff5533, 1.5);
    this.rimLight2.position.set(4.0, 3.5, -3.0);
    this.scene.add(this.rimLight2);

    this.fireplacePointLight = new THREE.PointLight(0xff6600, 2.5, 8);
    this.fireplacePointLight.position.set(0, 0.6, -2.2);
    this.scene.add(this.fireplacePointLight);

    this.buildHappyProps();
    this.buildGriefProps();
    this.buildSleepProps();
    this.buildCozyProps();
    this.buildStudioProps();

    // Set initial environment
    this.applyEnvironment('cozy_room', false);
  }

  public subscribe(listener: SceneChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.currentConfig);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentConfig);
    }
  }

  public setAutoAffectSync(auto: boolean): void {
    this.isAutoAffectSync = auto;
  }

  public getIsAutoAffectSync(): boolean {
    return this.isAutoAffectSync;
  }

  public getCurrentConfig(): SceneConfig {
    return { ...this.currentConfig };
  }

  /**
   * Automatically select environment from CDI affect or mode
   */
  public handleCDIAffectChange(affect: string, mode?: string, isSpeaking?: boolean): void {
    if (!this.isAutoAffectSync) return;

    const normalizedAffect = (affect || '').toLowerCase();
    const normalizedMode = (mode || '').toLowerCase();

    if (normalizedMode === 'sleep' || normalizedMode === 'dream' || normalizedAffect === 'sleeping') {
      this.setScene({
        environment: 'bedroom_night',
        lighting: 'moonlight_night',
        weather: 'clear',
        music: 'gentle_lullaby',
      });
    } else if (normalizedAffect === 'grief' || normalizedAffect === 'melancholic' || normalizedAffect === 'sad') {
      this.setScene({
        environment: 'dark_grief_room',
        lighting: 'dim_somber',
        weather: 'rain',
        music: 'rain',
      });
    } else if (
      normalizedAffect === 'happy' ||
      normalizedAffect === 'wondering' ||
      normalizedAffect === 'joy' ||
      normalizedAffect === 'peaceful'
    ) {
      this.setScene({
        environment: 'bright_room',
        lighting: 'bright_day',
        weather: 'clear',
        music: 'ambient_calm',
      });
    } else if (normalizedAffect === 'creating' || normalizedAffect === 'inspired' || normalizedAffect === 'curious') {
      this.setScene({
        environment: 'creative_studio',
        lighting: 'studio_bright',
        weather: 'clear',
        music: 'creative_pulse',
      });
    } else if (isSpeaking || normalizedAffect === 'conversing' || normalizedAffect === 'active') {
      this.setScene({
        environment: 'cozy_room',
        lighting: 'fireplace_glow',
        weather: 'gentle_breeze',
        music: 'fireplace_crackle',
      });
    }
  }

  /**
   * Protocol "scene.set" handler
   */
  public handleSceneSetMessage(msg: SceneSetMessage): void {
    this.setScene({
      environment: msg.environment,
      lighting: msg.lighting,
      weather: msg.weather,
      music: msg.music || 'ambient_calm',
    });
  }

  public setScene(config: Partial<SceneConfig>): void {
    this.currentConfig = {
      ...this.currentConfig,
      ...config,
    };

    this.applyEnvironment(this.currentConfig.environment, true);
    this.applyLighting(this.currentConfig.lighting);
    this.applyWeather(this.currentConfig.weather);

    if (this.currentConfig.music) {
      this.soundtrack.playTrack(this.currentConfig.music);
    }

    this.notify();
  }

  // --- 1. Happy Props (Flores, Vasos botânicos, Luz Dourada) ---
  private buildHappyProps(): void {
    // Flower pedestals
    const pedestalGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.8, 16);
    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.6 });

    // Left Pedestal
    const leftPed = new THREE.Mesh(pedestalGeo, pedestalMat);
    leftPed.position.set(-1.6, 0.4, -0.8);
    leftPed.castShadow = true;
    leftPed.receiveShadow = true;
    this.happyProps.add(leftPed);

    // Right Pedestal
    const rightPed = new THREE.Mesh(pedestalGeo, pedestalMat);
    rightPed.position.set(1.6, 0.4, -0.8);
    rightPed.castShadow = true;
    rightPed.receiveShadow = true;
    this.happyProps.add(rightPed);

    // Flowers in left pot
    const leftPot = this.createFlowerVase(0xff6b81, 0xffd166);
    leftPot.position.set(-1.6, 0.8, -0.8);
    this.happyProps.add(leftPot);

    // Flowers in right pot
    const rightPot = this.createFlowerVase(0x06d6a0, 0x118ab2);
    rightPot.position.set(1.6, 0.8, -0.8);
    this.happyProps.add(rightPot);

    // Cozy Floral floor rug
    const rugGeo = new THREE.CircleGeometry(1.6, 32);
    const rugMat = new THREE.MeshStandardMaterial({
      color: 0xfaedcd,
      roughness: 0.9,
    });
    const rug = new THREE.Mesh(rugGeo, rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.005, 0);
    rug.receiveShadow = true;
    this.happyProps.add(rug);

    // Floating Golden Dust particles
    const dustCount = 80;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 6;
      dustPos[i * 3 + 1] = Math.random() * 3 + 0.2;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 5;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xffe066,
      size: 0.04,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    this.dustParticles = new THREE.Points(dustGeo, dustMat);
    this.dustPositions = dustPos;
    this.happyProps.add(this.dustParticles);
  }

  private createFlowerVase(petalColor1: number, petalColor2: number): THREE.Group {
    const group = new THREE.Group();

    // Ceramic Vase
    const vaseGeo = new THREE.CylinderGeometry(0.14, 0.08, 0.35, 16);
    const vaseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const vase = new THREE.Mesh(vaseGeo, vaseMat);
    vase.position.y = 0.17;
    group.add(vase);

    // Stems & Blossom Flowers
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.8 });
    const petalMat1 = new THREE.MeshStandardMaterial({ color: petalColor1, roughness: 0.4 });
    const petalMat2 = new THREE.MeshStandardMaterial({ color: petalColor2, roughness: 0.4 });

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const r = 0.06;

      // Stem
      const stemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.35, 8);
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.set(Math.cos(angle) * r, 0.38, Math.sin(angle) * r);
      stem.rotation.z = (Math.random() - 0.5) * 0.3;
      stem.rotation.x = (Math.random() - 0.5) * 0.3;
      group.add(stem);

      // Petal head
      const blossomGeo = new THREE.SphereGeometry(0.045, 8, 8);
      const blossom = new THREE.Mesh(blossomGeo, i % 2 === 0 ? petalMat1 : petalMat2);
      blossom.position.set(stem.position.x * 1.2, 0.52, stem.position.z * 1.2);
      group.add(blossom);
    }

    return group;
  }

  // --- 2. Grief Props (Janela com Chuva, Tons Escuros, Gotas) ---
  private buildGriefProps(): void {
    // Large window frame behind avatar
    const windowFrameGeo = new THREE.BoxGeometry(3.6, 2.6, 0.08);
    const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const windowFrame = new THREE.Mesh(windowFrameGeo, windowFrameMat);
    windowFrame.position.set(0, 1.6, -2.5);
    this.griefProps.add(windowFrame);

    // Glass pane with rain texture shader/material
    const glassGeo = new THREE.PlaneGeometry(3.2, 2.2);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.75,
    });
    this.windowMesh = new THREE.Mesh(glassGeo, glassMat);
    this.windowMesh.position.set(0, 1.6, -2.44);
    this.griefProps.add(this.windowMesh);

    // Window Divider Bars (cross)
    const barMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    const horizBar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.05, 0.05), barMat);
    horizBar.position.set(0, 1.6, -2.42);
    const vertBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.2, 0.05), barMat);
    vertBar.position.set(0, 1.6, -2.42);
    this.griefProps.add(horizBar);
    this.griefProps.add(vertBar);

    // Falling Rain particle system
    const rainCount = 1200;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 8;
      rainPos[i * 3 + 1] = Math.random() * 5;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x60a5fa,
      size: 0.03,
      transparent: true,
      opacity: 0.65,
    });
    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.rainPositions = rainPos;
    this.griefProps.add(this.rainParticles);
  }

  // --- 3. Sleep Props (Quarto Noturno, Lua Volumétrica, Estrelas) ---
  private buildSleepProps(): void {
    // Volumetric Crescent Moon
    const moonGeo = new THREE.SphereGeometry(0.65, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 0.6,
      roughness: 0.8,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(1.8, 3.2, -3.2);
    this.sleepProps.add(moon);

    // Starfield in night sky
    const starCount = 350;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 14;
      starPos[i * 3 + 1] = Math.random() * 6 + 1.2;
      starPos[i * 3 + 2] = -3.8 - Math.random() * 3;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xe0e7ff,
      size: 0.035,
      transparent: true,
      opacity: 0.8,
    });
    const stars = new THREE.Points(starGeo, starMat);
    this.sleepProps.add(stars);

    // Night Bedside Rug
    const bedRugGeo = new THREE.PlaneGeometry(2.4, 1.8);
    const bedRugMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      roughness: 0.9,
    });
    const bedRug = new THREE.Mesh(bedRugGeo, bedRugMat);
    bedRug.rotation.x = -Math.PI / 2;
    bedRug.position.set(0, 0.005, -0.4);
    this.sleepProps.add(bedRug);
  }

  // --- 4. Cozy Room Props (Lareira de Pedra, Fogo 3D Crepitante) ---
  private buildCozyProps(): void {
    const fireplaceGroup = new THREE.Group();
    fireplaceGroup.position.set(0, 0, -2.4);

    // Hearth Frame
    const hearthFrameGeo = new THREE.BoxGeometry(2.2, 1.6, 0.6);
    const hearthMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.8,
    });
    const hearthFrame = new THREE.Mesh(hearthFrameGeo, hearthMat);
    hearthFrame.position.y = 0.8;
    fireplaceGroup.add(hearthFrame);

    // Fireplace Cavity
    const cavityGeo = new THREE.BoxGeometry(1.4, 0.9, 0.4);
    const cavityMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const cavity = new THREE.Mesh(cavityGeo, cavityMat);
    cavity.position.set(0, 0.6, 0.15);
    fireplaceGroup.add(cavity);

    // Wooden Fire Logs
    const logMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
    const log1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8), logMat);
    log1.rotation.z = Math.PI / 2;
    log1.rotation.y = 0.2;
    log1.position.set(0, 0.3, 0.15);
    fireplaceGroup.add(log1);

    const log2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 8), logMat);
    log2.rotation.z = Math.PI / 2 - 0.3;
    log2.rotation.y = -0.3;
    log2.position.set(0.05, 0.38, 0.16);
    fireplaceGroup.add(log2);

    // Fire Flame Particles (rising amber/orange flames)
    const fireCount = 140;
    const fireGeo = new THREE.BufferGeometry();
    const firePos = new Float32Array(fireCount * 3);
    for (let i = 0; i < fireCount; i++) {
      firePos[i * 3] = (Math.random() - 0.5) * 0.6;
      firePos[i * 3 + 1] = 0.35 + Math.random() * 0.45;
      firePos[i * 3 + 2] = 0.15 + (Math.random() - 0.5) * 0.15;
    }
    fireGeo.setAttribute('position', new THREE.BufferAttribute(firePos, 3));
    const fireMat = new THREE.PointsMaterial({
      color: 0xf97316,
      size: 0.08,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    this.fireParticles = new THREE.Points(fireGeo, fireMat);
    this.firePositions = firePos;
    fireplaceGroup.add(this.fireParticles);

    this.cozyProps.add(fireplaceGroup);

    // Warm Wooden Floor Rug
    const cozyRugGeo = new THREE.CircleGeometry(1.8, 32);
    const cozyRugMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.85,
    });
    const cozyRug = new THREE.Mesh(cozyRugGeo, cozyRugMat);
    cozyRug.rotation.x = -Math.PI / 2;
    cozyRug.position.set(0, 0.005, 0);
    this.cozyProps.add(cozyRug);
  }

  // --- 5. Creative Studio Props (Atelier, Cavalete, Tela Pintada, Livros) ---
  private buildStudioProps(): void {
    const studioGroup = new THREE.Group();
    studioGroup.position.set(1.5, 0, -1.2);

    // Wooden Easel (Cavalete)
    const easelMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.7 });
    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 8), easelMat);
    leg1.position.set(-0.35, 0.9, -0.15);
    leg1.rotation.z = -0.12;
    studioGroup.add(leg1);

    const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 8), easelMat);
    leg2.position.set(0.35, 0.9, -0.15);
    leg2.rotation.z = 0.12;
    studioGroup.add(leg2);

    const backLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 8), easelMat);
    backLeg.position.set(0, 0.9, -0.5);
    backLeg.rotation.x = -0.25;
    studioGroup.add(backLeg);

    // Canvas on Easel (with abstract colorful painting)
    const canvasGeo = new THREE.BoxGeometry(0.7, 0.9, 0.03);
    const canvasMat = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      roughness: 0.4,
    });
    const canvas = new THREE.Mesh(canvasGeo, canvasMat);
    canvas.position.set(0, 1.15, -0.1);
    canvas.rotation.x = -0.08;
    studioGroup.add(canvas);

    // Bookshelf on the left
    const shelfGroup = new THREE.Group();
    shelfGroup.position.set(-1.8, 0, -1.4);

    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const shelfFrame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.3), shelfMat);
    shelfFrame.position.y = 0.8;
    shelfGroup.add(shelfFrame);

    // Colorful books on shelf
    const bookColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6];
    for (let i = 0; i < 5; i++) {
      const bookGeo = new THREE.BoxGeometry(0.08, 0.28, 0.22);
      const bookMat = new THREE.MeshStandardMaterial({ color: bookColors[i % bookColors.length] });
      const book = new THREE.Mesh(bookGeo, bookMat);
      book.position.set(-0.25 + i * 0.12, 0.75, 0.02);
      shelfGroup.add(book);
    }

    this.studioProps.add(studioGroup);
    this.studioProps.add(shelfGroup);
  }

  // --- Environment Switcher ---
  private applyEnvironment(env: string, animated = true): void {
    this.happyProps.visible = env === 'bright_room';
    this.griefProps.visible = env === 'dark_grief_room';
    this.sleepProps.visible = env === 'bedroom_night';
    this.cozyProps.visible = env === 'cozy_room';
    this.studioProps.visible = env === 'creative_studio';

    if (env === 'cozy_room') {
      this.fireplacePointLight.visible = true;
    } else {
      this.fireplacePointLight.visible = false;
    }
  }

  // --- Lighting Presets ---
  private applyLighting(lighting: string): void {
    switch (lighting) {
      case 'bright_day':
        this.targetAmbientColor.setHex(0xffffff);
        this.targetAmbientIntensity = 0.7;
        this.targetSunColor.setHex(0xfef08a); // Warm Sunlight
        this.targetSunIntensity = 2.8;
        this.targetRim1Color.setHex(0x38bdf8); // Sky blue
        this.targetRim2Color.setHex(0xf43f5e); // Rose glow
        this.targetFogColor.setHex(0x0c1222);
        break;

      case 'dim_somber':
        this.targetAmbientColor.setHex(0x1e293b);
        this.targetAmbientIntensity = 0.2;
        this.targetSunColor.setHex(0x475569);
        this.targetSunIntensity = 0.6;
        this.targetRim1Color.setHex(0x2563eb);
        this.targetRim2Color.setHex(0x0f172a);
        this.targetFogColor.setHex(0x020617);
        break;

      case 'moonlight_night':
        this.targetAmbientColor.setHex(0x0f172a);
        this.targetAmbientIntensity = 0.25;
        this.targetSunColor.setHex(0xdbeafe); // Moon beam
        this.targetSunIntensity = 1.3;
        this.targetRim1Color.setHex(0x6366f1); // Indigo
        this.targetRim2Color.setHex(0x38bdf8); // Cyan
        this.targetFogColor.setHex(0x02040a);
        break;

      case 'studio_bright':
        this.targetAmbientColor.setHex(0x818cf8);
        this.targetAmbientIntensity = 0.5;
        this.targetSunColor.setHex(0xf8fafc);
        this.targetSunIntensity = 2.5;
        this.targetRim1Color.setHex(0xa855f7); // Purple
        this.targetRim2Color.setHex(0x06b6d4); // Cyan
        this.targetFogColor.setHex(0x0b0f19);
        break;

      case 'warm_evening':
      case 'fireplace_glow':
      default:
        this.targetAmbientColor.setHex(0xffedd5);
        this.targetAmbientIntensity = 0.45;
        this.targetSunColor.setHex(0xf97316); // Amber Sunset
        this.targetSunIntensity = 2.2;
        this.targetRim1Color.setHex(0xfbbf24); // Golden
        this.targetRim2Color.setHex(0xef4444); // Ember red
        this.targetFogColor.setHex(0x0a0503);
        break;
    }
  }

  // --- Weather Presets ---
  private applyWeather(weather: string): void {
    if (this.rainParticles) {
      this.rainParticles.visible = weather === 'rain' || weather === 'storm';
    }
  }

  /**
   * Animation tick to update particles and smooth light transitions
   */
  public update(delta: number): void {
    // 1. Lerp Lighting Colors & Intensities
    this.mainAmbientLight.color.lerp(this.targetAmbientColor, 0.05);
    this.mainAmbientLight.intensity = THREE.MathUtils.lerp(
      this.mainAmbientLight.intensity,
      this.targetAmbientIntensity,
      0.05
    );

    this.mainSunLight.color.lerp(this.targetSunColor, 0.05);
    this.mainSunLight.intensity = THREE.MathUtils.lerp(
      this.mainSunLight.intensity,
      this.targetSunIntensity,
      0.05
    );

    this.rimLight1.color.lerp(this.targetRim1Color, 0.05);
    this.rimLight2.color.lerp(this.targetRim2Color, 0.05);

    if (this.scene.fog && 'color' in this.scene.fog) {
      (this.scene.fog as THREE.FogExp2).color.lerp(this.targetFogColor, 0.05);
    }

    // 2. Fireplace point light natural flicker
    if (this.fireplacePointLight.visible) {
      const flicker = 2.2 + Math.sin(performance.now() * 0.015) * 0.4 + (Math.random() - 0.5) * 0.3;
      this.fireplacePointLight.intensity = flicker;
    }

    // 3. Update Rain Particles
    if (this.rainParticles && this.rainParticles.visible && this.rainPositions) {
      const count = this.rainPositions.length / 3;
      for (let i = 0; i < count; i++) {
        const yIndex = i * 3 + 1;
        this.rainPositions[yIndex] -= delta * 7.5; // Fall speed
        if (this.rainPositions[yIndex] < 0) {
          this.rainPositions[yIndex] = 4.5 + Math.random() * 0.5;
        }
      }
      this.rainParticles.geometry.attributes.position.needsUpdate = true;
    }

    // 4. Update Fire Flame Particles
    if (this.fireParticles && this.cozyProps.visible && this.firePositions) {
      const count = this.firePositions.length / 3;
      for (let i = 0; i < count; i++) {
        const yIndex = i * 3 + 1;
        this.firePositions[yIndex] += delta * 0.8;
        if (this.firePositions[yIndex] > 0.85) {
          this.firePositions[yIndex] = 0.35;
          this.firePositions[i * 3] = (Math.random() - 0.5) * 0.5;
        }
      }
      this.fireParticles.geometry.attributes.position.needsUpdate = true;
    }

    // 5. Update Golden Dust Particles
    if (this.dustParticles && this.happyProps.visible && this.dustPositions) {
      const count = this.dustPositions.length / 3;
      for (let i = 0; i < count; i++) {
        const yIndex = i * 3 + 1;
        this.dustPositions[yIndex] += Math.sin(performance.now() * 0.001 + i) * 0.001;
      }
      this.dustParticles.geometry.attributes.position.needsUpdate = true;
    }
  }
}
