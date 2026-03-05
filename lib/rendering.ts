import { Orb, ParticleData, OrbAnimationState, ScreenShakeState } from './types';
import {
  GRID_SIZE,
  CELL_SIZE,
  CELL_GAP,
  BOARD_PADDING,
  COLORS,
  ORB_COLORS,
  PARTICLE_COLORS,
  ANIMATION_DURATIONS,
} from './constants';

// ============================================================================
// PARTICLE SYSTEM
// ============================================================================

export class ParticleSystem {
  particles: ParticleData[] = [];

  emit(
    x: number,
    y: number,
    color: string,
    count: number = 8,
    velocity: number = 3
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = velocity + Math.random() * 2;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        color,
        size: 3 + Math.random() * 3,
      });
    }
  }

  update(dt: number): void {
    this.particles = this.particles.filter((p) => {
      p.life -= dt / 1000; // Convert to seconds
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2; // gravity
      return p.life > 0;
    });
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    for (const particle of this.particles) {
      const alpha = Math.max(0, particle.life);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  clear(): void {
    this.particles = [];
  }
}

// ============================================================================
// ORB ANIMATOR
// ============================================================================

export class OrbAnimator {
  animations: Map<string, OrbAnimationState> = new Map();

  addAnimation(
    row: number,
    col: number,
    targetRow?: number,
    targetCol?: number,
    duration: number = ANIMATION_DURATIONS.orbMove
  ): void {
    const key = `${row},${col}`;
    this.animations.set(key, {
      row,
      col,
      targetRow,
      targetCol,
      startTime: Date.now(),
      duration,
      scale: 1,
      opacity: 1,
      particles: [],
    });
  }

  update(dt: number): void {
    for (const [key, anim] of this.animations) {
      const elapsed = Date.now() - anim.startTime;
      const progress = Math.min(elapsed / anim.duration, 1);

      if (progress >= 1) {
        this.animations.delete(key);
      } else {
        // Ease out cubic
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        if (anim.targetRow !== undefined && anim.targetCol !== undefined) {
          anim.row = anim.row + (anim.targetRow - anim.row) * easeProgress;
          anim.col = anim.col + (anim.targetCol - anim.col) * easeProgress;
        }

        // Scale animation
        anim.scale = 1 + Math.sin(progress * Math.PI) * 0.1;

        // Opacity fade at end
        if (progress > 0.8) {
          anim.opacity = 1 - (progress - 0.8) / 0.2;
        }
      }
    }
  }

  clear(): void {
    this.animations.clear();
  }
}

// ============================================================================
// SCREEN SHAKE
// ============================================================================

export class ScreenShaker {
  shakes: ScreenShakeState[] = [];

  addShake(intensity: number = 5, duration: number = 300): void {
    this.shakes.push({
      intensity,
      duration,
      startTime: Date.now(),
    });
  }

  getOffset(): { x: number; y: number } {
    let totalX = 0;
    let totalY = 0;

    this.shakes = this.shakes.filter((shake) => {
      const elapsed = Date.now() - shake.startTime;
      if (elapsed > shake.duration) return false;

      const progress = elapsed / shake.duration;
      const strength = (1 - progress) * shake.intensity;

      totalX += (Math.random() - 0.5) * strength * 2;
      totalY += (Math.random() - 0.5) * strength * 2;

      return true;
    });

    return { x: totalX, y: totalY };
  }

  clear(): void {
    this.shakes = [];
  }
}

// ============================================================================
// BOARD RENDERING
// ============================================================================

export class BoardRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  particles: ParticleSystem;
  orbAnimator: OrbAnimator;
  screenShaker: ScreenShaker;
  selectedCell: [number, number] | null = null;
  lastFrameTime = Date.now();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.particles = new ParticleSystem();
    this.orbAnimator = new OrbAnimator();
    this.screenShaker = new ScreenShaker();

    // Set canvas resolution
    this.updateCanvasSize();
    window.addEventListener('resize', () => this.updateCanvasSize());
  }

  updateCanvasSize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * devicePixelRatio;
    this.canvas.height = rect.height * devicePixelRatio;
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
  }

  setSelectedCell(row: number | null, col: number | null): void {
    if (row !== null && col !== null) {
      this.selectedCell = [row, col];
    } else {
      this.selectedCell = null;
    }
  }

  render(grid: (Orb | null)[][]): void {
    const now = Date.now();
    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Update animations
    this.orbAnimator.update(dt);
    this.particles.update(dt);

    // Get shake offset
    const shake = this.screenShaker.getOffset();

    // Clear canvas
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, this.canvas.width / devicePixelRatio, this.canvas.height / devicePixelRatio);

    // Apply shake
    this.ctx.save();
    this.ctx.translate(shake.x, shake.y);

    // Draw board background
    this.drawBoardBackground();

    // Draw grid
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const orb = grid[r][c];
        const x = this.getCellX(c);
        const y = this.getCellY(r);

        // Draw cell background
        this.drawCell(x, y, r === this.selectedCell?.[0] && c === this.selectedCell?.[1]);

        // Draw orb if exists
        if (orb) {
          this.drawOrb(x, y, orb);
        }
      }
    }

    // Draw particles
    this.particles.render(this.ctx);

    this.ctx.restore();

    // Request next frame
    requestAnimationFrame(() => this.render(grid));
  }

  private drawBoardBackground(): void {
    this.ctx.fillStyle = COLORS.surface;
    const boardX = BOARD_PADDING;
    const boardY = BOARD_PADDING;
    const boardW = GRID_SIZE * CELL_SIZE + (GRID_SIZE - 1) * CELL_GAP;
    const boardH = GRID_SIZE * CELL_SIZE + (GRID_SIZE - 1) * CELL_GAP;

    this.ctx.fillRect(boardX, boardY, boardW, boardH);

    // Border
    this.ctx.strokeStyle = COLORS.border;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(boardX, boardY, boardW, boardH);
  }

  private drawCell(x: number, y: number, isSelected: boolean): void {
    if (isSelected) {
      this.ctx.fillStyle = COLORS.border;
      this.ctx.globalAlpha = 0.3;
    } else {
      this.ctx.fillStyle = COLORS.background;
      this.ctx.globalAlpha = 0.5;
    }

    this.ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    this.ctx.globalAlpha = 1;

    // Cell border
    this.ctx.strokeStyle = COLORS.border;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
  }

  private drawOrb(x: number, y: number, orb: Orb): void {
    const centerX = x + CELL_SIZE / 2;
    const centerY = y + CELL_SIZE / 2;
    const baseRadius = CELL_SIZE / 3;

    // Draw shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.ctx.beginPath();
    this.ctx.ellipse(
      centerX,
      centerY + baseRadius * 0.2,
      baseRadius * 0.9,
      baseRadius * 0.3,
      0,
      0,
      Math.PI * 2
    );
    this.ctx.fill();

    // Draw orb
    const color = ORB_COLORS[orb.color];
    const gradient = this.ctx.createRadialGradient(
      centerX - baseRadius * 0.3,
      centerY - baseRadius * 0.3,
      0,
      centerX,
      centerY,
      baseRadius
    );
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, this.darkenColor(color, 0.3));

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw mass indicator (dots)
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    const dotSize = 3;
    for (let i = 1; i <= orb.mass; i++) {
      const dotX = centerX - (baseRadius * 0.4) + i * (baseRadius * 0.3);
      const dotY = centerY + baseRadius * 0.3;
      this.ctx.fillRect(dotX - dotSize / 2, dotY - dotSize / 2, dotSize, dotSize);
    }

    // Highlight
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(centerX - baseRadius * 0.3, centerY - baseRadius * 0.3, baseRadius * 0.4, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private getCellX(col: number): number {
    return BOARD_PADDING + col * (CELL_SIZE + CELL_GAP);
  }

  private getCellY(row: number): number {
    return BOARD_PADDING + row * (CELL_SIZE + CELL_GAP);
  }

  private darkenColor(color: string, amount: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(255 * amount);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16)
      .slice(1);
  }

  emitParticles(row: number, col: number, orbColor: string): void {
    const x = this.getCellX(col) + CELL_SIZE / 2;
    const y = this.getCellY(row) + CELL_SIZE / 2;
    const particleColor = PARTICLE_COLORS[orbColor as keyof typeof PARTICLE_COLORS]?.[0] || COLORS.neutral;

    this.particles.emit(x, y, particleColor, 12, 4);
  }

  addScreenShake(): void {
    this.screenShaker.addShake(4, 200);
  }

  destroy(): void {
    window.removeEventListener('resize', () => this.updateCanvasSize());
    this.particles.clear();
    this.orbAnimator.clear();
    this.screenShaker.clear();
  }
}
