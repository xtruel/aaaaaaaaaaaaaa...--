// The autopilot used by the balance check and the waiting analysis: a sensible Green or Industrial player.
import { importParts, placeBuilding, placeCheck } from '../src/game/actions';
import type { BuildingType, PathKind } from '../src/game/defs';
import type { GameState } from '../src/game/state';
import { eventById } from '../src/game/story';

export type Plan = 'green' | 'industrial';

export function tryBuild(s: GameState, type: BuildingType): boolean {
  const hq = s.buildings.find((b) => b.type === 'hq')!;
  for (let r = 2; r < 22; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = hq.x + dx;
        const y = hq.y + dy;
        if (placeCheck(s, type, x, y).ok) return placeBuilding(s, type, x, y) !== null;
      }
    }
  }
  return false;
}

export function count(s: GameState, type: BuildingType): number {
  return s.buildings.filter((b) => b.type === type).length;
}

export function think(s: GameState, plan: Plan): void {
  const d = s.derived;
  const g = plan === 'green';
  const power: BuildingType = g ? 'solar' : 'burner';
  const has = (t: BuildingType) => count(s, t) > 0;
  if (!g) {
    const want = s.pop >= 30 ? 400 : 40;
    while (s.res.parts < want && s.res.credits > 800) importParts(s);
  }
  if (s.pop >= 30 && !has('spire')) {
    // saving up for the Spire: only fight the smog meanwhile
    if (tryBuild(s, 'spire')) return;
    if (s.pollution > 60) for (const b of s.buildings) if (b.type === 'burner' || b.type === 'smelter') b.paused = true;
    if (s.pollution < 40) for (const b of s.buildings) if (b.type === 'burner' || b.type === 'smelter') b.paused = false;
    if (s.pollution > 50 && count(s, 'purifier') < 3) tryBuild(s, 'purifier');
    return;
  }
  const proc: BuildingType = g ? 'fixlab' : 'smelter';
  if (!has('recycler')) tryBuild(s, 'recycler');
  if (d.energyUse + 2 > d.energyProd && (g || s.res.scrap > 20 || count(s, 'burner') < 2)) tryBuild(s, power);
  if (s.res.scrap > d.storage * 0.7) tryBuild(s, count(s, 'recycler') <= count(s, proc) ? 'recycler' : proc);
  if (s.pop >= d.housing - 2) tryBuild(s, 'pods');
  if (count(s, 'dock') < (g ? 1 + Math.floor(s.pop / 10) : 2 + Math.floor(s.pop / 6))) tryBuild(s, 'dock');
  if (g) {
    if (s.pollution > 25 || s.tiles.includes(2)) {
      if (count(s, 'purifier') < 2) tryBuild(s, 'purifier');
    }
    if (count(s, 'garden') < 3 + s.pop / 6) tryBuild(s, 'garden');
    if (s.res.parts > 70 && count(s, 'fixlab') < 2) tryBuild(s, 'fixlab');
  } else {
    if (s.res.parts > 50 && count(s, 'factory') < 3) tryBuild(s, 'factory');
    if (s.res.scrap > 60 && count(s, 'smelter') < 3) tryBuild(s, 'smelter');
    if (d.efficiency < 1 && s.res.credits > 1000) tryBuild(s, 'solar');
    if (s.pollution > 55 && count(s, 'purifier') < 2) tryBuild(s, 'purifier');
    if (d.happiness < 45 && count(s, 'garden') < 10) tryBuild(s, 'garden');
  }
}

// Answers a pending story event the way the plan would.
export function answerEvent(s: GameState, plan: Plan): void {
  if (!s.pendingEvent) return;
  const ev = eventById(s.pendingEvent)!;
  const want: PathKind = plan;
  const options = ev.choices.filter((c) => !c.available || c.available(s));
  const pick = options.find((c) => c.path === want) ?? options.find((c) => c.path === 'neutral') ?? options[0] ?? ev.choices[0];
  pick.apply(s);
  s.pendingEvent = null;
}
