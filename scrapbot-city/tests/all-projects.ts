// The item tests check each catalog item's own rules (prices, tiles, refunds, joins, rows, modules, saves) as a player
// who has discovered every project: their cities come from here. Nothing in the game is opened up: the discovery gate
// (pieceCheck and moduleCheck refuse an undiscovered project) has its own tests in projects.test.ts.
import { PROJECT_KINDS } from '../src/game/projects';
import { createGame as newCity, deserialize as loadCity } from '../src/game/state';
import type { GameState, NewGameOptions } from '../src/game/state';

export function discoverAll<S extends GameState>(s: S): S {
  for (const k of PROJECT_KINDS) s.unlocked.add(k);
  return s;
}

export const createGame = (opts?: NewGameOptions): GameState => discoverAll(newCity(opts));
export const deserialize = (json: string): GameState => discoverAll(loadCity(json));
