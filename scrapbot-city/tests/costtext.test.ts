// Prices and refunds in words: one of a resource reads in the singular ("+1 credit", "1 part", Polish "1 część");
// every amount above one reads exactly as before, in all 8 languages.
import { afterEach, describe, expect, it } from 'vitest';
import { costText } from '../src/game/actions';
import { LANGS, setLang, t } from '../src/i18n';

afterEach(() => setLang('en'));

// What the floor and lamp refunds (1 credit; 5 credits + 1 part) and a few plurals read like in each language.
const EXPECTED: Record<string, { one: [string, string, string]; refund: string; plural: string }> = {
  en: { one: ['1 scrap', '1 part', '1 credit'], refund: '5 credits + 1 part', plural: '37 credits + 10 parts' },
  it: { one: ['1 rottame', '1 pezzo', '1 credito'], refund: '5 crediti + 1 pezzo', plural: '37 crediti + 10 pezzi' },
  de: { one: ['1 Schrott', '1 Teil', '1 Credit'], refund: '5 Credits + 1 Teil', plural: '37 Credits + 10 Teile' },
  fr: { one: ['1 ferraille', '1 pièce', '1 crédit'], refund: '5 crédits + 1 pièce', plural: '37 crédits + 10 pièces' },
  es: { one: ['1 de chatarra', '1 pieza', '1 crédito'], refund: '5 créditos + 1 pieza', plural: '37 créditos + 10 piezas' },
  pt: { one: ['1 de sucata', '1 peça', '1 crédito'], refund: '5 créditos + 1 peça', plural: '37 créditos + 10 peças' },
  pl: { one: ['1 złomu', '1 część', '1 kr'], refund: '5 kr + 1 część', plural: '37 kr + 10 części' },
  nl: { one: ['1 schroot', '1 onderdeel', '1 credit'], refund: '5 credits + 1 onderdeel', plural: '37 credits + 10 onderdelen' },
};

describe('costText', () => {
  it('says one of a resource in the singular, in every language', () => {
    for (const { id } of LANGS) {
      setLang(id);
      const e = EXPECTED[id];
      expect([costText({ scrap: 1 }), costText({ parts: 1 }), costText({ credits: 1 })], id).toEqual(e.one);
      expect(costText({ credits: 5, parts: 1 }), id).toBe(e.refund);
      expect(costText({ credits: 37, parts: 10 }), id).toBe(e.plural);
    }
  });

  it('keeps every amount above one exactly as it was (the plural key)', () => {
    for (const { id } of LANGS) {
      setLang(id);
      for (let n = 2; n <= 250; n++) {
        expect(costText({ scrap: n }), id).toBe(t('cost.scrap', { n }));
        expect(costText({ parts: n }), id).toBe(t('cost.parts', { n }));
        expect(costText({ credits: n }), id).toBe(t('cost.credits', { n }));
      }
    }
  });

  it('Polish parts: 1 część, 2-4 części, 5+ części', () => {
    setLang('pl');
    expect([1, 2, 3, 4, 5, 12, 21, 22, 25].map((n) => costText({ parts: n }))).toEqual([
      '1 część',
      '2 części',
      '3 części',
      '4 części',
      '5 części',
      '12 części',
      '21 części',
      '22 części',
      '25 części',
    ]);
  });

  it('nothing to pay is "free"', () => {
    expect(costText({})).toBe('free');
    expect(costText({ credits: 0 })).toBe('free');
  });
});
