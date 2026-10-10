/*
 * Numbered "done" items inside a living entry (the Field Atlas).
 *
 * An item is one numbered line; done is marked in the text itself, the
 * convention established when the first hikes were logged:
 *
 *   6. Mushrif Park · Dubai · easy.                 open
 *   6. ~~Mushrif Park · Dubai · easy.~~ · **done**  done
 *
 * Numbers restart per discipline, so the line's full text is the item's
 * identity. Pure module, no I/O.
 */

const ITEM = /^(\d+)\. (.+)$/;
const DONE = /^~~(.+)~~ · \*\*done\*\*$/;

export interface DoneItem {
  line: string;       // the exact source line (identity for toggling)
  number: number;
  text: string;       // without the done markup
  done: boolean;
}

export interface DoneGroup {
  heading: string;    // e.g. "Hiking & Mountaineering"
  items: DoneItem[];
}

function parseLine(line: string): DoneItem | null {
  const m = line.match(ITEM);
  if (!m) return null;
  const d = m[2].match(DONE);
  return { line, number: Number(m[1]), text: d ? d[1] : m[2], done: Boolean(d) };
}

/* Group numbered items under their top-level "# N · NAME · COUNT" heading.
   Only headings that carry a trailing count are disciplines; the prose
   sections after them ("# 4 · The integrated spine") also contain numbered
   lists, which are steps, not loggable outings. */
export function listDoneItems(body: string): DoneGroup[] {
  const groups: DoneGroup[] = [];
  let current: DoneGroup | null = null;
  for (const line of body.split(/\r?\n/)) {
    const h = line.match(/^# \d+ · (.+)$/);
    if (h) {
      const parts = h[1].split(' · ');
      const isDiscipline = parts.length > 1 && /^\d+$/.test(parts[parts.length - 1]);
      current = isDiscipline ? { heading: titleCase(parts.slice(0, -1).join(' · ')), items: [] } : null;
      if (current) groups.push(current);
      continue;
    }
    if (!current) continue;
    const item = parseLine(line);
    if (item) current.items.push(item);
  }
  /* A discipline whose entries are written inline rather than one per line
     (the Diving section packs several sites into each tier line) has no
     toggleable items; leave it out rather than show an empty group. */
  return groups.filter((g) => g.items.length > 0);
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s&])([a-z])/g, (_, pre: string, c: string) => pre + c.toUpperCase());
}

/* Flip one item. `line` must match exactly one line in the file, in the
   state the caller believes it is in; anything else means the file moved
   on since the page loaded, and the caller should reload. */
export function setItemDone(raw: string, line: string, done: boolean): { raw: string; line: string } {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(eol);
  const hits = lines.reduce<number[]>((acc, l, i) => (l === line ? [...acc, i] : acc), []);
  if (hits.length !== 1) throw new Error(hits.length === 0 ? 'item not found (it may have changed)' : 'item is ambiguous');
  const item = parseLine(line);
  if (!item) throw new Error('not a numbered item');
  if (item.done === done) return { raw, line };
  const next = done ? `${item.number}. ~~${item.text}~~ · **done**` : `${item.number}. ${item.text}`;
  lines[hits[0]] = next;
  return { raw: lines.join(eol), line: next };
}
