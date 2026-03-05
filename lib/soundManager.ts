'use client';

// Simplified sound system using Web Audio API
// In production, you'd use Howler.js or similar for better audio management

export class SoundManager {
  private audioContext: AudioContext | null = null;
  private enabled = true;
  private sounds = new Map<string, AudioBuffer>();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.audioContext =
          new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        console.warn('[SoundManager] Web Audio API not supported');
      }
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Play a simple synthesized sound
   * frequency: Hz, duration: ms, type: 'sine', 'square', 'triangle', 'sawtooth'
   */
  playTone(
    frequency: number = 400,
    duration: number = 100,
    type: OscillatorType = 'sine'
  ): void {
    if (!this.enabled || !this.audioContext) return;

    try {
      const now = this.audioContext.currentTime;
      const oscDuration = duration / 1000;

      // Create oscillator
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = type;
      osc.frequency.value = frequency;

      // Envelope
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + oscDuration);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start(now);
      osc.stop(now + oscDuration);
    } catch (error) {
      console.warn('[SoundManager] Error playing tone:', error);
    }
  }

  // Sound effects
  orbClick(): void {
    this.playTone(800, 80, 'square');
  }

  explosion(): void {
    this.playTone(200, 300, 'sine');
    setTimeout(() => this.playTone(150, 200, 'sine'), 100);
  }

  chainReaction(): void {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.playTone(400 + i * 100, 150, 'sine');
      }, i * 100);
    }
  }

  turnChange(): void {
    this.playTone(500, 100, 'sine');
    setTimeout(() => this.playTone(600, 100, 'sine'), 100);
  }

  gameOver(): void {
    this.playTone(500, 200, 'sine');
    setTimeout(() => this.playTone(400, 200, 'sine'), 200);
    setTimeout(() => this.playTone(300, 300, 'sine'), 400);
  }

  buttonClick(): void {
    this.playTone(600, 50, 'square');
  }

  destroy(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}

// Global instance
let soundManager: SoundManager | null = null;

export function getSoundManager(): SoundManager {
  if (!soundManager && typeof window !== 'undefined') {
    soundManager = new SoundManager();
  }
  return soundManager || new SoundManager();
}
