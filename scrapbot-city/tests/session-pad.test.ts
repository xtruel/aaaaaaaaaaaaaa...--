// @vitest-environment jsdom
// The controller's Y in a city (src/session.ts padFrame): it turns the piece in hand, or the selected piece as R does,
// or says that piece does not turn; it asks USA-9 for a hint (a free hint used up, or the paid offer) only with nothing
// in hand and no piece selected.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS, clock, handlers, page } from './session-harness';
import { MAP_H, MAP_W } from '../src/game/defs';
import { pieceAt, pieceCheck, placePiece } from '../src/game/pieces';
import type { PieceKind } from '../src/game/pieces';
import { idx } from '../src/game/state';
import type { GameState } from '../src/game/state';
import type { PadButton } from '../src/gamepad';
import { GameSession } from '../src/session';
import { closeModal, isModalOpen } from '../src/ui/modal';
import { createGame } from './all-projects';

beforeEach(() => {
  closeModal();
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

function put(s: GameState, kind: PieceKind): { x: number; y: number } {
  for (let y = 2; y < MAP_H - 2; y++)
    for (let x = 2; x < MAP_W - 2; x++) if (pieceCheck(s, kind, x, y, 0).ok && placePiece(s, kind, x, y, 0)) return { x, y };
  throw new Error(`no room for ${kind}`);
}

const press = (b: PadButton) => ({ dt: 1 / 60, lx: 0, ly: 0, rx: 0, ry: 0, pressed: new Set<PadButton>([b]), held: new Set<PadButton>([b]) });

describe('the pad\'s Y', () => {
  it('turns the selected bench as R does, says a selected planter does not turn, and asks for a hint only with nothing selected', () => {
    clock();
    const s = createGame({ seed: 61, cityName: 'Benches' });
    s.res.credits = 300;
    const bench = put(s, 'bench');
    const planter = put(s, 'planter');
    const session = new GameSession(page(), s, SETTINGS, handlers());
    const inner = session as unknown as { alive: boolean; selectedPiece: number };
    inner.alive = true;
    document.body.classList.add('pad-mode');
    document.elementFromPoint = () => null;
    const free = s.hints.free;

    inner.selectedPiece = idx(bench.x, bench.y);
    session.padFrame(press('y'));
    expect(pieceAt(s, bench.x, bench.y)?.rot).toBe(1);
    expect(isModalOpen()).toBe(false);
    expect(s.hints.free).toBe(free);

    inner.selectedPiece = idx(planter.x, planter.y);
    session.padFrame(press('y'));
    expect(isModalOpen()).toBe(false);
    expect(s.hints.free).toBe(free);
    expect(s.messages.map((m) => m.text)).toContain('Planter: does not turn');

    // nothing in hand, nothing selected: USA-9's hint
    inner.selectedPiece = -1;
    session.padFrame(press('y'));
    expect(isModalOpen()).toBe(true);
    expect(s.hints.free).toBe(free - 1);
    session.dispose();
  });
});
