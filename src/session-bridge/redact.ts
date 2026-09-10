const PATTERNS: RegExp[] = [
  /sk-(or|proj|ant|live|test)-[A-Za-z0-9_-]{8,}/g,
  /sk-[A-Za-z0-9]{16,}/g,
  /ghp_[A-Za-z0-9]{10,}/g,
  /gho_[A-Za-z0-9]{10,}/g,
  /github_pat_[A-Za-z0-9_]{10,}/g,
  /xox[bap]-[A-Za-z0-9-]{8,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /(api[_-]?key|apikey|auth[_-]?token|access[_-]?token|secret|password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{4,}['"]?/gi,
  /Bearer\s+[A-Za-z0-9_.\-~+/=]{12,}/g,
];

export const MAX_OBSERVATION_CHARS = 500;
export const MAX_OBSERVATIONS_PER_SESSION = 8;

export function redactSecrets(text: string): string {
  let out = text;
  for (const re of PATTERNS) {
    out = out.replace(re, '[REDACTED]');
  }
  return out;
}

export function truncate(text: string, max: number = MAX_OBSERVATION_CHARS): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

export function cleanObservations(texts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of texts) {
    const cleaned = truncate(redactSecrets(t));
    if (cleaned.length < 3 || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
    if (out.length >= MAX_OBSERVATIONS_PER_SESSION) break;
  }
  return out;
}
