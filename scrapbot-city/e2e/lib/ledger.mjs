// The resource ledger: every step of a flow says what it expects the city's credits, parts and scrap to do (and how
// many catalog objects get placed and modules installed); the ledger reads the city after the step and checks it.
// Staged changes (the hook giving money, a load) are written in as such. At the end the sum of every step must equal
// the end minus the start: nothing paid or given that no step accounts for.
// For catalog objects with no effect on the economy, it also checks that nothing else in the city moved (derived
// numbers, happiness, smog, alignment, stars, every other statistic) while the clock is paused.
import { read } from './game.mjs';
import { settle } from './page.mjs';
import { costStr, sameCost, ZERO } from './spec.mjs';

const delta = (a, b) => ({ credits: +(b.credits - a.credits).toFixed(4), parts: +(b.parts - a.parts).toFixed(4), scrap: +(b.scrap - a.scrap).toFixed(4) });

export class Ledger {
  constructor(T, page, { watchWorld = true } = {}) {
    this.T = T;
    this.page = page;
    this.rows = [];
    this.sum = { ...ZERO };
    this.first = null;
    this.last = null;
    this.watchWorld = watchWorld;
    this.worldOk = true;
    this.worldWhy = '';
    this.base = null;
  }

  // the starting point (after the scene was staged)
  async start(label) {
    // (the city's derived numbers are worked out again on the next frames after staging)
    await settle(this.page);
    const r = await read(this.page);
    this.first = r;
    this.last = r;
    this.base = r;
    this.rows.push({ step: label, credits: r.credits, parts: r.parts, scrap: r.scrap, placed: r.placed, mods: r.mods, kind: 'start' });
    return r;
  }

  // a step whose cost is known: expect = resource change (null: not checked, only recorded); placed / mods: counters
  async step(label, expect = ZERO, { placed = 0, mods = 0, world = true } = {}) {
    const r = await read(this.page);
    const d = delta(this.last, r);
    const dp = r.placed - this.last.placed;
    const dm = r.mods - this.last.mods;
    if (expect) {
      const good = sameCost(d, expect) && dp === placed && dm === mods;
      this.T.ok(`${label}: resources ${sameCost(expect, ZERO) ? 'unchanged' : `change by ${costStr(expect)}`}${placed ? `, ${placed} placed` : ''}${mods ? `, ${mods} installed` : ''}`, good, JSON.stringify({ d, placed: dp, mods: dm }));
      for (const k of ['credits', 'parts', 'scrap']) this.sum[k] += expect[k] ?? 0;
    } else for (const k of ['credits', 'parts', 'scrap']) this.sum[k] += d[k];
    if (this.watchWorld && world) {
      const same = r.derived === this.base.derived && r.world === this.base.world && r.otherStats === this.base.otherStats;
      if (!same && this.worldOk) {
        this.worldOk = false;
        this.worldWhy = `${label}: ${r.derived === this.base.derived ? '' : 'derived '}${r.world === this.base.world ? '' : 'world '}${r.otherStats === this.base.otherStats ? '' : 'other statistics'}`;
      }
    }
    this.rows.push({ step: label, credits: r.credits, parts: r.parts, scrap: r.scrap, placed: r.placed, mods: r.mods, d, expect: expect ?? 'recorded' });
    this.last = r;
    // a step that may change the economy (a module): the city after it is the new base
    if (!world) this.base = r;
    return r;
  }

  // the hook changed the city (money, a building, a load): recorded as staged, and the new state is the base for the
  // "nothing else moved" check
  async staged(label) {
    await settle(this.page);
    const r = await read(this.page);
    const d = delta(this.last, r);
    for (const k of ['credits', 'parts', 'scrap']) this.sum[k] += d[k];
    this.rows.push({ step: label, credits: r.credits, parts: r.parts, scrap: r.scrap, placed: r.placed, mods: r.mods, d, expect: 'staged' });
    this.last = r;
    this.base = r;
    return r;
  }

  // the end: the sum of the steps is the end minus the start; nothing else moved
  async close(label = 'end') {
    const r = await this.step(label, ZERO, { world: true });
    const total = delta(this.first, r);
    this.T.ok('the ledger closes: the sum of every step (purchases, refunds, staging) equals the end minus the start', ['credits', 'parts', 'scrap'].every((k) => Math.abs(total[k] - this.sum[k]) < 1e-3), JSON.stringify({ total, sum: this.sum }));
    if (this.watchWorld) this.T.ok('catalog objects had no effect: derived numbers, happiness, smog, alignment, stars and the other statistics unchanged at every step', this.worldOk, this.worldWhy);
    return r;
  }
}
