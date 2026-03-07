import { Cell, Player, ScreenShakeState, ExplosionStep } from "./types";
import { getCriticalMass } from "./gameEngine";
import { getSoundManager } from "./soundManager";

// ============================================================================
// COLOR MAP (Maps player index to hex colors)
// ============================================================================

const PLAYER_HEX: string[] = [
  "#FF4444", // player 0: red
  "#4488FF", // player 1: blue
  "#44FF88", // player 2: green
  "#FFD700", // player 3: yellow
  "#CC44FF", // player 4: purple
  "#FF8844", // player 5: orange
];

// Color hex codes by player color name (kept for legacy grid coloring)
const ORB_HEX: Record<string, string> = {
  red: "#FF0000",
  green: "#00FF00",
  blue: "#0088FF",
  yellow: "#FFFF00",
  purple: "#FF00FF",
};

function parseHex(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// Lighten a hex color by a percentage (toward white)
function lighten(hex: string, percent: number): string {
  const [r, g, b] = parseHex(hex);
  const amt = Math.floor((255 - Math.max(r, g, b)) * (percent / 100));
  const nr = Math.min(255, r + amt);
  const ng = Math.min(255, g + amt);
  const nb = Math.min(255, b + amt);
  return `rgb(${nr},${ng},${nb})`;
}

// Darken a hex color by a percentage (toward black)
function darken(hex: string, percent: number): string {
  const [r, g, b] = parseHex(hex);
  const amt = Math.floor(Math.max(r, g, b) * (percent / 100));
  const nr = Math.max(0, r - amt);
  const ng = Math.max(0, g - amt);
  const nb = Math.max(0, b - amt);
  return `rgb(${nr},${ng},${nb})`;
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
  angle: number; // orbit angle in radians
  angularVelocity: number; // current rotation speed rad/sec
  targetVelocity: number; // lerp target based on remaining orbs
  pulsePhase: number; // idle pulse phase offset (radians)
  pulsePeriod: number; // 2.0s normal, 0.6s danger (corner with 1 orb)
  pulseScale: number; // computed each frame from sine
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
  playerIndex: number;
  sourceOrbCount: number; // number of orbs that exploded
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
  private currentGrid: Cell[][] | null = null;
  private players: Player[] = [];

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
      angularVelocity: 0,
      targetVelocity: 0,
      pulsePhase: Math.random() * Math.PI * 2,
      pulsePeriod: 2.0, // normal idle pulse
      pulseScale: 1.0,
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
    // Map player colors to tinted grid colors based on actual orb hex colors
    // Grid should be a darker, more saturated version of the player's orb color
    const gridColorMap: Record<string, { main: string; accent: string }> = {
      red: { main: "#4d2222", accent: "#2a1111" }, // darker red from #FF4444
      blue: { main: "#224d7d", accent: "#112a4d" }, // darker blue from #4488FF
      green: { main: "#224d22", accent: "#112a11" }, // darker green from #44FF88
      yellow: { main: "#7d7d22", accent: "#4d4d11" }, // darker yellow from #FFD700
      purple: { main: "#4d224d", accent: "#2a112a" }, // darker purple from #CC44FF
    };

    // Normalize the color string - convert to lowercase and trim whitespace
    const normalizedColor = (playerColor || "").trim().toLowerCase();

    // Try to find the color in the map
    let colors = gridColorMap[normalizedColor];

    // If not found, use default gray
    if (!colors) {
      colors = {
        main: "#1a1a1a",
        accent: "#0d0d0d",
      };
    }

    this.gridColor = colors.main;
    this.gridAccentColor = colors.accent;
  }

  private updateGrid(grid: Cell[][]): void {
    const prev = this.currentGrid;
    this.currentGrid = grid;

    // First render - initialize all cells with animation states
    if (!prev) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const cell = grid[r]?.[c];
          if (cell && cell.orbs > 0) {
            const ca = this.cellAnims[r]?.[c];
            if (ca) {
              // Initialize spawn scales for initial orbs
              while (ca.orbScales.length < cell.orbs) {
                ca.orbScales.push(1); // Start at full scale for initial render
                ca.orbSpawnTimers.push(0);
              }
              ca.orbScales.length = cell.orbs;
              ca.orbSpawnTimers.length = cell.orbs;
            }
          }
        }
      }
      return;
    }

    this.detectChanges(prev, grid);
  }

  // ── CHANGE DETECTION ────────────────────────────────────

  private detectChanges(oldGrid: Cell[][], newGrid: Cell[][]): void {
    const exploded: {
      r: number;
      c: number;
      color: string;
      orbCount: number;
    }[] = [];
    const gained: {
      r: number;
      c: number;
      oldOrbs: number;
      newOrbs: number;
      color: string;
    }[] = [];

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const oldCell = oldGrid[r]?.[c];
        const newCell = newGrid[r]?.[c];

        if (
          oldCell &&
          oldCell.orbs > 0 &&
          newCell &&
          newCell.orbs === 0 &&
          newCell.owner === null
        ) {
          // Cell exploded (became empty after having orbs)
          const color =
            oldCell.owner !== null
              ? PLAYER_HEX[oldCell.owner] || "#888"
              : "#888";
          exploded.push({
            r,
            c,
            color,
            orbCount: oldCell.orbs,
          });
        } else if (newCell) {
          const oldOrbs = oldCell ? oldCell.orbs : 0;
          if (newCell.orbs > oldOrbs) {
            const color =
              newCell.owner !== null
                ? PLAYER_HEX[newCell.owner] || "#888"
                : "#888";
            gained.push({
              r,
              c,
              oldOrbs,
              newOrbs: newCell.orbs,
              color,
            });
          }
          this.updateCellVelocity(r, c, newCell);
        }

        if (newCell && oldCell && oldCell.orbs > 0 && newCell.orbs === 0) {
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
        while (ca.orbScales.length < g.newOrbs) {
          ca.orbScales.push(0);
          ca.orbSpawnTimers.push(0);
        }
        ca.orbScales.length = g.newOrbs;
        ca.orbSpawnTimers.length = g.newOrbs;
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
          playerIndex: oldGrid[e.r][e.c].owner ?? -1,
          sourceOrbCount: e.orbCount,
          neighbors,
          flights,
          chainIndex: idx,
          startDelay: idx * 0.2,
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

  private updateCellVelocity(r: number, c: number, cell: Cell): void {
    const ca = this.cellAnims[r]?.[c];
    if (!ca) return;

    const critMass = getCriticalMass(r, c, this.rows, this.cols);
    const remaining = critMass - cell.orbs;
    const playerIdx = cell.owner ?? 0;
    const direction = playerIdx % 2 === 0 ? 1 : -1;

    // Rule 1: 1 orb never rotates
    if (cell.orbs <= 1) {
      ca.targetVelocity = 0;
      // Rule 3 special case: corner cell with 1 orb has remaining=1, fast pulse
      if (remaining === 1) {
        ca.pulsePeriod = 0.6; // danger pulse
      } else {
        ca.pulsePeriod = 2.0; // normal idle pulse
      }
    }
    // Rule 2 & 3: 2+ orbs orbit based on remaining
    else if (remaining === 1) {
      ca.targetVelocity = 1.8 * direction; // fast urgent
      ca.pulsePeriod = 2.0;
    } else {
      ca.targetVelocity = 0.8 * direction; // slow calm
      ca.pulsePeriod = 2.0;
    }
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
        const cell = grid[r]?.[c];

        // Rule 4: Smooth angular velocity transition (200ms lerp)
        const lerpSpeed = 1 - Math.pow(0.001, dtSec);
        ca.angularVelocity = lerp(
          ca.angularVelocity,
          ca.targetVelocity,
          lerpSpeed,
        );

        // Advance orbit angle (Rule 2)
        ca.angle += ca.angularVelocity * dtSec;

        // Advance pulse phase for idle animation (Rule 1)
        ca.pulsePhase += (dtSec / ca.pulsePeriod) * Math.PI * 2;
        // Calculate pulse scale from sine wave
        ca.pulseScale = 1.0 + 0.06 * Math.sin(ca.pulsePhase);
        // For corner danger pulse, increase scale range
        if (ca.pulsePeriod === 0.6) {
          ca.pulseScale = 1.0 + 0.135 * Math.sin(ca.pulsePhase);
        }

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
        const orbCount = cell ? Math.min(cell.orbs, 4) : 0;
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

      // Phase 2: Scatter (80ms–430ms, 350ms duration)
      if (exp.elapsed >= 0.08 && exp.elapsed < 0.43) {
        const scatterT = clamp01((exp.elapsed - 0.08) / 0.35);
        for (const f of exp.flights) {
          f.progress = scatterT;
        }
      }

      // Phase 3: Impact (starts at 400ms)
      if (exp.elapsed >= 0.4 && !exp.impactHandled) {
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

      // Done after 550ms
      if (exp.elapsed >= 0.55) {
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
    grid: Cell[][],
  ): void {
    const cs = this.cellSize;
    const ox = this.offsetX;
    const oy = this.offsetY;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = ox + c * cs;
        const y = oy + r * cs;
        const ca = this.cellAnims[r][c];
        const cell = grid[r]?.[c];

        // Cell ownership tint background (subtle, under orbs)
        if (cell && cell.owner !== null) {
          const ownerColor = PLAYER_HEX[cell.owner] || "#888888";
          ctx.save();
          ctx.globalAlpha = 0.08;
          ctx.fillStyle = ownerColor;
          ctx.fillRect(x, y, cs, cs);
          ctx.restore();
        }

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
        if (cell && cell.orbs > 0) {
          const critMass = getCriticalMass(r, c, this.rows, this.cols);
          if (cell.orbs >= critMass) {
            const colorHex =
              cell.owner !== null ? PLAYER_HEX[cell.owner] || "#888" : "#888";
            const pulseAlpha = 0.15 + 0.15 * Math.sin(this.globalTime * 0.012);
            ctx.save();
            ctx.globalAlpha = pulseAlpha;
            ctx.fillStyle = colorHex;
            ctx.fillRect(x, y, cs, cs);
            ctx.restore();
          }
        }

        // Skip orbs for cells that are in charge/scatter phase of explosion
        const isExpSource = this.explosionQueue.some(
          (e) => e.row === r && e.col === c && e.active && e.elapsed < 0.26,
        );

        if (cell && cell.orbs > 0 && !isExpSource) {
          this.drawOrbsInCell(ctx, r, c, x, y, cs, cell, ca);
        }

        // Critical mass indicator dots (bottom-right corner)
        if (cell && cell.orbs > 0) {
          this.drawCriticalMassDots(ctx, x, y, cs, cell, r, c);
        }
      }
    }
  }

  /**
   * Draw critical mass indicator dots in bottom-right corner of cell
   */
  private drawCriticalMassDots(
    ctx: CanvasRenderingContext2D,
    cellX: number,
    cellY: number,
    cs: number,
    cell: Cell,
    row: number,
    col: number,
  ): void {
    const padding = 5;
    const dotRadius = 2.5;
    const dotSpacing = 7;
    const critMass = getCriticalMass(row, col, this.rows, this.cols);
    const remaining = Math.max(0, critMass - cell.orbs);

    if (remaining <= 0) return; // No dots if cell will explode

    const dotCount = remaining;
    const startX =
      cellX + cs - padding - (dotCount * dotSpacing - dotSpacing / 2);
    const startY = cellY + cs - padding;

    for (let i = 0; i < dotCount; i++) {
      const dotX = startX + i * dotSpacing;
      const dotY = startY;

      ctx.beginPath();
      ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);

      // Color based on cell ownership and remaining capacity
      if (remaining === 1) {
        // Red pulsing for critical
        const pulseAlpha = 0.5 + 0.5 * Math.sin(this.globalTime * 0.01);
        ctx.fillStyle = `rgba(255,68,68,${pulseAlpha})`;
      } else if (cell.owner !== null) {
        // Player color at 40% opacity
        const ownerColor = PLAYER_HEX[cell.owner] || "#888888";
        ctx.fillStyle = ownerColor + "66";
      } else {
        // Empty cell: faint white
        ctx.fillStyle = "rgba(255,255,255,0.20)";
      }

      ctx.fill();
    }
  }

  private drawOrbsInCell(
    ctx: CanvasRenderingContext2D,
    _row: number,
    _col: number,
    cellX: number,
    cellY: number,
    cs: number,
    cell: Cell,
    ca: CellAnimState,
  ): void {
    const cx = cellX + cs / 2;
    const cy = cellY + cs / 2;
    const color =
      cell.owner !== null ? PLAYER_HEX[cell.owner] || "#888888" : "#888888";
    const orbCount = Math.min(cell.orbs, 4);
    const radius = this.getOrbRadius(orbCount, cs);

    // Get orbiting positions with animation angle
    const positions = this.getOrbPositions(orbCount, cx, cy, cs, ca.angle);

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

    // Get critical mass for glow intensity multiplier
    const critMass = getCriticalMass(_row, _col, this.rows, this.cols);
    const remaining = critMass - cell.orbs;
    let glowMultiplier = 1.0;
    if (remaining === 1) {
      glowMultiplier = 1.6; // Bright red pulse at critical
    }

    for (let i = 0; i < positions.length; i++) {
      let finalScale: number;

      if (orbCount === 1) {
        // Single orb: apply idle pulse (but NOT for corner cells)
        const isCorner =
          (_row === 0 || _row === this.rows - 1) &&
          (_col === 0 || _col === this.cols - 1);
        const pulseScale = isCorner ? 1.0 : ca.pulseScale;
        const spawnScale =
          ca.orbScales[i] !== undefined ? Math.max(ca.orbScales[i], 0.01) : 1;
        finalScale = pulseScale * spawnScale * bounceScale;
      } else {
        // Multiple orbiting orbs: subtle per-orb pulse
        const subtlePulse = 1.0 + 0.025 * Math.sin(ca.pulsePhase + i * 0.8);
        const spawnScale =
          ca.orbScales[i] !== undefined ? Math.max(ca.orbScales[i], 0.01) : 1;
        finalScale = subtlePulse * spawnScale * bounceScale;
      }

      const finalRadius = radius * finalScale;

      // Draw orb with all 4 layers: glow, body with rotation texture, specular
      this.drawOrbComplete(
        ctx,
        positions[i].x,
        positions[i].y,
        finalRadius,
        color,
        finalScale,
        glowMultiplier,
        ca.angle,
      );
    }
  }

  /** Positions in cell: single orb at center or orbiting */
  private getOrbPositions(
    mass: number,
    cx: number,
    cy: number,
    cs: number,
    orbitAngle: number = 0,
  ): { x: number; y: number }[] {
    const m = Math.min(mass, 4);
    const orbitRadius = cs * 0.22; // Orbit radius for 2+ orbs

    if (m === 1) {
      // Single orb at center
      return [{ x: cx, y: cy }];
    }

    // 2+ orbs orbit around center at evenly spaced angles
    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < m; i++) {
      const angle = orbitAngle + (i / m) * Math.PI * 2;
      const x = cx + Math.cos(angle) * orbitRadius;
      const y = cy + Math.sin(angle) * orbitRadius;
      positions.push({ x, y });
    }
    return positions;
  }

  private getOrbRadius(mass: number, cs: number): number {
    // All orbs are the same size per spec: orbRadius = cellSize * 0.18
    return cs * 0.18;
  }

  /**
   * Draw complete orb with all layers per spec:
   * - Glow circle
   * - Orb body with radial gradient
   * - Rotating surface texture (shows rotation)
   * - Specular highlight
   */
  private drawOrbComplete(
    ctx: CanvasRenderingContext2D,
    orbX: number,
    orbY: number,
    orbRadius: number,
    playerColor: string,
    scale: number = 1.0,
    glowMultiplier: number = 1.0,
    rotationAngle: number = 0,
  ): void {
    if (orbRadius < 0.5) return;

    ctx.save();
    ctx.globalAlpha *= 1.0;

    // ──────────────────────────────────────────────────────
    // 1. GLOW CIRCLE (soft colored halo)
    // ──────────────────────────────────────────────────────
    const glowRadius = orbRadius * 2.2;
    const glowGrad = ctx.createRadialGradient(
      orbX,
      orbY,
      0,
      orbX,
      orbY,
      glowRadius,
    );

    // Extract RGB for glow color stops
    const [pr, pg, pb] = parseHex(playerColor);
    glowGrad.addColorStop(
      0,
      `rgba(${pr},${pg},${pb},${0.35 * glowMultiplier})`,
    );
    glowGrad.addColorStop(
      0.6,
      `rgba(${pr},${pg},${pb},${0.1 * glowMultiplier})`,
    );
    glowGrad.addColorStop(1, `rgba(${pr},${pg},${pb},0)`);

    ctx.beginPath();
    ctx.arc(orbX, orbY, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // ──────────────────────────────────────────────────────
    // 2. ORB BODY (main sphere with radial gradient)
    // ──────────────────────────────────────────────────────
    // Gradient center: offset 30% up and 30% left from center
    const hlX = orbX - orbRadius * 0.3;
    const hlY = orbY - orbRadius * 0.3;

    const bodyGrad = ctx.createRadialGradient(
      hlX,
      hlY,
      0,
      orbX,
      orbY,
      orbRadius,
    );

    const lightColor = lighten(playerColor, 60);
    const darkColor = darken(playerColor, 50);

    bodyGrad.addColorStop(0, lightColor);
    bodyGrad.addColorStop(0.4, playerColor);
    bodyGrad.addColorStop(1, darkColor);

    ctx.beginPath();
    ctx.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // ──────────────────────────────────────────────────────
    // 2.5. ROTATING SURFACE TEXTURE (shows rotation)
    // ──────────────────────────────────────────────────────
    ctx.save();
    ctx.translate(orbX, orbY);
    ctx.rotate(rotationAngle);
    ctx.translate(-orbX, -orbY);

    // Draw rotating stripe pattern on orb surface
    const stripeCount = 4;
    const stripeWidth = (Math.PI * 2) / stripeCount;

    for (let s = 0; s < stripeCount; s++) {
      const angle = s * stripeWidth;
      const nextAngle = angle + stripeWidth * 0.35;

      ctx.beginPath();
      ctx.moveTo(orbX, orbY);
      ctx.arc(orbX, orbY, orbRadius * 0.95, angle, nextAngle);
      ctx.closePath();

      // Alternate stripe opacity for visible texture
      const stripeAlpha = s % 2 === 0 ? 0.15 : 0.05;
      ctx.fillStyle = `rgba(0,0,0,${stripeAlpha})`;
      ctx.fill();
    }

    ctx.restore();

    // ──────────────────────────────────────────────────────
    // 3. SPECULAR HIGHLIGHT (white glint, fixed position)
    // ──────────────────────────────────────────────────────
    const specX = orbX - orbRadius * 0.28;
    const specY = orbY - orbRadius * 0.28;
    const specRadius = orbRadius * 0.22;

    const specGrad = ctx.createRadialGradient(
      specX,
      specY,
      0,
      specX,
      specY,
      specRadius,
    );
    specGrad.addColorStop(0, "rgba(255,255,255,0.95)");
    specGrad.addColorStop(1, "rgba(255,255,255,0.00)");

    ctx.beginPath();
    ctx.arc(specX, specY, specRadius, 0, Math.PI * 2);
    ctx.fillStyle = specGrad;
    ctx.fill();

    ctx.restore();
  }

  /**
   * Legacy method name for backwards compatibility with flying orbs
   */
  private drawOrb3D(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    baseColor: string,
    _spinAngle: number = 0,
  ): void {
    // Use the new complete orb drawing
    this.drawOrbComplete(ctx, cx, cy, radius, baseColor, 1.0, 1.0);
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
          const orbCount = Math.min(exp.sourceOrbCount, 4);
          const radius = this.getOrbRadius(orbCount, cs);
          const positions = this.getOrbPositions(
            orbCount,
            cx,
            cy,
            cs,
            ca.angle,
          );
          // Scale pulse: 1.0 → 1.12 ease-out
          const chargeScale = 1.0 + 0.12 * easeOutQuad(t);

          for (let i = 0; i < positions.length; i++) {
            const spinAngle =
              ca.angle + (i * Math.PI * 2) / Math.max(orbCount, 1);
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

      // ── Phase 2: Scatter (80ms–430ms, 350ms duration) ──
      if (exp.elapsed >= 0.08 && exp.elapsed < 0.43) {
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

        // Draw flying orbs with trails and path lines
        for (const f of exp.flights) {
          const t = f.progress;
          // Current position (straight line)
          const px = f.startX + (f.endX - f.startX) * t;
          const py = f.startY + (f.endY - f.startY) * t;

          // Draw path line showing travel route
          ctx.save();
          ctx.strokeStyle = f.color;
          ctx.globalAlpha = 0.3 - t * 0.2; // Fade as orb moves
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(f.startX, f.startY);
          ctx.lineTo(px, py);
          ctx.stroke();
          ctx.restore();

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

  hasActiveExplosions(): boolean {
    return this.explosionQueue.length > 0;
  }

  destroy(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    window.removeEventListener("resize", this.resizeHandler);
    this.particles.clear();
    this.screenShaker.clear();
  }
}
