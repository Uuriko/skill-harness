// Secret scrubber for replay-harness traces.
//
// Every `detail` string serialized into a trace passes through scrubSecrets()
// so recorded evidence never persists credentials. Scrubbing is lossy on
// purpose: a trace is evidence, not a debug log.
//
// Pure regex, zero dependencies.

export const SCRUB_PATTERNS = [
  // OpenAI-style secret keys: sk- + 20+ key chars
  /sk-[A-Za-z0-9_-]{20,}/g,
  // GitHub tokens: ghp_ / gho_ / github_pat_ + 20+ alnum
  /(?:ghp_|gho_|github_pat_)[A-Za-z0-9]{20,}/g,
  // Slack tokens: xoxb- / xoxa- / xoxp- + non-whitespace
  /xox[bap]-\S+/g,
  // AWS access key IDs: AKIA + 16 uppercase alnum
  /AKIA[0-9A-Z]{16}/g,
  // Bearer auth headers in HTTP detail text
  /Bearer\s+\S+/g,
  // api_key / api-key / apikey = or : value
  /api[_-]?key\s*[:=]\s*['"]?\S+/gi,
];

const REDACTED = "[REDACTED]";

export function scrubSecrets(text) {
  if (typeof text !== "string") return text;
  let out = text;
  for (const re of SCRUB_PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, REDACTED);
  }
  return out;
}
