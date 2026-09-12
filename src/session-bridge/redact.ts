/**
 * P1-C3: named secret patterns + redaction metadata for the session bridge.
 *
 * `redactSecrets` / `cleanObservations` keep their exact behavior (the sync
 * path in sync.ts is untouched). The `*WithMeta` twins run the same pipeline
 * and additionally report WHICH pattern families fired, filling the
 * `HelaRedaction { applied, fields[] }` shape on stored session observations.
 */
const NAMED_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'openai_key', pattern: /sk-(or|proj|ant|live|test)-[A-Za-z0-9_-]{8,}/g },
  { name: 'sk_key', pattern: /sk-[A-Za-z0-9]{16,}/g },
  { name: 'github_pat', pattern: /ghp_[A-Za-z0-9]{10,}/g },
  { name: 'github_oauth', pattern: /gho_[A-Za-z0-9]{10,}/g },
  { name: 'github_fine_grained_pat', pattern: /github_pat_[A-Za-z0-9_]{10,}/g },
  { name: 'slack_token', pattern: /xox[bap]-[A-Za-z0-9-]{8,}/g },
  { name: 'aws_access_key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'private_key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: 'jwt', pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: 'key_value_secret', pattern: /(api[_-]?key|apikey|auth[_-]?token|access[_-]?token|secret|password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{4,}['"]?/gi },
  { name: 'bearer_token', pattern: /Bearer\s+[A-Za-z0-9_.\-~+/=]{12,}/g },
];

export interface RedactionMeta {
  applied: boolean;
  fields: string[];
}

export const MAX_OBSERVATION_CHARS = 500;
export const MAX_OBSERVATIONS_PER_SESSION = 8;

/** Scrub secrets; report which named pattern families fired. Pure. */
export function redactSecretsWithMeta(text: string): { text: string; fields: string[] } {
  let out = text;
  const fired = new Set<string>();
  for (const { name, pattern } of NAMED_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(out)) {
      pattern.lastIndex = 0;
      out = out.replace(pattern, '[REDACTED]');
      fired.add(name);
    }
  }
  return { text: out, fields: [...fired] };
}

export function redactSecrets(text: string): string {
  return redactSecretsWithMeta(text).text;
}

export function truncate(text: string, max: number = MAX_OBSERVATION_CHARS): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

/**
 * Same clean/dedupe/cap pipeline as `cleanObservations`, plus the union of
 * fired pattern names across all inputs. `applied` is true when at least one
 * input lost a secret (or was truncated? No — truncation is shaping, not
 * redaction; only secret-pattern hits set applied).
 */
export function cleanObservationsWithMeta(texts: string[]): { observations: string[]; redaction: RedactionMeta } {
  const seen = new Set<string>();
  const out: string[] = [];
  const fired = new Set<string>();
  for (const t of texts) {
    const { text: redacted, fields } = redactSecretsWithMeta(t);
    for (const f of fields) fired.add(f);
    const cleaned = truncate(redacted);
    if (cleaned.length < 3 || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
    if (out.length >= MAX_OBSERVATIONS_PER_SESSION) break;
  }
  const fields = [...fired];
  return { observations: out, redaction: { applied: fields.length > 0, fields } };
}

export function cleanObservations(texts: string[]): string[] {
  return cleanObservationsWithMeta(texts).observations;
}
