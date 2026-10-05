/**
 * MultiAvatarSceneGroup: Dynamically renders and animates secondary peer avatars in 3D
 * space for Group View based strictly on the user's created bots.
 * Displays distinctive stylized humanoid avatars, signature neon color auras,
 * individualized animations, dynamic 3D name badges, and peer-to-peer data beam arcs.
 */

import * as THREE from 'three';
import { CDIListItem, PeerBusEventMessage } from '../types/protocol';

export class MultiAvatarSceneGroup {
  private parentScene: THREE.Scene;
  private group: THREE.Group;
  private isGroupMode: boolean = false;
  private currentCDIs: CDIListItem[] = [];
  private activeMainId: string = '';

  // Dynamic Peer Avatar 3D sub-groups
  private peerRigs: Map<
    string,
    {
      group: THREE.Group;
      head: THREE.Mesh;
      body: THREE.Mesh;
      auraRing: THREE.Mesh;
      nameSprite?: THREE.Sprite;
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
    this.group.name = 'MultiAvatarGroup';
    this.group.visible = false;
    this.parentScene.add(this.group);

    this.initDataBeam();
  }

  public setVisible(visible: boolean): void {
    this.isGroupMode = visible;
    this.group.visible = visible;
  }

  /**
   * Synchronizes the 3D peer avatars with the actual bots created in the interface
   */
  public syncCDIs(cdis: CDIListItem[], activeId: string): void {
    this.currentCDIs = cdis;
    this.activeMainId = activeId;

    // Filter out the primary active bot which is already rendered by AvatarController in the center
    const peerBots = cdis.filter((c) => c.id !== activeId);

    // Identify which existing rigs should be kept vs removed
    const incomingIds = new Set(peerBots.map((b) => b.id));

    // Remove obsolete rigs
    for (const [id, rig] of this.peerRigs.entries()) {
      if (!incomingIds.has(id)) {
        this.group.remove(rig.group);
        rig.group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
        });
        this.peerRigs.delete(id);
      }
    }

    // Positions in a smooth arc around the studio (radius ~2.2m)
    const count = peerBots.length;
    peerBots.forEach((bot, index) => {
      // Calculate arc position: distribute evenly between -60 deg and +60 deg
      let angle = 0;
      if (count === 1) {
        angle = Math.PI / 4; // 45 deg right
      } else {
        const span = Math.PI * 0.7; // ~126 deg total arc
        const step = span / (count - 1 || 1);
        angle = -span / 2 + index * step;
      }

      const radius = 2.1;
      const posX = Math.sin(angle) * radius;
      const posZ = -Math.cos(angle) * radius + 0.8;
      const targetPos = new THREE.Vector3(posX, 0, posZ);

      const colorHex = parseInt(bot.avatar_color?.replace('#', '') || '06b6d4', 16);

      if (this.peerRigs.has(bot.id)) {
        // Update existing rig position & status
        const rig = this.peerRigs.get(bot.id)!;
        rig.group.position.copy(targetPos);
        rig.basePos.copy(targetPos);
        rig.status = bot.status;
      } else {
        // Create new rig
        this.createPeerRig(bot.id, bot.name, targetPos, colorHex, bot.status);
      }
    });
  }

  private createNameSprite(name: string, colorHex: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(3, 7, 18, 0.85)';
      ctx.strokeStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(8, 8, 240, 48, 12);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name.toUpperCase(), 128, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.8, 0.2, 1);
    sprite.position.set(0, 1.75, 0);
    return sprite;
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
    const ringGeo = new THREE.RingGeometry(0.45, 0.52, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    const auraRing = new THREE.Mesh(ringGeo, ringMat);
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 0.005;
    peerGroup.add(auraRing);

    // Humanoid Body/Torso
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.5,
    });
    const bodyGeo = new THREE.CylinderGeometry(0.16, 0.12, 0.72, 16);
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
      color: 0x334155,
      roughness: 0.5,
      metalness: 0.2,
    });
    const headGeo = new THREE.SphereGeometry(0.13, 20, 20);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.36;
    head.castShadow = true;
    peerGroup.add(head);

    // Hair / Cyber Visor
    const visorGeo = new THREE.BoxGeometry(0.2, 0.06, 0.12);
    const visorMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.7,
      roughness: 0.2,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.38, 0.08);
    peerGroup.add(visor);

    // Floating Name Sprite
    const nameSprite = this.createNameSprite(name, colorHex);
    peerGroup.add(nameSprite);

    this.group.add(peerGroup);
    this.peerRigs.set(id, {
      group: peerGroup,
      head,
      body,
      auraRing,
      nameSprite,
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
    if (id === this.activeMainId) {
      return new THREE.Vector3(0, 1.2, 0);
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
      if (rig.status === 'sleeping') {
        const breath = Math.sin(time * 1.2) * 0.02;
        rig.body.position.y = 0.85 + breath;
        rig.head.position.y = 1.36 + breath;
        rig.head.rotation.z = 0.12;
      } else if (rig.status === 'dreaming') {
        const floatY = Math.sin(time * 1.5) * 0.035;
        rig.group.position.y = rig.basePos.y + floatY;
        rig.head.rotation.y = Math.sin(time * 0.8) * 0.12;
      } else {
        // Awake / active
        const bob = Math.sin(time * 2.2) * 0.012;
        rig.body.position.y = 0.85 + bob;
        rig.head.position.y = 1.36 + bob;
        rig.head.rotation.y = Math.sin(time * 1.1) * 0.1;
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
