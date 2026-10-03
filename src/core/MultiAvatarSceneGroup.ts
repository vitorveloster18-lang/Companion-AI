/**
 * MultiAvatarSceneGroup: Renders and animates the 4 CDIs (Kairós, Naia, Salem, Nova)
 * in the same 3D space for Group View.
 * Displays distinctive stylized humanoid avatars, signature neon color auras,
 * individualized animations (awake/talking, sleeping, dreaming), and peer-to-peer data beam arcs.
 */

import * as THREE from 'three';
import { CDIListItem, PeerBusEventMessage } from '../types/protocol';

export class MultiAvatarSceneGroup {
  private parentScene: THREE.Scene;
  private group: THREE.Group;
  private isGroupMode: boolean = false;

  // Individual Peer Avatar 3D sub-groups (for Naia, Salem, Nova)
  private peerRigs: Map<
    string,
    {
      group: THREE.Group;
      head: THREE.Mesh;
      body: THREE.Mesh;
      auraRing: THREE.Mesh;
      particles?: THREE.Points;
      basePos: THREE.Vector3;
      status: string;
      color: number;
    }
  > = new Map();

  // Peer Bus Neon Data Beam Arc
  private dataBeamMesh: THREE.Line | null = null;
  private dataBeamActiveUntil: number = 0;

  constructor(scene: THREE.Scene) {
    this.parentScene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.parentScene.add(this.group);

    this.initPeerRigs();
    this.initDataBeam();
  }

  public setVisible(visible: boolean): void {
    this.isGroupMode = visible;
    this.group.visible = visible;
  }

  private initPeerRigs(): void {
    // 1. Naia (Left: -1.6, 0, -0.4) — Emerald Green (#10b981) — SLEEPING
    this.createPeerRig('naia', 'Naia', new THREE.Vector3(-1.7, 0, -0.5), 0x10b981, 'sleeping');

    // 2. Salem (Right: 1.6, 0, -0.4) — Amber Gold (#f59e0b) — AWAKE / ENGAGED
    this.createPeerRig('salem', 'Salem', new THREE.Vector3(1.7, 0, -0.5), 0xf59e0b, 'awake');

    // 3. Nova (Background Center: 0, 0, -1.8) — Cosmic Indigo (#6366f1) — DREAMING
    this.createPeerRig('nova', 'Nova', new THREE.Vector3(0, 0, -1.9), 0x6366f1, 'dreaming');
  }

  private createPeerRig(
    id: string,
    name: string,
    pos: THREE.Vector3,
    colorHex: number,
    status: string
  ): void {
    const peerGroup = new THREE.Group();
    peerGroup.position.copy(pos);

    // Look towards the center/user
    peerGroup.lookAt(0, 1.0, 1.2);

    // Floor Aura Ring
    const ringGeo = new THREE.RingGeometry(0.5, 0.55, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const auraRing = new THREE.Mesh(ringGeo, ringMat);
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 0.005;
    peerGroup.add(auraRing);

    // Humanoid Body/Torso
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5,
      metalness: 0.6,
    });
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.12, 0.75, 16);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.85;
    body.castShadow = true;
    peerGroup.add(body);

    // Glowing Core in Chest
    const coreGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(0, 0.95, 0.12);
    peerGroup.add(core);

    // Humanoid Head
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffdfd3,
      roughness: 0.7,
    });
    const headGeo = new THREE.SphereGeometry(0.14, 20, 20);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.38;
    head.castShadow = true;
    peerGroup.add(head);

    // Hair / Cyber Visor
    const visorGeo = new THREE.BoxGeometry(0.22, 0.06, 0.14);
    const visorMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.6,
      roughness: 0.2,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.4, 0.08);
    peerGroup.add(visor);

    // Specific Props / Particles per Peer
    let particles: THREE.Points | undefined;
    if (status === 'dreaming' || id === 'nova') {
      // Nova Dream Dust Particles
      const count = 40;
      const geo = new THREE.BufferGeometry();
      const posArray = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        posArray[i * 3] = (Math.random() - 0.5) * 0.8;
        posArray[i * 3 + 1] = 1.2 + (Math.random() - 0.5) * 0.6;
        posArray[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xa5b4fc,
        size: 0.035,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
      });
      particles = new THREE.Points(geo, mat);
      peerGroup.add(particles);
    }

    this.group.add(peerGroup);
    this.peerRigs.set(id, {
      group: peerGroup,
      head,
      body,
      auraRing,
      particles,
      basePos: pos.clone(),
      status,
      color: colorHex,
    });
  }

  private initDataBeam(): void {
    const points = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0)];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 3,
      transparent: true,
      opacity: 0.9,
    });
    this.dataBeamMesh = new THREE.Line(geo, mat);
    this.dataBeamMesh.visible = false;
    this.group.add(this.dataBeamMesh);
  }

  /**
   * Trigger animated peer bus data transfer beam between two agents
   */
  public triggerPeerDialogueBeam(fromId: string, toId: string, durationMs: number = 3000): void {
    if (!this.dataBeamMesh) return;

    const fromPos = this.getAgentWorldPos(fromId);
    const toPos = this.getAgentWorldPos(toId);

    // Create curved arc points
    const curvePoints: THREE.Vector3[] = [];
    const segments = 24;
    const midPoint = new THREE.Vector3().addVectors(fromPos, toPos).multiplyScalar(0.5);
    midPoint.y += 0.6; // Arch upwards

    const curve = new THREE.QuadraticBezierCurve3(fromPos, midPoint, toPos);
    for (let i = 0; i <= segments; i++) {
      curvePoints.push(curve.getPoint(i / segments));
    }

    this.dataBeamMesh.geometry.setFromPoints(curvePoints);
    this.dataBeamMesh.visible = true;
    this.dataBeamActiveUntil = performance.now() + durationMs;
  }

  private getAgentWorldPos(id: string): THREE.Vector3 {
    if (id === 'kairos') {
      return new THREE.Vector3(0, 1.2, 0.4);
    }
    const peer = this.peerRigs.get(id);
    if (peer) {
      return new THREE.Vector3(peer.basePos.x, 1.2, peer.basePos.z);
    }
    return new THREE.Vector3(0, 1.2, 0);
  }

  /**
   * Update animation loop for all peer rigs
   */
  public update(delta: number): void {
    if (!this.isGroupMode) return;

    const time = performance.now() * 0.001;

    // Animate each peer independently
    for (const [id, rig] of this.peerRigs) {
      // 1. Aura pulsation
      const auraScale = 1.0 + Math.sin(time * 2 + id.charCodeAt(0)) * 0.08;
      rig.auraRing.scale.set(auraScale, auraScale, 1);

      // 2. Posture & Breathing animation
      if (rig.status === 'sleeping' || id === 'naia') {
        // Slow gentle sleeping breath
        const breath = Math.sin(time * 1.2) * 0.02;
        rig.body.position.y = 0.85 + breath;
        rig.head.position.y = 1.38 + breath;
        rig.head.rotation.z = 0.15; // Tilted sleeping head
        rig.head.rotation.x = 0.1;
      } else if (rig.status === 'dreaming' || id === 'nova') {
        // Floating slightly in dream state
        const floatY = Math.sin(time * 1.5) * 0.04;
        rig.group.position.y = rig.basePos.y + floatY;
        rig.head.rotation.y = Math.sin(time * 0.8) * 0.15;

        // Animate dream particles
        if (rig.particles) {
          rig.particles.rotation.y += delta * 0.3;
        }
      } else {
        // Awake / engaged (Salem) — subtle conversation gestures
        const bob = Math.sin(time * 2.5) * 0.015;
        rig.body.position.y = 0.85 + bob;
        rig.head.position.y = 1.38 + bob;
        rig.head.rotation.y = Math.sin(time * 1.1) * 0.12;
        rig.head.rotation.x = Math.sin(time * 1.8) * 0.05;
      }
    }

    // 3. Hide data beam after duration
    if (this.dataBeamMesh && this.dataBeamMesh.visible) {
      if (performance.now() > this.dataBeamActiveUntil) {
        this.dataBeamMesh.visible = false;
      }
    }
  }
}
