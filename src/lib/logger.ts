function ts(): string {
  // KST 타임스탬프
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
}

export const log = {
  info: (...a: unknown[]) => console.log(`[${ts()}]`, ...a),
  warn: (...a: unknown[]) => console.warn(`[${ts()}] ⚠ `, ...a),
  error: (...a: unknown[]) => console.error(`[${ts()}] ✖ `, ...a),
};
