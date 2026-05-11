/**
 * Text shown when there is no profile photo: first letter of the first two
 * whitespace-separated words (e.g. "Jane Doe" → "JD"), otherwise the first two
 * characters of the string (e.g. username "alex" → "AL").
 */
export function avatarFallbackText(label: string | null | undefined): string {
  const s = (label ?? "").trim();
  if (!s) return "?";
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const a = words[0]?.[0] ?? "";
    const b = words[1]?.[0] ?? "";
    const pair = (a + b).toUpperCase();
    return pair.slice(0, 2) || "?";
  }
  return s.slice(0, 2).toUpperCase();
}
