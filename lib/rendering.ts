import { Orb, ScreenShakeState } from "./types";
import { getCriticalMass } from "./gameEngine";
import { getSoundManager } from "./soundManager";

// ============================================================================
// COLOR MAP
// ============================================================================

const ORB_HEX: Record<string, string> = {
  red: "#FF0000",
  green: "#00FF00",
  blue: "#0088FF",
  yellow: "#FFFF00",
  purple: "#FF00FF",
  neutral: "#888888",
};

function parseHex(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// ============================================================================
// EASING FUNCTIONS
// ============================================================================

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

// ============================================================================
// PER-CELL ANIMATION STATE
// ============================================================================

interface CellAnimState {
  angle: number; // spin angle for orb self-rotation
  angularVelocity: number;
  targetVelocity: number;
  // Per-orb spawn pop
  orbScales: number[];
  orbSpawnTimers: number[];
  // Impact/landing effects
  landingBounceTime: number; // -1 = inactive
  landingBounceColor: string;
  landingFlashOpacity: number;
  landingFlashTime: number; // tracks 0→0.55→0 over 100ms; -1 = inactive
}

// ============================================================================
// ORB FLIGHT (straight line — no curves)
// ============================================================================

interface OrbFlight {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  progress: number;
  color: string;
  radius: number;
  dirAngle: number; // direction of travel for forward-scatter particles
}

// ============================================================================
// EXPLOSION ENTRY
// ============================================================================

interface ExplosionEntry {
  row: number;
  col: number;
  color: string;
  sourceOrb: Orb; // snapshot of cell before explosion
  neighbors: [number, number][];
  flights: OrbFlight[];
  chainIndex: number;
  startDelay: number; // chainIndex * 0.12 seconds
  elapsed: number;
  active: boolean;
  done: boolean;
  ringRadius: number;
  impactHandled: boolean;
  soundPlayed: boolean;
}

// ParticleSystem kept as export for API compatibility but no longer used for explosions
export class ParticleSystem {
  clear(): void {}
}

// ============================================================================
// SCREEN SHAKE
// ============================================================================

export class ScreenShaker {
  shakes: ScreenShakeState[] = [];

  addShake(intensity: number = 5, duration: number = 300): void {
    this.shakes.push({ intensity, duration, startTime: Date.now() });
  }

  getOffset(): { x: number; y: number } {
    let totalX = 0;
    let totalY = 0;
    const now = Date.now();
    this.shakes = this.shakes.filter((s) => {
      const elapsed = now - s.startTime;
      if (elapsed > s.duration) return false;
      const t = elapsed / s.duration;
      const strength = s.intensity * (1 - easeOutQuad(t));
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
// BOARD RENDERER
// ============================================================================

export class BoardRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  particles: ParticleSystem;
  screenShaker: ScreenShaker;
  selectedCell: [number, number] | null = null;
  animFrameId: number = 0;

  rows: number;
  cols: number;
  cellSize: number = 50;
  offsetX: number = 0;
  offsetY: number = 0;

  private lastFrameTime: number = 0;
  private globalTime: number = 0;

  private cellAnims: CellAnimState[][] = [];
  private currentGrid: (Orb | null)[][] | null = null;

  // Explosion queue
  private explosionQueue: ExplosionEntry[] = [];
  private explosionBatchTime: number = 0;

  // Flash overlay
  private flashOverlayAlpha: number = 0;
  private flashOverlayDecay: number = 0;

  // Vignette pulse (chain 6-10)
  private vignetteAlpha: number = 0;
  private vignetteDecay: number = 0;

  // Player color → index for rotation direction
  private playerColorIndex: Record<string, number> = {
    blue: 0,
    red: 1,
    green: 2,
    yellow: 3,
    purple: 4,
  };

  // Grid color based on current turn
  private gridColor: string = "#1a1a1a";
  private gridAccentColor: string = "#0d0d0d";

  private resizeHandler: () => void;

  constructor(canvas: HTMLCanvasElement, rows: number = 9, cols: number = 6) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.particles = new ParticleSystem();
    this.screenShaker = new ScreenShaker();
    // Ensure AudioContext is ready (will create on first user gesture)
    getSoundManager();
    this.rows = rows;
    this.cols = cols;

    this.cellAnims = [];
    for (let r = 0; r < rows; r++) {
      this.cellAnims[r] = [];
      for (let c = 0; c < cols; c++) {
        this.cellAnims[r][c] = this.newCellAnim();
      }
    }

    this.resizeHandler = () => this.updateCanvasSize();
    this.updateCanvasSize();
    window.addEventListener("resize", this.resizeHandler);

    this.lastFrameTime = performance.now();
    this._loop(this.lastFrameTime);
  }

  private newCellAnim(): CellAnimState {
    return {
      angle: Math.random() * Math.PI * 2,
      angularVelocity: 0.3,
      targetVelocity: 0.3,
      orbScales: [],
      orbSpawnTimers: [],
      landingBounceTime: -1,
      landingBounceColor: "#fff",
      landingFlashOpacity: 0,
      landingFlashTime: -1,
    };
  }

  updateCanvasSize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pad = 4;
    const availW = rect.width - pad * 2;
    const availH = rect.height - pad * 2;
    this.cellSize = Math.floor(
      Math.min(availW / this.cols, availH / this.rows),
    );

    const gridW = this.cellSize * this.cols;
    const gridH = this.cellSize * this.rows;
    this.offsetX = Math.floor((rect.width - gridW) / 2);
    this.offsetY = Math.floor((rect.height - gridH) / 2);
  }

  getCellFromPixel(x: number, y: number): [number, number] | null {
    const col = Math.floor((x - this.offsetX) / this.cellSize);
    const row = Math.floor((y - this.offsetY) / this.cellSize);
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      return [row, col];
    }
    return null;
  }

  setSelectedCell(row: number | null, col: number | null): void {
    this.selectedCell = row !== null && col !== null ? [row, col] : null;
  }

  /**
   * Set grid color based on current player's turn color
   */
  setGridColor(playerColor: string): void {
    // Map player colors to tinted grid colors
    const gridColorMap: Record<string, { main: string; accent: string }> = {
      blue: { main: "#0a3d5c", accent: "#051f2e" },
      red: { main: "#5c0a0a", accent: "#2e0505" },
      green: { main: "#0a5c0a", accent: "#052e05" },
      yellow: { main: "#5c5c0a", accent: "#2e2e05" },
      purple: { main: "#3d0a5c", accent: "#1f052e" },
    };

    const colors = gridColorMap[playerColor] || {
      main: "#1a1a1a",
      accent: "#0d0d0d",
    };
    this.gridColor = colors.main;
    this.gridAccentColor = colors.accent;
  }

  // ── PUBLIC API ──────────────────────────────────────────

  render(grid: (Orb | null)[][]): void {
    this.updateGrid(grid);
  }

  renderOnce(grid: (Orb | null)[][]): void {
    this.updateGrid(grid);
  }

  private updateGrid(grid: (Orb | null)[][]): void {
    const prev = this.currentGrid;
    this.currentGrid = grid;
    if (!prev) return;
    this.detectChanges(prev, grid);
  }

  // ── CHANGE DETECTION ────────────────────────────────────

  private detectChanges(
    oldGrid: (Orb | null)[][],
    newGrid: (Orb | null)[][],
  ): void {
    const exploded: { r: number; c: number; color: string; orb: Orb }[] = [];
    const gained: {
      r: number;
      c: number;
      oldMass: number;
      newMass: number;
      color: string;
    }[] = [];

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const oldCell = oldGrid[r]?.[c];
        const newCell = newGrid[r]?.[c];

        if (oldCell && !newCell) {
          // Cell emptied — explosion source
          exploded.push({
            r,
            c,
            color: ORB_HEX[oldCell.color] || "#888",
            orb: { ...oldCell },
          });
        } else if (newCell) {
          const oldMass = oldCell ? oldCell.mass : 0;
          if (newCell.mass > oldMass) {
            gained.push({
              r,
              c,
              oldMass,
              newMass: newCell.mass,
              color: ORB_HEX[newCell.color] || "#888",
            });
          }
          this.updateCellVelocity(r, c, newCell);
        }

        if (!newCell && oldCell) {
          const ca = this.cellAnims[r]?.[c];
          if (ca) {
            ca.targetVelocity = 0.3;
            ca.angularVelocity = 0.3;
          }
        }
      }
    }

    // Spawn pop animation for gained orbs
    for (const g of gained) {
      const ca = this.cellAnims[g.r]?.[g.c];
      if (ca) {
        while (ca.orbScales.length < g.newMass) {
          ca.orbScales.push(0);
          ca.orbSpawnTimers.push(0);
        }
        ca.orbScales.length = g.newMass;
        ca.orbSpawnTimers.length = g.newMass;
      }
    }

    // Queue explosion animations
    if (exploded.length > 0) {
      this.explosionBatchTime = this.globalTime;

      for (let idx = 0; idx < exploded.length; idx++) {
        const e = exploded[idx];
        const neighbors: [number, number][] = [];
        if (e.r > 0) neighbors.push([e.r - 1, e.c]);
        if (e.r < this.rows - 1) neighbors.push([e.r + 1, e.c]);
        if (e.c > 0) neighbors.push([e.r, e.c - 1]);
        if (e.c < this.cols - 1) neighbors.push([e.r, e.c + 1]);

        const cx = this.offsetX + e.c * this.cellSize + this.cellSize / 2;
        const cy = this.offsetY + e.r * this.cellSize + this.cellSize / 2;

        const flights: OrbFlight[] = neighbors.map(([nr, nc]) => {
          const tx = this.offsetX + nc * this.cellSize + this.cellSize / 2;
          const ty = this.offsetY + nr * this.cellSize + this.cellSize / 2;
          return {
            startX: cx,
            startY: cy,
            endX: tx,
            endY: ty,
            progress: 0,
            color: e.color,
            radius: this.getOrbRadius(1, this.cellSize),
            dirAngle: Math.atan2(ty - cy, tx - cx),
          };
        });

        this.explosionQueue.push({
          row: e.r,
          col: e.c,
          color: e.color,
          sourceOrb: e.orb,
          neighbors,
          flights,
          chainIndex: idx,
          startDelay: idx * 0.16,
          elapsed: 0,
          active: false,
          done: false,
          ringRadius: 0,
          impactHandled: false,
          soundPlayed: false,
        });
      }

      // Screen shake based on chain length
      const chainLen = exploded.length;
      if (chainLen >= 3 && chainLen <= 5) {
        this.screenShaker.addShake(3, 200);
      } else if (chainLen >= 6 && chainLen <= 10) {
        this.screenShaker.addShake(6, 300);
        // Vignette pulse on screen edges
        this.vignetteAlpha = 0.35;
        this.vignetteDecay = 0.35 / 0.4;
      } else if (chainLen >= 11) {
        this.screenShaker.addShake(12, 500);
        this.flashOverlayAlpha = 0.18;
        this.flashOverlayDecay = 0.18 / 0.4;
        this.vignetteAlpha = 0.5;
        this.vignetteDecay = 0.5 / 0.5;
      }
    }
  }

  private updateCellVelocity(r: number, c: number, orb: Orb): void {
    const ca = this.cellAnims[r]?.[c];
    if (!ca) return;

    const critMass = getCriticalMass(r, c, this.rows, this.cols);
    const remaining = critMass - orb.mass;

    let targetVel: number;
    if (remaining >= 3) targetVel = 0.3;
    else if (remaining === 2) targetVel = 0.6;
    else if (remaining === 1) targetVel = 1.4;
    else targetVel = 3.0;

    const colorIdx = this.playerColorIndex[orb.color] ?? 0;
    const dir = colorIdx % 2 === 0 ? 1 : -1;
    ca.targetVelocity = targetVel * dir;
  }

  // ── MAIN LOOP ──────────────────────────────────────────

  private _loop(timestamp: number): void {
    const dt = Math.min(timestamp - this.lastFrameTime, 50);
    this.lastFrameTime = timestamp;
    this.globalTime += dt;
    const dtSec = dt / 1000;

    this.updateExplosions(dtSec);
    this.updateCellAnimations(dtSec);

    if (this.flashOverlayAlpha > 0) {
      this.flashOverlayAlpha -= this.flashOverlayDecay * dtSec;
      if (this.flashOverlayAlpha < 0) this.flashOverlayAlpha = 0;
    }
    if (this.vignetteAlpha > 0) {
      this.vignetteAlpha -= this.vignetteDecay * dtSec;
      if (this.vignetteAlpha < 0) this.vignetteAlpha = 0;
    }

    this.drawFrame();

    this.animFrameId = requestAnimationFrame((t) => this._loop(t));
  }

  private updateCellAnimations(dtSec: number): void {
    const grid = this.currentGrid;
    if (!grid) return;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ca = this.cellAnims[r][c];

        // Smooth angular velocity transition (~200ms)
        const lerpSpeed = 1 - Math.pow(0.001, dtSec);
        ca.angularVelocity = lerp(
          ca.angularVelocity,
          ca.targetVelocity,
          lerpSpeed,
        );

        ca.angle += ca.angularVelocity * dtSec;

        // Landing flash: 0 → 0.55 → 0 over 100ms (50ms up, 50ms down)
        if (ca.landingFlashTime >= 0) {
          ca.landingFlashTime += dtSec;
          if (ca.landingFlashTime < 0.05) {
            ca.landingFlashOpacity = 0.55 * (ca.landingFlashTime / 0.05);
          } else if (ca.landingFlashTime < 0.1) {
            ca.landingFlashOpacity =
              0.55 * (1 - (ca.landingFlashTime - 0.05) / 0.05);
          } else {
            ca.landingFlashOpacity = 0;
            ca.landingFlashTime = -1;
          }
        }

        // Landing bounce timer
        if (ca.landingBounceTime >= 0) {
          ca.landingBounceTime += dtSec;
          if (ca.landingBounceTime > 0.1) {
            ca.landingBounceTime = -1;
          }
        }

        // Orb spawn pop
        const orb = grid[r]?.[c];
        const orbCount = orb ? Math.min(orb.mass, 4) : 0;
        for (let i = 0; i < ca.orbScales.length && i < orbCount; i++) {
          if (ca.orbScales[i] < 1) {
            ca.orbSpawnTimers[i] += dtSec;
            const t = clamp01(ca.orbSpawnTimers[i] / 0.18);
            ca.orbScales[i] = easeOutBack(t);
          }
        }
      }
    }
  }

  private updateExplosions(dtSec: number): void {
    const batchElapsed = (this.globalTime - this.explosionBatchTime) / 1000;

    for (const exp of this.explosionQueue) {
      if (exp.done) continue;

      if (!exp.active) {
        if (batchElapsed >= exp.startDelay) {
          exp.active = true;
        } else {
          continue;
        }
      }

      exp.elapsed += dtSec;

      // Play sound at activation
      if (!exp.soundPlayed) {
        exp.soundPlayed = true;
        const sm = getSoundManager();
        // Pitch escalation: 1.0 + stepIndex * 0.08, capped at 2.0
        const pitch = Math.min(2.0, 1.0 + exp.chainIndex * 0.08);
        if (exp.chainIndex === 0) {
          // First explosion: deeper "explode" tone
          sm.playTone(200 * pitch, 120, "sine");
        } else {
          // Chain steps: higher "chain" tone
          sm.playTone(400 * pitch, 100, "sine");
        }
      }

      // Phase 1: Charge (0–80ms)
      if (exp.elapsed < 0.08) {
        const t = exp.elapsed / 0.08;
        exp.ringRadius = t * this.cellSize * 0.7;

        // Override cell spin to fast blur
        const ca = this.cellAnims[exp.row]?.[exp.col];
        if (ca) {
          ca.angularVelocity = 8.0;
          ca.targetVelocity = 8.0;
        }
      }

      // Phase 2: Scatter (80ms–280ms, 200ms duration)
      if (exp.elapsed >= 0.08 && exp.elapsed < 0.28) {
        const scatterT = clamp01((exp.elapsed - 0.08) / 0.2);
        for (const f of exp.flights) {
          f.progress = scatterT;
        }
      }

      // Phase 3: Impact (starts at 240ms)
      if (exp.elapsed >= 0.24 && !exp.impactHandled) {
        exp.impactHandled = true;
        for (const f of exp.flights) {
          // Landing bounce on target cell
          const cell = this.getCellFromPixel(f.endX, f.endY);
          if (cell) {
            const ca = this.cellAnims[cell[0]]?.[cell[1]];
            if (ca) {
              ca.landingBounceTime = 0;
              ca.landingBounceColor = f.color;
              ca.landingFlashTime = 0; // start the 0→0.55→0 ramp
              ca.landingFlashOpacity = 0;
            }
          }
        }
      }

      // Done after 400ms
      if (exp.elapsed >= 0.4) {
        exp.done = true;
      }
    }

    this.explosionQueue = this.explosionQueue.filter((e) => !e.done);
  }

  // ── DRAWING ─────────────────────────────────────────────

  private drawFrame(): void {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const canvasW = this.canvas.width / dpr;
    const canvasH = this.canvas.height / dpr;
    const shake = this.screenShaker.getOffset();

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.save();
    ctx.translate(shake.x, shake.y);

    this.drawGridLines(ctx);

    if (this.currentGrid) {
      this.drawCellsAndOrbs(ctx, this.currentGrid);
    }

    this.drawExplosionEffects(ctx);

    ctx.restore();

    // White flash overlay (chain 11+)
    if (this.flashOverlayAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashOverlayAlpha;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.restore();
    }

    // Vignette pulse (chain 6+)
    if (this.vignetteAlpha > 0) {
      ctx.save();
      const vigGrad = ctx.createRadialGradient(
        canvasW / 2,
        canvasH / 2,
        Math.min(canvasW, canvasH) * 0.3,
        canvasW / 2,
        canvasH / 2,
        Math.max(canvasW, canvasH) * 0.75,
      );
      vigGrad.addColorStop(0, "rgba(0,0,0,0)");
      vigGrad.addColorStop(1, `rgba(0,0,0,${this.vignetteAlpha})`);
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.restore();
    }
  }

  private drawGridLines(ctx: CanvasRenderingContext2D): void {
    const cs = this.cellSize;
    const ox = this.offsetX;
    const oy = this.offsetY;
    const gridW = cs * this.cols;
    const gridH = cs * this.rows;

    ctx.strokeStyle = this.gridAccentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(ox - 1, oy - 1, gridW + 2, gridH + 2);

    for (let r = 0; r <= this.rows; r++) {
      const y = oy + r * cs;
      ctx.strokeStyle = r === 0 ? this.gridAccentColor : this.gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox, y);
      ctx.lineTo(ox + gridW, y);
      ctx.stroke();
    }
    for (let c = 0; c <= this.cols; c++) {
      const x = ox + c * cs;
      ctx.strokeStyle = c === 0 ? this.gridAccentColor : this.gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, oy);
      ctx.lineTo(x, oy + gridH);
      ctx.stroke();
    }
  }

  private drawCellsAndOrbs(
    ctx: CanvasRenderingContext2D,
    grid: (Orb | null)[][],
  ): void {
    const cs = this.cellSize;
    const ox = this.offsetX;
    const oy = this.offsetY;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = ox + c * cs;
        const y = oy + r * cs;
        const ca = this.cellAnims[r][c];
        const orb = grid[r]?.[c];

        // Selected cell highlight
        if (
          this.selectedCell &&
          this.selectedCell[0] === r &&
          this.selectedCell[1] === c
        ) {
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
        }

        // Landing flash
        if (ca.landingFlashOpacity > 0) {
          ctx.save();
          ctx.globalAlpha = ca.landingFlashOpacity;
          ctx.fillStyle = ca.landingBounceColor;
          ctx.fillRect(x, y, cs, cs);
          ctx.restore();
        }

        // Critical warning pulse
        if (orb) {
          const critMass = getCriticalMass(r, c, this.rows, this.cols);
          if (orb.mass >= critMass) {
            const pulseAlpha = 0.15 + 0.15 * Math.sin(this.globalTime * 0.012);
            ctx.save();
            ctx.globalAlpha = pulseAlpha;
            ctx.fillStyle = ORB_HEX[orb.color] || "#888";
            ctx.fillRect(x, y, cs, cs);
            ctx.restore();
          }
        }

        // Skip orbs for cells that are in charge/scatter phase of explosion
        const isExpSource = this.explosionQueue.some(
          (e) => e.row === r && e.col === c && e.active && e.elapsed < 0.21,
        );

        if (orb && !isExpSource) {
          this.drawOrbsInCell(ctx, r, c, x, y, cs, orb, ca);
        }
      }
    }
  }

  private drawOrbsInCell(
    ctx: CanvasRenderingContext2D,
    _row: number,
    _col: number,
    cellX: number,
    cellY: number,
    cs: number,
    orb: Orb,
    ca: CellAnimState,
  ): void {
    const cx = cellX + cs / 2;
    const cy = cellY + cs / 2;
    const color = ORB_HEX[orb.color] || "#888888";
    const mass = Math.min(orb.mass, 4);
    const radius = this.getOrbRadius(mass, cs);
    const positions = this.getOrbPositions(mass, cx, cy, cs);

    // Landing bounce scale
    let bounceScale = 1.0;
    if (ca.landingBounceTime >= 0) {
      const bt = ca.landingBounceTime;
      if (bt < 0.04) {
        bounceScale = 1.0 + 0.35 * easeOutQuad(bt / 0.04);
      } else {
        const st = clamp01((bt - 0.04) / 0.06);
        bounceScale = 1.35 - 0.35 * easeInOutQuad(st);
      }
    }

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];

      // Idle size pulse
      const pulsePeriod = 2.0;
      const pulseOffset = i * 0.4;
      const pulseT = (this.globalTime / 1000 + pulseOffset) / pulsePeriod;
      const idleScale = 0.95 + 0.1 * Math.sin(pulseT * Math.PI * 2);

      // Spawn pop scale
      const spawnScale =
        ca.orbScales[i] !== undefined ? Math.max(ca.orbScales[i], 0.01) : 1;

      const finalScale = idleScale * spawnScale * bounceScale;
      const finalRadius = radius * finalScale;

      // Spin angle for self-rotation visual
      const spinAngle = ca.angle + (i * Math.PI * 2) / Math.max(mass, 1);

      this.drawOrb3D(ctx, pos.x, pos.y, finalRadius, color, spinAngle);
    }
  }

  /** Fixed positions in cell (no orbiting) */
  private getOrbPositions(
    mass: number,
    cx: number,
    cy: number,
    cs: number,
  ): { x: number; y: number }[] {
    const off = cs * 0.2;
    const m = Math.min(mass, 4);
    switch (m) {
      case 1:
        return [{ x: cx, y: cy }];
      case 2:
        return [
          { x: cx - off * 0.7, y: cy - off * 0.3 },
          { x: cx + off * 0.7, y: cy + off * 0.3 },
        ];
      case 3:
        return [
          { x: cx, y: cy - off * 0.8 },
          { x: cx - off * 0.8, y: cy + off * 0.5 },
          { x: cx + off * 0.8, y: cy + off * 0.5 },
        ];
      default:
        return [
          { x: cx - off * 0.7, y: cy - off * 0.7 },
          { x: cx + off * 0.7, y: cy - off * 0.7 },
          { x: cx - off * 0.7, y: cy + off * 0.7 },
          { x: cx + off * 0.7, y: cy + off * 0.7 },
        ];
    }
  }

  private getOrbRadius(mass: number, cs: number): number {
    switch (Math.min(mass, 4)) {
      case 1:
        return cs * 0.25;
      case 2:
        return cs * 0.2;
      case 3:
        return cs * 0.17;
      default:
        return cs * 0.15;
    }
  }

  /**
   * Draw a 3D-looking orb. The colored gradient highlight rotates
   * with `spinAngle` to show the ball spinning in place. The white
   * specular highlight stays fixed (simulates fixed overhead light).
   */
  private drawOrb3D(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    baseColor: string,
    spinAngle: number = 0,
  ): void {
    if (radius < 0.5) return;
    const [rr, gg, bb] = parseHex(baseColor);

    // Drop shadow
    ctx.beginPath();
    ctx.ellipse(
      cx + 1,
      cy + radius * 0.5,
      radius * 0.65,
      radius * 0.15,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fill();

    // Main sphere gradient — bright spot rotates with spin
    const hlDist = radius * 0.3;
    const hlX = cx + Math.cos(spinAngle) * hlDist;
    const hlY = cy + Math.sin(spinAngle) * hlDist;

    const grad = ctx.createRadialGradient(hlX, hlY, 0, cx, cy, radius);
    const lr = Math.min(255, rr + 80);
    const lg = Math.min(255, gg + 80);
    const lb = Math.min(255, bb + 80);
    grad.addColorStop(0, `rgb(${lr},${lg},${lb})`);
    grad.addColorStop(0.45, baseColor);
    const dr = Math.floor(rr * 0.25);
    const dg = Math.floor(gg * 0.25);
    const db = Math.floor(bb * 0.25);
    grad.addColorStop(1, `rgb(${dr},${dg},${db})`);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Specular highlight — FIXED at upper-left (never rotates)
    const specGrad = ctx.createRadialGradient(
      cx - radius * 0.3,
      cy - radius * 0.3,
      0,
      cx - radius * 0.25,
      cy - radius * 0.25,
      radius * 0.55,
    );
    specGrad.addColorStop(0, "rgba(255,255,255,0.75)");
    specGrad.addColorStop(0.4, "rgba(255,255,255,0.15)");
    specGrad.addColorStop(1, "rgba(255,255,255,0)");

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = specGrad;
    ctx.fill();

    // Rim glow
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${rr},${gg},${bb},0.4)`;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // ── EXPLOSION EFFECTS ──────────────────────────────────

  private drawExplosionEffects(ctx: CanvasRenderingContext2D): void {
    const cs = this.cellSize;

    for (const exp of this.explosionQueue) {
      if (!exp.active) continue;

      const cellX = this.offsetX + exp.col * cs;
      const cellY = this.offsetY + exp.row * cs;
      const cx = cellX + cs / 2;
      const cy = cellY + cs / 2;

      // ── Phase 1: Charge (0–80ms) ──
      if (exp.elapsed < 0.08) {
        const t = exp.elapsed / 0.08;

        // Cell background flash: 0→1 over 30ms, 1→0 over 30ms
        let flashAlpha: number;
        if (exp.elapsed < 0.03) {
          flashAlpha = exp.elapsed / 0.03;
        } else {
          flashAlpha = 1 - (exp.elapsed - 0.03) / 0.03;
        }
        ctx.save();
        ctx.globalAlpha = clamp01(flashAlpha);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(cellX, cellY, cs, cs);
        ctx.restore();

        // Expanding ring
        const ringR = exp.ringRadius;
        const ringAlpha = 0.8 * (1 - t);
        ctx.save();
        ctx.globalAlpha = ringAlpha;
        ctx.strokeStyle = exp.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Draw source orbs (from snapshot) spinning fast
        const ca = this.cellAnims[exp.row]?.[exp.col];
        if (ca) {
          const mass = Math.min(exp.sourceOrb.mass, 4);
          const radius = this.getOrbRadius(mass, cs);
          const positions = this.getOrbPositions(mass, cx, cy, cs);
          // Scale pulse: 1.0 → 1.12 ease-out
          const chargeScale = 1.0 + 0.12 * easeOutQuad(t);

          for (let i = 0; i < positions.length; i++) {
            const spinAngle = ca.angle + (i * Math.PI * 2) / Math.max(mass, 1);
            this.drawOrb3D(
              ctx,
              positions[i].x,
              positions[i].y,
              radius * chargeScale,
              exp.color,
              spinAngle,
            );
          }
        }
      }

      // ── Phase 2: Scatter (80ms–280ms, 200ms duration) ──
      if (exp.elapsed >= 0.08 && exp.elapsed < 0.28) {
        // Source cell: scale snaps back (1.12 → 0.9 → 1.0 over 80ms)
        const releaseT = clamp01((exp.elapsed - 0.08) / 0.08);
        if (releaseT < 0.5) {
          // Fade source cell background from player color → transparent
          const fadeAlpha = 0.3 * (1 - releaseT * 2);
          ctx.save();
          ctx.globalAlpha = fadeAlpha;
          ctx.fillStyle = exp.color;
          ctx.fillRect(cellX, cellY, cs, cs);
          ctx.restore();
        }

        // Draw flying orbs with trails
        for (const f of exp.flights) {
          const t = f.progress;
          // Current position (straight line)
          const px = f.startX + (f.endX - f.startX) * t;
          const py = f.startY + (f.endY - f.startY) * t;

          // Trail: 8 circles over last 55px
          const totalDist = Math.sqrt(
            (f.endX - f.startX) ** 2 + (f.endY - f.startY) ** 2,
          );
          const traveledDist = t * totalDist;
          const trailLen = Math.min(55, traveledDist);

          if (trailLen > 1) {
            const trailSteps = 8;
            const dirLen = totalDist || 1;
            const nx = (f.endX - f.startX) / dirLen;
            const ny = (f.endY - f.startY) / dirLen;

            ctx.save();
            for (let s = 0; s < trailSteps; s++) {
              const frac = s / (trailSteps - 1); // 0=tail, 1=head
              const trailX = px - nx * trailLen * (1 - frac);
              const trailY = py - ny * trailLen * (1 - frac);
              const orbAlpha = frac;
              const orbSize = f.radius * (0.15 + 0.85 * frac);

              ctx.globalAlpha = orbAlpha;
              ctx.fillStyle = f.color;
              ctx.beginPath();
              ctx.arc(trailX, trailY, orbSize, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }

          // Draw flying orb at current position
          this.drawOrb3D(ctx, px, py, f.radius, f.color);
        }
      }
    }
  }

  // ── UTILITIES ───────────────────────────────────────────

  addScreenShake(): void {
    this.screenShaker.addShake(4, 200);
  }

  destroy(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    window.removeEventListener("resize", this.resizeHandler);
    this.particles.clear();
    this.screenShaker.clear();
  }
}
