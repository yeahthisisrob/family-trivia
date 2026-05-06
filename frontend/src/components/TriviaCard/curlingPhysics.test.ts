import { describe, it, expect, afterEach } from 'vitest';

import {
  CurlingSimulation,
  SHEET_WIDTH,
  HOUSE_CENTER_Y,
  STONE_START_X,
  STONE_START_Y,
  STOP_THRESHOLD,
} from './curlingPhysics';

function runUntilStopped(sim: CurlingSimulation, maxFrames = 600): ReturnType<CurlingSimulation['snapshot']> {
  let snap = sim.snapshot();
  for (let i = 0; i < maxFrames && !snap.allStopped; i++) {
    sim.step();
    snap = sim.snapshot();
  }
  return snap;
}

describe('CurlingSimulation', () => {
  let sim: CurlingSimulation;

  afterEach(() => { sim?.destroy(); });

  it('launches the player stone and it decelerates to a stop', () => {
    sim = new CurlingSimulation([]);
    sim.launch(0, -6); // straight up

    const snap = runUntilStopped(sim);
    expect(snap.allStopped).toBe(true);
    // Stone should have moved up from start position
    expect(snap.player.y).toBeLessThan(STONE_START_Y - 50);
  });

  it('head-on collision: player stone transfers momentum to opponent', () => {
    // Place one opponent directly in the player's path, use moderate speed
    const opponentY = 200;
    sim = new CurlingSimulation([{ x: STONE_START_X, y: opponentY }]);
    sim.launch(0, -5);

    const snap = runUntilStopped(sim);
    expect(snap.allStopped).toBe(true);

    // The opponent should have moved from its original position
    // (it received real momentum, not the old 20% push)
    const oppDisplacement = Math.abs(snap.opponents[0].y - opponentY);
    expect(oppDisplacement).toBeGreaterThan(20);

    // The player should NOT have gone through the opponent to the top wall.
    // With proper collision, the player transfers momentum and slows.
    // Player should end up above start but below the opponent's final position
    // isn't meaningful (opponent bounces off walls), so just check player
    // didn't reach the very top of the sheet (which the old physics allowed).
    expect(snap.player.y).toBeGreaterThan(20);
  });

  it('angled collision: both stones deflect at angles', () => {
    // Place opponent slightly to the right — within collision range (sum of radii = 20)
    sim = new CurlingSimulation([{ x: STONE_START_X + 15, y: 200 }]);
    sim.launch(0, -5);

    const snap = runUntilStopped(sim);
    expect(snap.allStopped).toBe(true);

    // Opponent should have moved right (X increased) because hit from the left side
    expect(snap.opponents[0].x).toBeGreaterThan(STONE_START_X + 15);

    // Player should have deflected left (X decreased)
    expect(snap.player.x).toBeLessThan(STONE_START_X);
  });

  it('freeze: slow stone stops against a stationary stone', () => {
    // Place opponent just up the sheet from the player start
    const opponentY = STONE_START_Y - 100;
    sim = new CurlingSimulation([{ x: STONE_START_X, y: opponentY }]);
    sim.launch(0, -2); // gentle shot

    const snap = runUntilStopped(sim);
    expect(snap.allStopped).toBe(true);

    // Player should end up near the opponent (within a stone diameter)
    const gap = Math.abs(snap.player.y - snap.opponents[0].y);
    expect(gap).toBeLessThan(40);
  });

  it('chain reaction: stone A hits B which hits C', () => {
    // Line up three targets vertically, close enough that each
    // collision reaches the next stone (~25px apart, radii sum = 20).
    const y1 = 250;
    const y2 = 225;
    const y3 = 200;
    sim = new CurlingSimulation([
      { x: STONE_START_X, y: y1 },
      { x: STONE_START_X, y: y2 },
      { x: STONE_START_X, y: y3 },
    ]);
    sim.launch(0, -7); // hard shot

    const snap = runUntilStopped(sim);
    expect(snap.allStopped).toBe(true);

    // All three opponents should have moved from their starting positions
    expect(Math.abs(snap.opponents[0].y - y1)).toBeGreaterThan(5);
    expect(Math.abs(snap.opponents[1].y - y2)).toBeGreaterThan(5);
    expect(Math.abs(snap.opponents[2].y - y3)).toBeGreaterThan(5);
  });

  it('wall collision: stone bounces off side walls', () => {
    sim = new CurlingSimulation([]);
    sim.launch(5, -4); // strong rightward + upward

    const snap = runUntilStopped(sim);
    expect(snap.allStopped).toBe(true);

    // Stone should have bounced off the right wall and ended up within bounds
    expect(snap.player.x).toBeGreaterThan(0);
    expect(snap.player.x).toBeLessThan(SHEET_WIDTH);
  });

  it('sweeping reduces deceleration so stone travels further', () => {
    // Use a gentle shot that won't hit the top wall — the friction
    // difference between swept and unswept determines how far it goes.
    const sim1 = new CurlingSimulation([]);
    sim1.launch(0, -3);
    const noSweep = runUntilStopped(sim1, 800);
    sim1.destroy();

    const sim2 = new CurlingSimulation([]);
    sim2.setSweeping(true);
    sim2.launch(0, -3);
    const swept = runUntilStopped(sim2, 800);
    sim2.destroy();

    // Both should have stopped
    expect(noSweep.allStopped).toBe(true);
    expect(swept.allStopped).toBe(true);

    // Swept stone should travel further (lower Y = further up the sheet)
    expect(swept.player.y).toBeLessThan(noSweep.player.y);

    // Assign sim for afterEach cleanup safety
    sim = sim2;
  });
});
