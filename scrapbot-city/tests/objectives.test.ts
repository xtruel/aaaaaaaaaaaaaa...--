import { describe, expect, it } from 'vitest';
import { computeDerived } from '../src/game/sim';
import { addBuilding, createGame } from '../src/game/state';
import type { GameState } from '../src/game/state';
import { OBJECTIVES, objectiveTools } from '../src/game/story';

const goal = (s: GameState, id: string) => {
  s.objective = OBJECTIVES.findIndex((o) => o.id === id);
};

// A finished building next to the HQ, so derived numbers (housing) count it.
function built(s: GameState, type: Parameters<typeof addBuilding>[1]): void {
  const hq = s.buildings[0];
  const b = addBuilding(s, type, hq.x + 4 + s.buildings.length * 2, hq.y);
  b.built = 1;
  computeDerived(s);
}

describe('goal card build highlight', () => {
  it('points at the building each early goal asks for', () => {
    const s = createGame({ seed: 7 });
    goal(s, 'collect');
    expect(objectiveTools(s)).toEqual([]);
    goal(s, 'recycler');
    expect(objectiveTools(s)).toEqual(['recycler']);
    goal(s, 'power');
    expect(objectiveTools(s)).toEqual(['solar', 'burner']);
    goal(s, 'spireStart');
    expect(objectiveTools(s)).toEqual(['spire']);
    goal(s, 'spireDone');
    expect(objectiveTools(s)).toEqual([]);
  });

  it('asks for more Bot Pods only while every home is taken', () => {
    const s = createGame({ seed: 7 });
    built(s, 'pods');
    goal(s, 'pop10');
    s.pop = 3;
    expect(objectiveTools(s)).toEqual([]);
    s.pop = s.derived.housing;
    expect(objectiveTools(s)).toEqual(['pods']);
    goal(s, 'pop30');
    expect(objectiveTools(s)).toEqual(['pods']);
  });

  it('follows a clear path for the money goal', () => {
    const s = createGame({ seed: 7 });
    goal(s, 'money');
    expect(objectiveTools(s)).toEqual(['fixlab', 'smelter', 'factory']);
    s.alignment = 30;
    expect(objectiveTools(s)).toEqual(['fixlab']);
    s.alignment = -30;
    expect(objectiveTools(s)).toEqual(['smelter', 'factory']);
  });

  it('goes quiet while the asked-for building is going up', () => {
    const s = createGame({ seed: 7 });
    goal(s, 'recycler');
    const hq = s.buildings[0];
    addBuilding(s, 'recycler', hq.x + 4, hq.y);
    expect(objectiveTools(s)).toEqual([]);
  });
});
