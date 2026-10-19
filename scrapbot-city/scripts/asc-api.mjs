// App Store Connect API client for the asc-*.mjs scripts (docs/APPSTORE-AUTOMATION.md). The key comes from the
// environment, never from the repository: ASC_KEY_ID, ASC_ISSUER_ID and the .p8 file as ASC_PRIVATE_KEY (its text),
// ASC_PRIVATE_KEY_B64 or ASC_PRIVATE_KEY_PATH. Never prints the key or the token.
import { readFileSync } from 'fs';
import { sign } from 'crypto';

const env = process.env;
const pem = env.ASC_PRIVATE_KEY?.replace(/\\n/g, '\n')
  ?? (env.ASC_PRIVATE_KEY_B64 && Buffer.from(env.ASC_PRIVATE_KEY_B64, 'base64').toString('utf8'))
  ?? (env.ASC_PRIVATE_KEY_PATH && readFileSync(env.ASC_PRIVATE_KEY_PATH, 'utf8'));
if (!env.ASC_KEY_ID || !env.ASC_ISSUER_ID || !pem) {
  console.error('App Store Connect key missing: set ASC_KEY_ID, ASC_ISSUER_ID and ASC_PRIVATE_KEY (or _B64, or _PATH)');
  process.exit(2);
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

let token = '';
let tokenExp = 0;
function bearer() {
  const now = Math.floor(Date.now() / 1000);
  if (now < tokenExp - 60) return token;
  const header = b64({ alg: 'ES256', kid: env.ASC_KEY_ID, typ: 'JWT' });
  const data = `${header}.${b64({ iss: env.ASC_ISSUER_ID, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' })}`;
  token = `${data}.${sign('sha256', Buffer.from(data), { key: pem, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  tokenExp = now + 1100;
  return token;
}

export class ApiError extends Error {
  constructor(method, path, status, body) {
    const errs = (body?.errors ?? []).map((e) => `${e.code}: ${e.detail ?? e.title}`).join(' | ');
    super(`${method} ${path} → ${status} ${errs}`);
    this.status = status;
    this.body = body;
  }
}

// One request; retried on 429 and 5xx. Throws ApiError on any other error status.
export async function api(method, path, body) {
  const url = path.startsWith('https://') ? path : `https://api.appstoreconnect.apple.com${path}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${bearer()}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    if (res.status >= 400) throw new ApiError(method, path, res.status, json);
    return json;
  }
}

// Every page of a list.
export async function all(path) {
  const out = [];
  for (let next = path; next; ) {
    const page = await api('GET', next);
    out.push(...page.data);
    next = page.links?.next;
  }
  return out;
}

export const BUNDLE_ID = 'com.qwerty3d.scrapbotcity';

export async function appByBundleId(bundleId = BUNDLE_ID) {
  const res = await api('GET', `/v1/apps?filter%5BbundleId%5D=${encodeURIComponent(bundleId)}`);
  return res.data.find((a) => a.attributes.bundleId === bundleId) ?? null;
}
