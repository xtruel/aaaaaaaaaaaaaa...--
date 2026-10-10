// Shared by the desktop storage (main.cjs) and the tests: which stored text can be trusted.
// Saves, slot info, the campaign and settings are JSON: a file of those that does not parse is damaged.
function usable(key, text) {
  if (text === null || text === undefined || text === '') return false;
  if (!/^(save|meta|campaign|settings|endings|achievements)/.test(String(key))) return true;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

module.exports = { usable };
