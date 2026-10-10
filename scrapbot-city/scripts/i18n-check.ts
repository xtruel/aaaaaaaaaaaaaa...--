// Checks every language against English: same keys, same {placeholders}, same HTML tags, same list lengths.
// Run with: npm run i18n:check
import { en } from '../src/i18n/en';
import { de } from '../src/i18n/de';
import { es } from '../src/i18n/es';
import { fr } from '../src/i18n/fr';
import { it } from '../src/i18n/it';
import { nl } from '../src/i18n/nl';
import { pl } from '../src/i18n/pl';
import { pt } from '../src/i18n/pt';

const langs: Record<string, Record<string, string>> = { it, de, fr, es, pt, pl, nl };
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
const tags = (s: string) => (s.match(/<\/?[a-z]+[^>]*>/g) ?? []).map((t) => t.replace(/\s.*>/, '>')).sort().join(',');
const LIST_KEYS = ['menu.pillars', 'menu.ticker'];
const isList = (k: string) => LIST_KEYS.includes(k) || k.endsWith('.traits');

let problems = 0;
for (const [code, dict] of Object.entries(langs)) {
  const report = (msg: string) => {
    problems++;
    console.log(`[${code}] ${msg}`);
  };
  let same = 0;
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    const src = en[key];
    const tr = dict[key];
    if (tr === undefined) {
      report(`missing ${key}`);
      continue;
    }
    if (tr === src && /[a-z]{4}/.test(src) && !key.startsWith('speaker.')) same++;
    if (placeholders(src) !== placeholders(tr)) report(`placeholders differ in ${key}: "${tr}"`);
    if (tags(src) !== tags(tr)) report(`HTML tags differ in ${key}: "${tr}"`);
    if (isList(key) && src.split('|').length !== tr.split('|').length) report(`list length differs in ${key}`);
  }
  for (const key of Object.keys(dict)) if (!(key in en)) report(`unknown key ${key}`);
  console.log(`[${code}] ${Object.keys(dict).length} keys, ${same} still identical to English`);
}
console.log(problems ? `${problems} problem(s) found` : 'All languages match the English source.');
if (problems) throw new Error('Translations do not match the English source (see above).');
