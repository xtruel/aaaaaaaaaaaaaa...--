// The smog panel (a click or tap on the smog meter): where the smog comes from and where it goes. The numbers are
// the sim's own breakdown (derived.air, which updatePollution adds up into derived.pollutionRate), shown per day
// as the building panel shows a building's smog (a day is 60 seconds). No DOM, so it can be tested on its own.
import { BUILD_ORDER, DAY_LENGTH, SMOG_DANGER, SMOG_LIMIT_SECONDS } from '../game/defs';
import type { BuildingType } from '../game/defs';
import type { GameState } from '../game/state';
import { bName, t } from '../i18n';

export interface AirRow {
  kind: BuildingType | 'sludge' | 'renewal';
  label: string; // "Smelter ×3", "Toxic sludge (12 tiles)", "Natural air renewal"
  perDay: number; // smog points a day: + into the air, - out of it
}

export interface AirReport {
  sources: AirRow[]; // into the air, the biggest first
  cleaning: AirRow[]; // out of the air, the biggest first
  net: number; // per day, the sim's own total (derived.pollutionRate)
  notes: string[]; // what changes the numbers right now: overtime, a power shortage
  limit: string; // the 95% rule, or the countdown while it runs
  danger: boolean; // the countdown is running
}

export function airReport(s: GameState): AirReport {
  const air = s.derived.air;
  const sources: AirRow[] = [];
  const cleaning: AirRow[] = [];
  for (const type of BUILD_ORDER) {
    const v = air.byType[type];
    if (!v) continue;
    const row: AirRow = { kind: type, label: `${bName(type)} ×${air.count[type]}`, perDay: v * DAY_LENGTH };
    (v > 0 ? sources : cleaning).push(row);
  }
  if (air.sludge > 0) sources.push({ kind: 'sludge', label: t(air.sludgeTiles === 1 ? 'smog.sludge.one' : 'smog.sludge', { n: air.sludgeTiles }), perDay: air.sludge * DAY_LENGTH });
  if (air.renewal < 0) cleaning.push({ kind: 'renewal', label: t('smog.renewal'), perDay: air.renewal * DAY_LENGTH });
  const bigFirst = (a: AirRow, b: AirRow) => Math.abs(b.perDay) - Math.abs(a.perDay);
  sources.sort(bigFirst);
  cleaning.sort(bigFirst);
  const notes: string[] = [];
  if (s.time < s.overtimeUntil) notes.push(t('smog.overtime', { n: Math.ceil(s.overtimeUntil - s.time) }));
  if (s.derived.efficiency < 1) notes.push(t('smog.power', { n: Math.round(s.derived.efficiency * 100) }));
  const danger = s.smog > 0;
  const limit = danger
    ? t('smog.countdown', { limit: SMOG_DANGER, n: Math.max(0, Math.ceil(SMOG_LIMIT_SECONDS - s.smog)) })
    : t('smog.limit', { limit: SMOG_DANGER, seconds: SMOG_LIMIT_SECONDS });
  return { sources, cleaning, net: s.derived.pollutionRate * DAY_LENGTH, notes, limit, danger };
}

// "+2.1", "-0.6": as the building panel writes smog per day.
export function perDayText(v: number): string {
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? '+' : ''}${(r === 0 ? 0 : r).toFixed(1)}`;
}
