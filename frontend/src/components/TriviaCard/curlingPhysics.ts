/**
 * curlingPhysics — matter.js-powered simulation for the curling game.
 *
 * Realistic-ish physics for 44 lb granite stones on ice:
 *   - Velocity-dependent friction (rises at low speeds, mimics reduced
 *     meltwater lubrication as the stone slows)
 *   - Sweeping reduces friction to ~40% of base, strongest effect when
 *     the stone is drifting slowly into the house
 *   - Elastic collisions with restitution ~0.8 (granite-on-granite)
 *   - Stone-to-stone collisions (player ↔ opponent, opponent ↔ opponent)
 *   - Open top/bottom so stones can be knocked off the sheet
 *
 * The simulation runs headless — the component reads body positions
 * each frame and renders them via DOM.
 */

import Matter from 'matter-js';

// ── Sheet geometry (in px, matches CurlingGame constants) ────────

export const SHEET_WIDTH = 280;
export const SHEET_HEIGHT = 460;
export const HOUSE_CENTER_Y = 120;
export const STONE_RADIUS = 10;
export const OPPONENT_STONE_RADIUS = 10;
export const STONE_START_X = SHEET_WIDTH / 2;
export const STONE_START_Y = SHEET_HEIGHT - 50;

// ── Physics tuning ──────────────────────────────────────────────

// Restitution: real granite-on-granite at curling speeds ~0.8.
const STONE_RESTITUTION = 0.8;

// Stone-to-stone tangential friction (polished granite).
const STONE_FRICTION = 0.03;

// Base ice friction (frictionAir). Real curling ice: μ ~0.007–0.012.
// This is the baseline at medium speeds. Velocity-dependent adjustments
// happen per-frame in step().
const BASE_ICE_FRICTION = 0.006;

// Sweeping multiplier: reduces friction to this fraction of base.
// Real sweeping can cut friction 30-60%. We use 40%.
const SWEEP_FRICTION_MULT = 0.4;

// Minimum friction floor when sweeping hard.
const MIN_SWEPT_FRICTION = 0.0015;

// Density (uniform — all stones are 44 lbs).
const STONE_DENSITY = 0.01;

// Below this speed (px/frame), a stone is considered stopped.
export const STOP_THRESHOLD = 0.1;

// Wall restitution (side boards).
const WALL_RESTITUTION = 0.35;

// ── Velocity-dependent friction thresholds ──────────────────────
// At low speeds, friction rises (less meltwater = more drag).
const LOW_SPEED_THRESHOLD = 0.6;
const MED_SPEED_THRESHOLD = 1.2;
const LOW_SPEED_MULT = 1.5;
const MED_SPEED_MULT = 1.2;

// ── Types ───────────────────────────────────────────────────────

export interface StoneState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export const OFF_SHEET_MARGIN = 30;

export interface SimulationSnapshot {
  player: StoneState;
  opponents: StoneState[];
  allStopped: boolean;
  playerOffSheet: boolean;
  opponentsOffSheet: boolean[];
}

// ── Helpers ─────────────────────────────────────────────────────

function bodySpeed(b: Matter.Body): number {
  return Math.sqrt(b.velocity.x ** 2 + b.velocity.y ** 2);
}

function velocityFriction(speed: number, base: number, swept: boolean): number {
  let f = base;
  if (speed < LOW_SPEED_THRESHOLD) f *= LOW_SPEED_MULT;
  else if (speed < MED_SPEED_THRESHOLD) f *= MED_SPEED_MULT;

  if (swept) f = Math.max(MIN_SWEPT_FRICTION, f * SWEEP_FRICTION_MULT);
  return f;
}

// ── Simulation ──────────────────────────────────────────────────

export class CurlingSimulation {
  private engine: Matter.Engine;
  private playerBody: Matter.Body;
  private opponentBodies: Matter.Body[];
  private sweeping = false;

  constructor(opponents: Array<{ x: number; y: number }>) {
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0 },
    });

    // Side walls only — top/bottom open for knockouts.
    const wallThickness = 20;
    const walls = [
      Matter.Bodies.rectangle(-wallThickness / 2, SHEET_HEIGHT / 2, wallThickness, SHEET_HEIGHT + 400, {
        isStatic: true, restitution: WALL_RESTITUTION,
      }),
      Matter.Bodies.rectangle(SHEET_WIDTH + wallThickness / 2, SHEET_HEIGHT / 2, wallThickness, SHEET_HEIGHT + 400, {
        isStatic: true, restitution: WALL_RESTITUTION,
      }),
    ];
    Matter.Composite.add(this.engine.world, walls);

    // Player stone
    this.playerBody = Matter.Bodies.circle(STONE_START_X, STONE_START_Y, STONE_RADIUS, {
      restitution: STONE_RESTITUTION,
      friction: STONE_FRICTION,
      frictionAir: BASE_ICE_FRICTION,
      density: STONE_DENSITY,
      label: 'player',
    });
    Matter.Composite.add(this.engine.world, this.playerBody);

    // Opponent stones
    this.opponentBodies = opponents.map((pos, i) =>
      Matter.Bodies.circle(pos.x, pos.y, OPPONENT_STONE_RADIUS, {
        restitution: STONE_RESTITUTION,
        friction: STONE_FRICTION,
        frictionAir: BASE_ICE_FRICTION,
        density: STONE_DENSITY,
        label: `opponent_${i}`,
      }),
    );
    Matter.Composite.add(this.engine.world, this.opponentBodies);
  }

  launch(vx: number, vy: number): void {
    Matter.Body.setVelocity(this.playerBody, { x: vx, y: vy });
  }

  setSweeping(on: boolean): void {
    this.sweeping = on;
  }

  /**
   * Advance one frame. Before stepping matter.js, update every body's
   * frictionAir based on its current speed (velocity-dependent friction).
   * Sweeping only affects the player stone.
   */
  step(delta = 1000 / 60): void {
    // Player: velocity-dependent + sweep
    const pSpeed = bodySpeed(this.playerBody);
    this.playerBody.frictionAir = velocityFriction(pSpeed, BASE_ICE_FRICTION, this.sweeping);

    // Opponents: velocity-dependent, no sweep
    for (const ob of this.opponentBodies) {
      const oSpeed = bodySpeed(ob);
      ob.frictionAir = velocityFriction(oSpeed, BASE_ICE_FRICTION, false);
    }

    Matter.Engine.update(this.engine, delta);
  }

  snapshot(): SimulationSnapshot {
    const bodyState = (b: Matter.Body): StoneState => ({
      x: b.position.x,
      y: b.position.y,
      vx: b.velocity.x,
      vy: b.velocity.y,
    });

    const player = bodyState(this.playerBody);
    const opponents = this.opponentBodies.map(bodyState);

    const speed = (s: StoneState) => Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    const isOff = (s: StoneState) =>
      s.y < -OFF_SHEET_MARGIN || s.y > SHEET_HEIGHT + OFF_SHEET_MARGIN ||
      s.x < -OFF_SHEET_MARGIN || s.x > SHEET_WIDTH + OFF_SHEET_MARGIN;

    const isStopped = (s: StoneState) => speed(s) < STOP_THRESHOLD || isOff(s);
    const allStopped = isStopped(player) && opponents.every(isStopped);

    return {
      player,
      opponents,
      allStopped,
      playerOffSheet: isOff(player),
      opponentsOffSheet: opponents.map(isOff),
    };
  }

  destroy(): void {
    Matter.Engine.clear(this.engine);
  }
}
