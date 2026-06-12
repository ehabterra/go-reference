// Build-time reading-time estimate from raw MDX source: prose words at
// ~200wpm, plus a flat allowance per code block / playground / diagram
// (those are read slower than their word count suggests).
export function readingTime(body: string | undefined): number {
  if (!body) return 1;
  const blocks =
    (body.match(/```/g) || []).length / 2 +
    (body.match(/<(Playground|Challenge|Mermaid)\b/g) || []).length;
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<(Playground|Challenge|Mermaid)[\s\S]*?\/>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/[#*_>`~[\]()|-]/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200 + blocks * 0.5));
}
