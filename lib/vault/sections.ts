/*
 * Markdown section extractor — splits a body into a map of
 * { sectionHeading → content } using ## headings as delimiters.
 *
 * Used by the vault parser to extract framing / when-to-reach / etc.
 * from a Mental Model body file, decisions from a Project body, and so
 * on — fields the exporter wrote as ## sections rather than as
 * frontmatter (because the prose is long enough that YAML multi-line
 * blocks would be painful to edit in Obsidian).
 */

export function sections(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  /* Match `## Heading\n\nbody` blocks. The body extends to the next ##
     or end of input. Case-insensitive heading match because the exporter
     used title-cased headings ("## Husayn's framing") but the parser
     should be tolerant of the author re-typing them lowercased etc. */
  const re = /(^|\n)##\s+([^\n]+)\n+([\s\S]*?)(?=\n##\s+|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const heading = m[2].trim().toLowerCase();
    const content = m[3].trim();
    out[heading] = content;
  }
  return out;
}

/* Helper — parse a bulleted list inside a section into string items.
   Used for when-to-reach / when-not-to / stuck-on. */
export function bullets(text: string): string[] {
  if (!text) return [];
  const lines = text.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) out.push(trimmed.slice(2).trim());
    else if (trimmed.startsWith('* ')) out.push(trimmed.slice(2).trim());
  }
  return out;
}
