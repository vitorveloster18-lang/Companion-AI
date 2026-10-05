/**
 * ActionExecutor: Processes incoming actions from the Python runtime,
 * drives the AvatarController smoothly, and replies with action.started,
 * action.completed, and action.failed.
 */

import * as THREE from 'three';
import { AgentConnection } from './AgentConnection';
import { AvatarController } from './AvatarController';
import { WorldState } from './WorldState';
import {
  AgentAction,
  MoveToAction,
  RotateAction,
  LookAtAction,
  PlayAnimationAction,
  SetExpressionAction,
  SpeakAction,
  StopAction,
} from '../types/protocol';

interface ActiveMovement {
  actionId: string;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  speed: number;
  totalDistance: number;
  movedDistance: number;
  targetRotationY: number;
}

interface ActiveRotation {
  actionId: string;
  startRotY: number;
  targetRotY: number;
  speed: number; // rad/s
  progress: number;
  duration: number;
  elapsed: number;
}

interface ActiveAnimationTimer {
  actionId: string;
  endTime: number;
}

interface ActiveSpeechTimer {
  actionId: string;
  endTime: number;
}

interface ActiveLookAtTimer {
  actionId: string;
  endTime: number;
}

export class ActionExecutor {
  private connection: AgentConnection;
  private avatar: AvatarController;
  private worldState: WorldState;

  // Active state trackers
  private activeMovement: ActiveMovement | null = null;
  private activeRotation: ActiveRotation | null = null;
  private activeAnimationTimer: ActiveAnimationTimer | null = null;
  private activeSpeechTimer: ActiveSpeechTimer | null = null;
  private activeLookAtTimer: ActiveLookAtTimer | null = null;

  constructor(connection: AgentConnection, avatar: AvatarController, worldState: WorldState) {
    this.connection = connection;
    this.avatar = avatar;
    this.worldState = worldState;

    // Listen to incoming messages from the WebSocket
    this.connection.onMessage((data) => {
      this.handleIncomingMessage(data);
    });
  }

  public handleIncomingMessage(data: unknown): void {
    if (!data || typeof data !== 'object') {
      return;
    }

    const msg = data as Partial<AgentAction> & { animation?: string; expression?: string; name?: string };

    if (msg.type !== 'action' || !msg.action) {
      return;
    }

    // If ID is omitted by runtime, generate a correlation ID
    const actionId = msg.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const actionWithId: AgentAction = {
      ...msg,
      id: actionId,
    } as AgentAction;

    try {
      this.executeAction(actionWithId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.connection.send({
        type: 'action.failed',
        id: actionId,
        error: errorMsg,
      });
    }
  }

  public executeAction(action: AgentAction): void {
    const id = action.id;

    switch (action.action) {
      case 'move_to':
        this.executeMoveTo(action as MoveToAction);
        break;

      case 'rotate':
        this.executeRotate(action as RotateAction);
        break;

      case 'look_at':
        this.executeLookAt(action as LookAtAction);
        break;

      case 'play_animation':
        this.executePlayAnimation(action as PlayAnimationAction);
        break;

      case 'set_expression':
        this.executeSetExpression(action as SetExpressionAction);
        break;

      case 'speak':
        this.executeSpeak(action as SpeakAction);
        break;

      case 'stop':
        this.executeStop(action as StopAction);
        break;

      default:
        this.connection.send({
          type: 'action.failed',
          id,
          error: `Ação desconhecida: ${(action as { action: string }).action}`,
        });
    }
  }

  private executeMoveTo(action: MoveToAction): void {
    const { id, target, speed = 2.0 } = action;

    if (!target || typeof target.x !== 'number' || typeof target.z !== 'number') {
      this.connection.send({
        type: 'action.failed',
        id,
        error: 'Target inválido para move_to. x e z são obrigatórios.',
      });
      return;
    }

    // Acknowledge start of action
    this.connection.send({ type: 'action.started', id });

    // Cancel and fail previous movement if any
    if (this.activeMovement) {
      const prevId = this.activeMovement.actionId;
      this.activeMovement = null;
      this.connection.send({
        type: 'action.failed',
        id: prevId,
        error: 'Interrompido por nova ação',
      });
    }

    const currentPos = this.avatar.getPosition().clone();
    const targetY = typeof target.y === 'number' ? target.y : currentPos.y;
    const targetVec = new THREE.Vector3(target.x, targetY, target.z);

    const deltaVec = new THREE.Vector3().subVectors(targetVec, currentPos);
    deltaVec.y = 0; // Movement on ground plane
    const totalDist = deltaVec.length();

    if (totalDist < 0.05) {
      // Already at target
      this.avatar.setPosition(targetVec.x, targetVec.y, targetVec.z);
      this.worldState.setPosition(targetVec.x, targetVec.y, targetVec.z);
      this.worldState.setMoving(false, null);
      this.avatar.setAnimation('idle');
      this.worldState.setAnimation('idle');
      this.connection.send({ type: 'action.completed', id });
      return;
    }

    // Compute target rotation towards destination
    const targetRotY = Math.atan2(deltaVec.x, deltaVec.z);

    this.activeMovement = {
      actionId: id,
      startPos: currentPos,
      targetPos: targetVec,
      speed: Math.max(0.2, speed),
      totalDistance: totalDist,
      movedDistance: 0,
      targetRotationY: targetRotY,
    };

    this.avatar.setAnimation('walk');
    this.worldState.setAnimation('walk');
    this.worldState.setMoving(true, { x: targetVec.x, y: targetVec.y, z: targetVec.z });
  }

  private executeRotate(action: RotateAction): void {
    const { id, target, speed = Math.PI } = action;

    let targetRad = 0;
    if (typeof target === 'number') {
      targetRad = target;
    } else if (target && typeof target.y === 'number') {
      targetRad = target.y;
    }

    // Acknowledge start of action
    this.connection.send({ type: 'action.started', id });

    // Cancel and fail previous rotation if any
    if (this.activeRotation) {
      const prevId = this.activeRotation.actionId;
      this.activeRotation = null;
      this.connection.send({
        type: 'action.failed',
        id: prevId,
        error: 'Interrompido por nova ação',
      });
    }

    const currentRotY = this.avatar.getRotationY();
    const diff = targetRad - currentRotY;
    const duration = Math.abs(diff) / Math.max(0.5, speed);

    if (duration < 0.05) {
      this.avatar.setRotationY(targetRad);
      this.worldState.setRotationY(targetRad);
      this.connection.send({ type: 'action.completed', id });
      return;
    }

    this.activeRotation = {
      actionId: id,
      startRotY: currentRotY,
      targetRotY: targetRad,
      speed,
      progress: 0,
      duration: Math.max(0.1, duration),
      elapsed: 0,
    };
  }

  private executeLookAt(action: LookAtAction): void {
    const { id, target, duration = 1.0 } = action;

    if (!target || typeof target.x !== 'number') {
      this.connection.send({
        type: 'action.failed',
        id,
        error: 'Target inválido para look_at.',
      });
      return;
    }

    // Acknowledge start of action
    this.connection.send({ type: 'action.started', id });

    // Cancel and fail previous look_at timer if any
    if (this.activeLookAtTimer) {
      const prevId = this.activeLookAtTimer.actionId;
      this.activeLookAtTimer = null;
      this.connection.send({
        type: 'action.failed',
        id: prevId,
        error: 'Interrompido por nova ação',
      });
    }

    this.avatar.setLookAt({
      x: target.x,
      y: target.y ?? 1.5,
      z: target.z ?? 0,
    });

    if (duration > 0) {
      this.activeLookAtTimer = {
        actionId: id,
        endTime: performance.now() + duration * 1000,
      };
    } else {
      this.connection.send({ type: 'action.completed', id });
    }
  }

  private executePlayAnimation(action: PlayAnimationAction): void {
    const { id, duration } = action;
    const animName = action.animation || action.name || 'idle';

    // Acknowledge start of action
    this.connection.send({ type: 'action.started', id });

    // Cancel and fail previous active animation timer if any
    if (this.activeAnimationTimer) {
      const prevId = this.activeAnimationTimer.actionId;
      this.activeAnimationTimer = null;
      this.connection.send({
        type: 'action.failed',
        id: prevId,
        error: 'Interrompido por nova ação',
      });
    }

    this.avatar.setAnimation(animName);
    this.worldState.setAnimation(animName);

    // If duration specified, or if it's a transient action like 'wave', set timer
    const animDuration = duration !== undefined ? duration : (animName === 'wave' || animName === 'talk' ? 2.5 : 0);

    if (animDuration > 0) {
      this.activeAnimationTimer = {
        actionId: id,
        endTime: performance.now() + animDuration * 1000,
      };
    } else {
      // If setting an indefinite animation (e.g. idle or walk), complete immediately
      this.connection.send({ type: 'action.completed', id });
    }
  }

  private executeSetExpression(action: SetExpressionAction): void {
    const { id, intensity = 1.0 } = action;
    const expression = action.expression || (action as any).name || (action as any).emotion;

    if (!expression) {
      this.connection.send({
        type: 'action.failed',
        id,
        error: 'Expressão não especificada.',
      });
      return;
    }

    // Acknowledge start of action
    this.connection.send({ type: 'action.started', id });

    this.avatar.setExpression(expression, intensity);
    this.worldState.setExpression(expression, intensity);

    this.connection.send({ type: 'action.completed', id });
  }

  private executeSpeak(action: SpeakAction): void {
    const { id, text, duration } = action;

    if (!text) {
      this.connection.send({
        type: 'action.failed',
        id,
        error: 'Texto de fala não fornecido.',
      });
      return;
    }

    // Acknowledge start of action
    this.connection.send({ type: 'action.started', id });

    // Cancel and fail previous active speech timer if any
    if (this.activeSpeechTimer) {
      const prevId = this.activeSpeechTimer.actionId;
      this.activeSpeechTimer = null;
      this.connection.send({
        type: 'action.failed',
        id: prevId,
        error: 'Interrompido por nova ação',
      });
    }

    const calculatedDuration =
      duration && duration > 0 ? duration : Math.max(2.0, Math.min(8.0, text.length * 0.08));

    this.avatar.setSpeaking(true);
    this.worldState.setSpeaking(true, text, calculatedDuration);

    this.activeSpeechTimer = {
      actionId: id,
      endTime: performance.now() + calculatedDuration * 1000,
    };
  }

  private executeStop(action: StopAction): void {
    const { id } = action;

    // Acknowledge start of action
    this.connection.send({ type: 'action.started', id });

    if (this.activeMovement) {
      const prevId = this.activeMovement.actionId;
      this.activeMovement = null;
      this.connection.send({
        type: 'action.failed',
        id: prevId,
        error: 'Interrompido por nova ação',
      });
    }

    if (this.activeRotation) {
      const prevId = this.activeRotation.actionId;
      this.activeRotation = null;
      this.connection.send({
        type: 'action.failed',
        id: prevId,
        error: 'Interrompido por nova ação',
      });
    }

    if (this.activeAnimationTimer) {
      const prevId = this.activeAnimationTimer.actionId;
      this.activeAnimationTimer = null;
      this.connection.send({
        type: 'action.failed',
        id: prevId,
        error: 'Interrompido por nova ação',
      });
    }

    if (this.activeSpeechTimer) {
      const prevId = this.activeSpeechTimer.actionId;
      this.activeSpeechTimer = null;
      this.connection.send({
        type: 'action.failed',
        id: prevId,
        error: 'Interrompido por nova ação',
      });
    }

    if (this.activeLookAtTimer) {
      const prevId = this.activeLookAtTimer.actionId;
      this.activeLookAtTimer = null;
      this.connection.send({
        type: 'action.failed',
        id: prevId,
        error: 'Interrompido por nova ação',
      });
    }

    this.avatar.setAnimation('idle');
    this.avatar.setSpeaking(false);
    this.avatar.setLookAt(null);

    this.worldState.setAnimation('idle');
    this.worldState.setMoving(false, null);
    this.worldState.setSpeaking(false);

    this.connection.send({ type: 'action.completed', id });
  }

  /**
   * Main per-frame update loop called inside requestAnimationFrame
   */
  public update(delta: number): void {
    const now = performance.now();

    // 1. Process Active Movement
    if (this.activeMovement) {
      const move = this.activeMovement;
      const step = move.speed * delta;
      move.movedDistance += step;

      const progress = Math.min(1.0, move.movedDistance / move.totalDistance);

      // Smooth rotate towards target direction
      const currentRotY = this.avatar.getRotationY();
      let rotDiff = move.targetRotationY - currentRotY;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      this.avatar.setRotationY(currentRotY + rotDiff * Math.min(1.0, delta * 8.0));

      // Interpolate position
      const newX = THREE.MathUtils.lerp(move.startPos.x, move.targetPos.x, progress);
      const newY = THREE.MathUtils.lerp(move.startPos.y, move.targetPos.y, progress);
      const newZ = THREE.MathUtils.lerp(move.startPos.z, move.targetPos.z, progress);

      this.avatar.setPosition(newX, newY, newZ);
      this.worldState.setPosition(newX, newY, newZ);
      this.worldState.setRotationY(this.avatar.getRotationY());

      if (progress >= 1.0) {
        // Destination reached
        this.avatar.setPosition(move.targetPos.x, move.targetPos.y, move.targetPos.z);
        this.avatar.setRotationY(move.targetRotationY);

        // Only transition to idle if there is no other transient animation currently overriding pose
        if (!this.activeAnimationTimer) {
          this.avatar.setAnimation('idle');
          this.worldState.setAnimation('idle');
        }

        this.worldState.setPosition(move.targetPos.x, move.targetPos.y, move.targetPos.z);
        this.worldState.setRotationY(move.targetRotationY);
        this.worldState.setMoving(false, null);

        const completedId = move.actionId;
        this.activeMovement = null;
        this.connection.send({ type: 'action.completed', id: completedId });
      }
    }

    // 2. Process Active Rotation
    if (this.activeRotation) {
      const rot = this.activeRotation;
      rot.elapsed += delta;
      const t = Math.min(1.0, rot.elapsed / rot.duration);

      const currentY = THREE.MathUtils.lerp(rot.startRotY, rot.targetRotY, t);
      this.avatar.setRotationY(currentY);
      this.worldState.setRotationY(currentY);

      if (t >= 1.0) {
        this.avatar.setRotationY(rot.targetRotY);
        this.worldState.setRotationY(rot.targetRotY);
        const completedId = rot.actionId;
        this.activeRotation = null;
        this.connection.send({ type: 'action.completed', id: completedId });
      }
    }

    // 3. Process Animation Timer (CORREÇÃO 2: If movement is still active, return to 'walk', else 'idle')
    if (this.activeAnimationTimer) {
      if (now >= this.activeAnimationTimer.endTime) {
        const completedId = this.activeAnimationTimer.actionId;
        this.activeAnimationTimer = null;

        const fallback = this.activeMovement !== null ? 'walk' : 'idle';
        this.avatar.setAnimation(fallback);
        this.worldState.setAnimation(fallback);
        this.connection.send({ type: 'action.completed', id: completedId });
      }
    }

    // 4. Process Speech Timer
    if (this.activeSpeechTimer) {
      if (now >= this.activeSpeechTimer.endTime) {
        const completedId = this.activeSpeechTimer.actionId;
        this.activeSpeechTimer = null;

        this.avatar.setSpeaking(false);
        this.worldState.setSpeaking(false);
        this.connection.send({ type: 'action.completed', id: completedId });
      }
    }

    // 5. Process LookAt Timer
    if (this.activeLookAtTimer) {
      if (now >= this.activeLookAtTimer.endTime) {
        const completedId = this.activeLookAtTimer.actionId;
        this.activeLookAtTimer = null;
        this.connection.send({ type: 'action.completed', id: completedId });
      }
    }
  }
}
