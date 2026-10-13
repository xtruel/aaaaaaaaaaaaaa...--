// @vitest-environment jsdom
// Every text that tells the player how to do something names the controls of the input in use (G5): keyboard and
// mouse, touch, or the controller (src/input.ts). The table below is the list of those texts; any English text that
// names a control (click, mouse, wheel, a key, a finger, a stick...) must be in it, on the controls reference page,
// or one of the few texts that fit every input. In all 8 languages, a touch wording names no mouse or key, a
// controller wording names no mouse, key or finger, and a mouse wording names no finger.
import { afterEach, describe, expect, it } from 'vitest';
import { setPadMode, padMode } from '../src/gamepad';
import { de } from '../src/i18n/de';
import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { fr } from '../src/i18n/fr';
import { it as itDict } from '../src/i18n/it';
import { nl } from '../src/i18n/nl';
import { pl } from '../src/i18n/pl';
import { pt } from '../src/i18n/pt';
import { setLang } from '../src/i18n';
import { initInputMode, inputKey, inputKind, inputText, setTouchMode, touchMode } from '../src/input';

// keyboard-and-mouse wording -> [touch wording, controller wording]
const HELP: Record<string, [string, string]> = {
  'tut.hi.action': ['tut.hi.actionTouch', 'tut.hi.actionPad'],
  'tut.recycler.action': ['tut.recycler.actionTouch', 'tut.recycler.actionPad'],
  'tut.citizens.action': ['tut.citizens.actionTouch', 'tut.citizens.actionPad'],
  'tut.power.action': ['tut.power.actionTouch', 'tut.power.actionPad'],
  'tut.speed.action': ['tut.speed.actionTouch', 'tut.speed.actionPad'],
  'tut.ready.text': ['tut.ready.textTouch', 'tut.ready.textPad'],
  'msg.tutorialSkipped': ['msg.tutorialSkippedTouch', 'msg.tutorialSkippedPad'],
  'msg.rubbleInfo': ['msg.rubbleInfoTouch', 'msg.rubbleInfoPad'],
  'intro.p3': ['intro.p3Touch', 'intro.p3Pad'],
  'pause.tip': ['pause.tipTouch', 'pause.tipPad'],
  'cat.help.rotate': ['cat.help.rotateTouch', 'cat.help.rotatePad'],
  'move.help': ['move.helpTouch', 'move.helpPad'],
  // the catalog's tool help (src/ui/hud.ts toolHelp): a finger lays one tile at a time (no row), the pad says A and B
  'cat.help.place': ['cat.help.placeTouch', 'cat.help.pad'],
  'cat.help.row': ['cat.help.placeTouch', 'cat.help.pad'],
  'cat.help.module': ['cat.help.moduleTouch', 'cat.help.modulePad'],
};
// the controls reference page (Extras): every input's lines, those of the input in use first
const REFERENCE = ['extras.controls.1', 'extras.controls.2', 'extras.controls.3', 'extras.controls.4', 'extras.controls.5', 'extras.controls.pad', 'extras.controls.pad2', 'extras.controls.pad3', 'extras.controls.touch'];
// fit every input: "press" a button or again; the smog meter's hover title (only a mouse shows a title); the toast
// shown when a controller connects; a browser tab
const ANY_INPUT = ['place.double', 'hint.smogEmergency.text', 'hud.smog.more', 'pad.help', 'quit.closeTab'];
const NAMES_A_CONTROL = (v: string) => /click|mouse|wheel|\bdrag|<kbd>|WASD|\btap\b|finger|pinch|stick|\bpress\b|\bhold\b|right button|left button/i.test(v) || /\([A-Z0-9]\)|\bTab\b/.test(v);

const DICTS: Record<string, Record<string, string>> = { en, it: itDict, de, fr, es, pt, pl, nl };
// words for the mouse and keys, and for a finger, in each language
const MOUSE: Record<string, RegExp> = {
  en: /click|mouse|wheel|\bkey\b/i,
  it: /clic|mouse|rotellina|tasto/i,
  de: /klick|maus|taste/i,
  fr: /cliqu|souris|molette/i,
  es: /\bclic|ratón|rueda/i,
  pt: /\bclica|\brato\b|roda do/i,
  pl: /klikn|mysz|kółk|klawisz/i,
  nl: /\bklik|muis/i,
};
const FINGER: Record<string, RegExp> = {
  en: /\btap|finger/i,
  it: /\btocca|toccal|\bdito/i,
  de: /tippe|tippen|antippen|finger/i,
  fr: /\btouche (?!\d)|touche-|doigt/i, // ("touche 3" is the key 3)
  es: /\btoca|tócal|\bdedo/i,
  pt: /\btoca\b|\bdedo/i,
  pl: /dotknij|dotyk|palc/i,
  nl: /\btik\b|vinger/i,
};
const KEYS = /<kbd>(?!A<|B<|X<|Y<|L3<|R3<|LB<|RB<|LT<|RT<|D-pad<|View<|Start<)|\((Q|H|Tab|[0-9])\)|WASD|\bTab\b/;

afterEach(() => {
  document.body.className = '';
  setLang('en');
});

describe('help texts for the input in use: the list', () => {
  it('every English text naming a control is a help text with its three wordings, a reference line or fits every input', () => {
    const listed = new Set([...Object.keys(HELP), ...Object.values(HELP).flat(), ...REFERENCE, ...ANY_INPUT]);
    const unlisted = Object.entries(en)
      .filter(([k, v]) => NAMES_A_CONTROL(v) && !listed.has(k))
      .map(([k]) => k);
    expect(unlisted).toEqual([]);
  });

  it('every help text has its touch and controller wordings in every language', () => {
    for (const [code, d] of Object.entries(DICTS))
      for (const [mouse, [touch, pad]] of Object.entries(HELP)) {
        expect(d[mouse], `${code} ${mouse}`).toBeTruthy();
        expect(d[touch], `${code} ${touch}`).toBeTruthy();
        expect(d[pad], `${code} ${pad}`).toBeTruthy();
      }
  });

  it('a touch wording names no mouse or key; a controller wording no mouse, key or finger; a mouse wording no finger', () => {
    const bad: string[] = [];
    for (const [code, d] of Object.entries(DICTS))
      for (const [mouse, [touch, pad]] of Object.entries(HELP)) {
        if (MOUSE[code].test(d[touch]) || KEYS.test(d[touch]) || /<kbd>/.test(d[touch])) bad.push(`${code} ${touch}: ${d[touch]}`);
        if (MOUSE[code].test(d[pad]) || FINGER[code].test(d[pad]) || KEYS.test(d[pad])) bad.push(`${code} ${pad}: ${d[pad]}`);
        if (FINGER[code].test(d[mouse])) bad.push(`${code} ${mouse}: ${d[mouse]}`);
      }
    for (const code of Object.keys(DICTS)) {
      const touchLine = DICTS[code]['extras.controls.touch'];
      if (MOUSE[code].test(touchLine) || /<kbd>/.test(touchLine)) bad.push(`${code} extras.controls.touch: ${touchLine}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('help texts for the input in use: the switch', () => {
  it('keyboard and mouse unless a controller or a finger is in use', () => {
    expect(inputKind()).toBe('mouse');
    setPadMode(true);
    expect(inputKind()).toBe('pad');
    setTouchMode(true);
    expect(inputKind()).toBe('touch');
    expect(padMode()).toBe(false);
    setPadMode(true);
    expect(touchMode()).toBe(false);
    expect(inputKind()).toBe('pad');
    setPadMode(false);
    expect(inputKind()).toBe('mouse');
  });

  it('picks the wording of the input in use; the keyboard one when a text fits every input', () => {
    expect(inputKey('move.help', 'mouse')).toBe('move.help');
    expect(inputKey('move.help', 'touch')).toBe('move.helpTouch');
    expect(inputKey('move.help', 'pad')).toBe('move.helpPad');
    expect(inputKey('tut.hi.title', 'touch')).toBe('tut.hi.title');
    expect(inputText('tut.speed.action', undefined, 'mouse')).toBe('Switch to a faster speed (or press Tab).');
    expect(inputText('tut.speed.action', undefined, 'touch')).toBe('Tap a faster speed.');
    expect(inputText('tut.speed.action', undefined, 'pad')).toBe('Switch to a faster speed (or press <kbd>L3</kbd>).');
    expect(inputText('cat.help.rotate', { rotate: 'Rotate' }, 'touch')).toBe('<b>⟳ Rotate</b> turns it.');
    setLang('it');
    expect(inputText('cat.help.place', undefined, 'touch')).toBe('Tocca una casella per posarlo.');
    expect(inputText('cat.help.place', undefined, 'mouse')).toBe('Clicca una casella per posarlo.');
  });

  it('a finger, the mouse and a key switch it, and help texts on screen follow', async () => {
    initInputMode();
    document.body.innerHTML = '<p data-input-help="pause.tip"></p>';
    const p = document.querySelector<HTMLElement>('[data-input-help]')!;
    const pointer = (type: string, pointerType: string, move = 0) => {
      const e = new MouseEvent(type, { bubbles: true, clientX: 10, clientY: 10 });
      Object.defineProperty(e, 'pointerType', { value: pointerType });
      Object.defineProperty(e, 'movementX', { value: move });
      window.dispatchEvent(e);
    };
    const settle = () => new Promise((r) => setTimeout(r, 0));
    pointer('pointerdown', 'touch');
    await settle();
    expect(inputKind()).toBe('touch');
    expect(p.innerHTML).toBe(en['pause.tipTouch']);
    pointer('pointermove', 'mouse', 0); // a mouse that did not move does not count
    expect(inputKind()).toBe('touch');
    pointer('pointermove', 'mouse', 3);
    await settle();
    expect(inputKind()).toBe('mouse');
    expect(p.innerHTML).toBe(en['pause.tip']);
    pointer('pointerdown', 'touch');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', code: 'KeyQ' }));
    expect(inputKind()).toBe('mouse');
    setPadMode(true);
    await settle();
    expect(p.innerHTML).toBe(en['pause.tipPad']);
  });
});
