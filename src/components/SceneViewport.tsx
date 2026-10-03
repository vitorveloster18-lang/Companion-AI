/**
 * SceneViewport: Three.js 3D Viewport with OrbitControls, Studio Lighting,
 * Floor Grid, Avatar lifecycle, and 2D Speech Bubble tracking.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AvatarController } from '../core/AvatarController';
import { ActionExecutor } from '../core/ActionExecutor';
import { AgentConnection } from '../core/AgentConnection';
import { WorldState, AvatarState } from '../core/WorldState';
import { SpeechBubble } from './SpeechBubble';
import { UploadCloud } from 'lucide-react';
import { Scene3DManager } from '../core/Scene3DManager';
import { SceneSoundtrackManager } from '../core/SceneSoundtrackManager';
import { MultiAvatarSceneGroup } from '../core/MultiAvatarSceneGroup';
import { MultiCDIManager } from '../core/MultiCDIManager';

interface SceneViewportProps {
  connection: AgentConnection;
  worldState: WorldState;
  soundtrackManager: SceneSoundtrackManager;
  multiCDIManager?: MultiCDIManager;
  onAvatarControllerReady: (controller: AvatarController, executor: ActionExecutor) => void;
  onScene3DManagerReady?: (manager: Scene3DManager) => void;
  onModelLoaded: (name: string) => void;
  onDropFile: (file: File) => void;
}

export const SceneViewport: React.FC<SceneViewportProps> = ({
  connection,
  worldState,
  soundtrackManager,
  multiCDIManager,
  onAvatarControllerReady,
  onScene3DManagerReady,
  onModelLoaded,
  onDropFile,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [headScreenPos, setHeadScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [currentAvatarState, setCurrentAvatarState] = useState<AvatarState>(worldState.getState());

  const controllerRef = useRef<AvatarController | null>(null);
  const executorRef = useRef<ActionExecutor | null>(null);
  const scene3DManagerRef = useRef<Scene3DManager | null>(null);
  const multiAvatarGroupRef = useRef<MultiAvatarSceneGroup | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Subscribe to WorldState updates
  useEffect(() => {
    return worldState.subscribe((state) => {
      setCurrentAvatarState(state);
    });
  }, [worldState]);

  // Subscribe to MultiCDIManager updates for Group View & Peer Bus Arcs
  useEffect(() => {
    if (!multiCDIManager) return;
    return multiCDIManager.subscribe((state) => {
      multiAvatarGroupRef.current?.setVisible(state.viewMode === 'group');
      if (state.currentPeerDialogue) {
        multiAvatarGroupRef.current?.triggerPeerDialogueBeam(
          state.currentPeerDialogue.from_id,
          state.currentPeerDialogue.to_id
        );
      }
    });
  }, [multiCDIManager]);

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030712); // Cyberpunk Obsidian Black
    scene.fog = new THREE.FogExp2(0x030712, 0.04);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 1.4, 3.8);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1.0, 0);
    controls.minDistance = 1.0;
    controls.maxDistance = 12.0;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Keep camera above ground
    controlsRef.current = controls;

    // 5. Cyberpunk Multi-Tone Lighting Setup
    // Cool Ambient fill
    const ambientLight = new THREE.AmbientLight(0x00f0ff, 0.4);
    scene.add(ambientLight);

    const warmAmbient = new THREE.AmbientLight(0x3b0764, 0.3);
    scene.add(warmAmbient);

    // Directional Key Light with shadow (Crisp Ice Blue)
    const keyLight = new THREE.DirectionalLight(0xe0f2fe, 2.4);
    keyLight.position.set(3.5, 6.0, 4.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 15;
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    // Cyber Rim Light 1: Electric Neon Cyan (Rear-Left)
    const cyanRimLight = new THREE.DirectionalLight(0x00f0ff, 2.2);
    cyanRimLight.position.set(-4.0, 4.5, -3.5);
    scene.add(cyanRimLight);

    // Cyber Rim Light 2: Vivid Neon Magenta (Rear-Right)
    const magentaRimLight = new THREE.DirectionalLight(0xff007f, 1.9);
    magentaRimLight.position.set(4.0, 3.5, -3.0);
    scene.add(magentaRimLight);

    // Soft fill from bottom-front
    const fillLight = new THREE.DirectionalLight(0x06b6d4, 0.5);
    fillLight.position.set(0, 0.5, 3.5);
    scene.add(fillLight);

    // 6. Cyberpunk Ground & Holographic Grid
    // Dark matte ground plane
    const floorGeo = new THREE.PlaneGeometry(50, 50);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x030712,
      roughness: 0.9,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    // Concentric Neon Rings
    const ringGeo = new THREE.RingGeometry(2.4, 2.45, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.003;
    scene.add(ring);

    const innerRingGeo = new THREE.RingGeometry(1.2, 1.23, 64);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xff007f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.003;
    scene.add(innerRing);

    // Cyberpunk Grid helper (Electric Cyan + Deep Navy)
    const grid = new THREE.GridHelper(24, 24, 0x00f0ff, 0x0f172a);
    grid.position.y = 0.004;
    scene.add(grid);

    // 6.5 Dynamic 3D Scene Manager (Environments, Lighting, Weather & Soundtracks)
    const scene3DManager = new Scene3DManager(scene, soundtrackManager);
    scene3DManagerRef.current = scene3DManager;
    onScene3DManagerReady?.(scene3DManager);

    // 6.6 Multi-Avatar Scene Group (Naia, Salem, Nova in Group View)
    const multiAvatarGroup = new MultiAvatarSceneGroup(scene);
    multiAvatarGroupRef.current = multiAvatarGroup;
    if (multiCDIManager) {
      multiAvatarGroup.setVisible(multiCDIManager.getViewMode() === 'group');
    }

    // 7. AvatarController & ActionExecutor
    const avatarController = new AvatarController({
      scene,
      onModelLoaded: (name) => {
        onModelLoaded(name);
      },
      onError: (err) => {
        console.error(err);
      },
    });
    controllerRef.current = avatarController;

    const actionExecutor = new ActionExecutor(connection, avatarController, worldState);
    executorRef.current = actionExecutor;

    onAvatarControllerReady(avatarController, actionExecutor);

    // 8. Animation Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    const tempHeadWorldPos = new THREE.Vector3();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      controls.update();
      avatarController.update(delta);
      actionExecutor.update(delta);
      scene3DManager.update(delta);
      multiAvatarGroup.update(delta);

      renderer.render(scene, camera);

      // Project head world position to 2D screen space for speech bubble
      if (avatarController) {
        const rootPos = avatarController.getPosition();
        tempHeadWorldPos.set(rootPos.x, rootPos.y + 1.85, rootPos.z);
        tempHeadWorldPos.project(camera);

        // Check if in front of camera
        if (tempHeadWorldPos.z < 1.0) {
          const sx = (tempHeadWorldPos.x * 0.5 + 0.5) * container.clientWidth;
          const sy = (-(tempHeadWorldPos.y * 0.5) + 0.5) * container.clientHeight;
          setHeadScreenPos({ x: sx, y: sy });
        }
      }
    };

    animate();

    // 9. Resize handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      avatarController.dispose();
      renderer.dispose();
    };
  }, []);

  // Drag & Drop handlers for .vrm files
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.name.toLowerCase().endsWith('.vrm') || file.name.toLowerCase().endsWith('.glb')) {
          onDropFile(file);
        } else {
          alert('Por favor, selecione um arquivo válido .vrm');
        }
      }
    },
    [onDropFile]
  );

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative w-full h-full overflow-hidden select-none"
    >
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing outline-none" />

      {/* Floating Speech Bubble */}
      <SpeechBubble
        text={currentAvatarState.speakText}
        visible={currentAvatarState.isSpeaking}
        screenPos={headScreenPos}
      />

      {/* Drag & Drop Visual Backdrop */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm border-2 border-dashed border-sky-400 m-4 rounded-2xl pointer-events-none">
          <UploadCloud className="w-16 h-16 text-sky-400 animate-bounce mb-3" />
          <p className="text-base font-semibold text-white">Solte o arquivo .VRM aqui</p>
          <p className="text-xs text-slate-400 mt-1">O modelo será carregado imediatamente no corpo do agente</p>
        </div>
      )}
    </div>
  );
};
