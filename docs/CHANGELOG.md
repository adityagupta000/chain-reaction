# Changelog

All notable changes to this project.

---

## Latest — Visual Overhaul & Bug Fixes

### Visual Enhancements

- **4-layer orb rendering**: Each orb now renders with glow, body gradient, rotating texture stripes, and specular highlight
- **Orbiting multi-orb cells**: Cells with 2+ orbs display them orbiting around the center, with speed that increases near critical mass
- **Shadow removal**: Removed drop shadows from orbs for a cleaner look
- **Per-turn grid color**: Grid cells tint to match the current player's color each turn
- **Critical mass dots**: Small indicator dots appear on cells that are one orb away from exploding
- **Spawn pop animation**: New orbs scale from 0 to 1 with easeOutBack for a bouncy entrance
- **Landing bounce/flash**: Impact effects when orbs land on cells after an explosion
- **Idle pulse**: Single orbs pulse with a breathing sine wave; corner cells with 1 orb pulse faster (danger indication)

### Explosion Effects

- **3-phase explosion animation**: Charge ring → scatter flights → impact flash
- **Orb flights**: Orbs fly in straight lines from exploding cell to neighbors with trailing glow
- **Screen shake tiers**: Small chains (3–5) get light shake; medium chains (6–10) add vignette; large chains (11+) add flash overlay
- **Chain delay staggering**: Explosions within a batch are staggered by 0.2s for visual clarity

### Bug Fixes (11 issues resolved)

1. **`renderOnce` method missing**: `BoardRenderer` had no public method to update the display — added `renderOnce(grid, players)` that pushes new state to the renderer
2. **`useIsMyTurn` broken**: Was checking non-existent `boardState.turn` property — fixed to use `boardState.currentPlayerIndex`
3. **Non-existent exports in `lib/index.ts`**: Was exporting `validateMove`, `getNextTurn`, `getValidMoves` which don't exist — updated to export `isValidMove`, `getNextActivePlayer`, `getEliminatedPlayers`
4. **Mock socket event name mismatch**: Was emitting `game:moveReceived` — changed to `game:moveResult` to match client listeners
5. **Mock socket empty players on create**: `create_room` handler had empty `players: []` — now adds host to the array
6. **Mock socket join missing player push**: `join_room` didn't add the guest to `players` — now pushes guest player
7. **Server missing turn order validation**: `game:move` handler didn't check if it was the submitting player's turn — added `playerIndex !== boardState.currentPlayerIndex` check
8. **Mock socket missing turn order validation**: `submit_move` didn't validate turn order — added same check as server
9. **`createBoardState` wrong argument type on server**: Called with `playerId` (string) instead of `0` (number) — fixed to `createBoardState(0, gridRows, gridCols)`
10. **`useGameTimer` multiple issues**: Was using hardcoded `6×6` grid, wrong cell check, missing `currentPlayerIndex` dependency — complete rewrite with actual grid dimensions and correct dependencies
11. **`useRef` missing initial value**: React 19 requires explicit initial value — added `undefined` to `useRef<>()` calls

### Infrastructure

- Verified production build passes (`pnpm build` exits 0)
- All 14 modified files committed individually to git
