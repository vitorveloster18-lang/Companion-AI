/**
 * WorldState: Manages spatial coordinates, orientation, animation and speaking status.
 */

export interface AvatarTransform {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

export interface AvatarState {
  position: { x: number; y: number; z: number };
  rotation: { y: number };
  animation: string;
  expression: string;
  expressionIntensity: number;
  isMoving: boolean;
  isSpeaking: boolean;
  speakText: string;
  speakExpiresAt: number;
  targetPosition: { x: number; y: number; z: number } | null;
}

export type WorldStateListener = (state: Readonly<AvatarState>) => void;

export class WorldState {
  private state: AvatarState = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { y: 0 },
    animation: 'idle',
    expression: 'neutral',
    expressionIntensity: 1.0,
    isMoving: false,
    isSpeaking: false,
    speakText: '',
    speakExpiresAt: 0,
    targetPosition: null,
  };

  private listeners: Set<WorldStateListener> = new Set();

  public getState(): Readonly<AvatarState> {
    return this.state;
  }

  public subscribe(listener: WorldStateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setPosition(x: number, y: number, z: number): void {
    if (this.state.position.x === x && this.state.position.y === y && this.state.position.z === z) {
      return;
    }
    this.state = {
      ...this.state,
      position: { x, y, z },
    };
    this.notify();
  }

  public setRotationY(y: number): void {
    if (this.state.rotation.y === y) return;
    this.state = {
      ...this.state,
      rotation: { y },
    };
    this.notify();
  }

  public setAnimation(animation: string): void {
    if (this.state.animation === animation) return;
    this.state = {
      ...this.state,
      animation,
    };
    this.notify();
  }

  public setExpression(expression: string, intensity = 1.0): void {
    this.state = {
      ...this.state,
      expression,
      expressionIntensity: intensity,
    };
    this.notify();
  }

  public setSpeaking(isSpeaking: boolean, text = '', durationSeconds = 3.0): void {
    const expiresAt = isSpeaking ? Date.now() + durationSeconds * 1000 : 0;
    this.state = {
      ...this.state,
      isSpeaking,
      speakText: text,
      speakExpiresAt: expiresAt,
    };
    this.notify();
  }

  public setMoving(isMoving: boolean, target: { x: number; y: number; z: number } | null = null): void {
    this.state = {
      ...this.state,
      isMoving,
      targetPosition: target,
    };
    this.notify();
  }

  public reset(): void {
    this.state = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { y: 0 },
      animation: 'idle',
      expression: 'neutral',
      expressionIntensity: 1.0,
      isMoving: false,
      isSpeaking: false,
      speakText: '',
      speakExpiresAt: 0,
      targetPosition: null,
    };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
