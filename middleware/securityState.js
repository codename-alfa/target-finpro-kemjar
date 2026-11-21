const VALID_MODES = new Set(['VULNERABLE', 'SECURE']);

function normalizeMode(rawMode) {
  if (typeof rawMode !== 'string') return 'VULNERABLE';
  const upper = rawMode.trim().toUpperCase();
  return VALID_MODES.has(upper) ? upper : 'VULNERABLE';
}

let currentMode = normalizeMode(process.env.SEC_MODE || 'VULNERABLE');

/**
 * Returns the active runtime security mode ('VULNERABLE' or 'SECURE').
 */
function getMode() {
  return currentMode;
}

/**
 * Updates the active runtime security mode. Throws if the requested mode is invalid.
 */
function setMode(nextMode) {
  if (typeof nextMode !== 'string') {
    throw new Error('Mode must be a string ("VULNERABLE" or "SECURE").');
  }
  const upper = nextMode.trim().toUpperCase();
  if (!VALID_MODES.has(upper)) {
    throw new Error(`Invalid security mode: ${nextMode}. Expected VULNERABLE or SECURE.`);
  }
  currentMode = upper;
  return currentMode;
}

module.exports = {
  getMode,
  setMode
};
