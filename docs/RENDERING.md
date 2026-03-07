# Rendering Engine

The rendering engine (`lib/rendering.ts`) is a custom Canvas 2D renderer built around the `BoardRenderer` class. It runs a 60fps animation loop and handles all visual aspects of the game — grid drawing, orb rendering with multi-layer visuals, explosion animations, screen shake, and overlay effects.

## BoardRenderer Class

### Constructor

```typescript
new BoardRenderer(canvas: HTMLCanvasElement, rows: number = 9, cols: number = 6)
```

Initializes:

- Canvas context (`2d`)
- Per-cell animation states (`CellAnimState[][]`)
- Resize handler (responsive layout)
- 60fps animation loop via `requestAnimationFrame`

### Public API

| Method                      | Description                                              |
| --------------------------- | -------------------------------------------------------- |
| `renderOnce(grid, players)` | Push new grid + players to the renderer for display      |
| `setSelectedCell(row, col)` | Highlight a cell (or `null, null` to clear)              |
| `setGridColor(playerColor)` | Set grid tint based on current turn's player color       |
| `getCellFromPixel(x, y)`    | Convert pixel coordinates to `[row, col]` or `null`      |
| `hasActiveExplosions()`     | Returns `true` if explosion animations are still playing |
| `destroy()`                 | Cancel animation loop, remove resize listener            |

### Layout Calculation

The renderer dynamically sizes cells to fit the canvas:

```
cellSize = min(availableWidth / cols, availableHeight / rows)
offsetX  = (canvasWidth - gridWidth) / 2
offsetY  = (canvasHeight - gridHeight) / 2
```

The canvas is DPR-aware: it sets `canvas.width` to `rect.width * devicePixelRatio` and uses `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`.

## Color System

### Player Colors (Rendering)

Used for orbs, explosions, and grid tinting. Indexed by player position (0-based):

```typescript
const PLAYER_HEX: string[] = [
  "#FF4444", // player 0: red
  "#4488FF", // player 1: blue
  "#44FF88", // player 2: green
  "#FFD700", // player 3: yellow
  "#CC44FF", // player 4: purple
  "#FF8844", // player 5: orange
];
```

### Grid Colors

Each player color maps to a dark tinted grid:

| Player | Grid Main | Grid Accent |
| ------ | --------- | ----------- |
| Red    | `#4d2222` | `#2a1111`   |
| Blue   | `#224d7d` | `#112a4d`   |
| Green  | `#224d22` | `#112a11`   |
| Yellow | `#7d7d22` | `#4d4d11`   |
| Purple | `#4d224d` | `#2a112a`   |

The grid color changes every turn to reflect whose turn it is.

### Color Utilities

```typescript
function lighten(hex: string, percent: number): string; // toward white
function darken(hex: string, percent: number): string; // toward black
```

## Per-Cell Animation State

Each cell has its own animation state tracked in `CellAnimState`:

```typescript
interface CellAnimState {
  angle: number; // orbit angle for multi-orb rotation
  angularVelocity: number; // current rotation speed (rad/sec)
  targetVelocity: number; // lerp target
  pulsePhase: number; // idle pulse sine offset
  pulsePeriod: number; // 2.0s normal, 0.6s danger
  pulseScale: number; // computed each frame
  orbScales: number[]; // per-orb spawn pop animation
  orbSpawnTimers: number[]; // spawn timing
  landingBounceTime: number; // impact bounce (-1 = inactive)
  landingBounceColor: string;
  landingFlashOpacity: number;
  landingFlashTime: number; // landing flash timer
}
```

### Rotation Rules

- **1 orb**: Never rotates (`targetVelocity = 0`), only pulses
- **2+ orbs, remaining > 1**: Slow orbit (`0.8 rad/sec`), direction based on player index (even = CW, odd = CCW)
- **2+ orbs, remaining = 1**: Fast urgent orbit (`1.8 rad/sec`) — cell is about to explode
- **Corner with 1 orb** (remaining = 1): Fast danger pulse (`0.6s period` vs normal `2.0s`)
- Angular velocity transitions use exponential lerp (~200ms smoothing)

### Orb Positioning (Orbiting)

Multi-orb cells use orbital positioning via `getOrbPositions()`:

| Orbs | Layout                         |
| ---- | ------------------------------ |
| 1    | Center                         |
| 2    | Opposite sides on orbit circle |
| 3    | Evenly spaced at 120°          |
| 4+   | Evenly spaced at `360°/n`      |

The orbit radius is `cellSize * 0.18`, and the angle advances based on `angularVelocity`.

## 4-Layer Orb Rendering

Each orb is drawn with 4 visual layers via `drawOrbComplete()`:

### Layer 1: Glow

A radial gradient from the player's color (40% opacity) to transparent, drawn as a circle 2× the orb radius. Creates a soft ambient glow around the orb.

### Layer 2: Body Gradient

A radial gradient with 4 color stops:

1. `lighten(color, 80%)` at 0% — bright highlight at top-left
2. `color` at 40% — true color in mid-section
3. `darken(color, 30%)` at 75% — shadow
4. `darken(color, 50%)` at 100% — deep shadow at edge

The gradient origin is offset to `(-0.3r, -0.3r)` for a 3D lighting effect.

### Layer 3: Rotating Texture Stripes

4 thin arc stripes (`0.3 rad` wide, `0.55r` to `0.85r`) at 90° intervals. Colors are lighten/darken alternating. The stripes rotate at `globalTime * 0.001` for a spinning surface effect.

### Layer 4: Specular Highlight

A small white radial gradient at `(-0.25r, -0.3r)` with radius `0.35r`. Simulates a glossy reflection.

Each orb also has `pulseScale` applied for idle breathing animation.

## Explosion Animation System

### Change Detection

When `renderOnce()` receives a new grid, `detectChanges()` compares it to the previous grid:

- **Exploded cells**: Had orbs → now empty. Queued as `ExplosionEntry`.
- **Gained cells**: Orb count increased. Trigger spawn-pop animation.

### Explosion Phases

Each `ExplosionEntry` has three visual phases:

#### 1. Charge Phase (0–0.12s)

- Expanding ring from center of source cell
- Ring color is the player's orb color with fading opacity
- Source cell orbs freeze during charge

#### 2. Scatter Phase (0.12–0.40s)

- `OrbFlight` objects travel in straight lines from source to each neighbor
- Progress goes 0→1 over ~0.28s with `easeOutQuad`
- Trailing glow follows each flying orb

#### 3. Impact Phase (0.40s+)

- Landing flash on destination cells (`landingFlashOpacity`)
- Landing bounce effect (`landingBounceTime`)
- Sound effect plays on impact

### Orb Flights

```typescript
interface OrbFlight {
  startX;
  startY: number; // source cell center (pixels)
  endX;
  endY: number; // neighbor cell center (pixels)
  progress: number; // 0 → 1
  color: string; // player hex color
  radius: number; // orb size during flight
  dirAngle: number; // direction of travel (for particle trail)
}
```

### Screen Shake Tiers

Based on how many cells explode in one move:

| Chain Length | Shake Intensity | Duration | Extra Effects                        |
| ------------ | --------------- | -------- | ------------------------------------ |
| 1–2          | None            | —        | —                                    |
| 3–5          | 3               | 200ms    | —                                    |
| 6–10         | 6               | 300ms    | Vignette pulse (35% opacity)         |
| 11+          | 12              | 500ms    | Flash overlay (18%) + vignette (50%) |

The `ScreenShaker` class manages multiple concurrent shakes:

```typescript
class ScreenShaker {
  addShake(intensity: number, duration: number): void;
  getOffset(): { x: number; y: number }; // random offset, decays over time
  clear(): void;
}
```

## Grid Drawing

### Grid Lines

Cells are drawn as filled rounded rectangles with a 2px gap. Colors:

- **Empty cells**: `gridColor` (dark tinted)
- **Owned cells**: 10% tint of owner's color over the grid color

### Critical Mass Indicators

When a cell has `orbs >= criticalMass - 1` (one away from exploding), small dots are drawn at the cell corners to indicate danger.

### Cell Ownership Tint

Occupied cells get a subtle background tint matching the owner's player color, drawn as a semi-transparent overlay on the grid cell.

## Easing Functions

```typescript
function easeOutBack(t: number): number; // overshoot bounce
function easeOutQuad(t: number): number; // smooth deceleration
function easeInOutQuad(t: number): number; // smooth acceleration/deceleration
function lerp(a: number, b: number, t: number): number;
function clamp01(t: number): number;
```

## Performance Notes

- The renderer runs at 60fps via `requestAnimationFrame`
- Delta time is clamped to 50ms max to prevent large jumps
- Grid is only redrawn during the animation loop — `renderOnce()` just updates data, doesn't force a draw
- Canvas uses DPR scaling for crisp rendering on Retina displays
