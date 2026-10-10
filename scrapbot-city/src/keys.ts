// Key names in help texts follow the player's keyboard. The game reads physical keys (KeyboardEvent.code),
// so the key written "W" for a US keyboard is "Z" on a French AZERTY one, and help texts should say so.

let layout: Map<string, string> | null = null;

interface KeyboardApi {
  getLayoutMap(): Promise<Map<string, string>>;
}

// Chromium (and so the desktop build) can tell what is printed on each key; elsewhere the US names stay.
export async function loadKeyboardLayout(): Promise<void> {
  try {
    const kb = (navigator as unknown as { keyboard?: KeyboardApi }).keyboard;
    if (kb?.getLayoutMap) layout = await kb.getLayoutMap();
  } catch {
    layout = null;
  }
}

// What is printed on a physical key: keyLabel('KeyQ', 'Q') is "A" on AZERTY.
export function keyLabel(code: string, fallback: string): string {
  const label = layout?.get(code);
  return label ? label.toUpperCase() : fallback;
}

const letters = (s: string) => [...s].map((c) => keyLabel(`Key${c}`, c)).join('');

// Rewrites US key names in a (translated) keyboard help text: <kbd>Q</kbd>, WASD, (Q).
// Controller texts must not go through here: their A, B, X, Y are buttons, not keys.
export function localizeKeys(text: string): string {
  if (!layout) return text;
  return text
    .replace(/<kbd>([A-Z]{1,4})<\/kbd>/g, (_, l: string) => `<kbd>${letters(l)}</kbd>`)
    .replace(/\bWASD\b/g, () => letters('WASD'))
    .replace(/\(([A-Z])\)/g, (_, l: string) => `(${letters(l)})`);
}
