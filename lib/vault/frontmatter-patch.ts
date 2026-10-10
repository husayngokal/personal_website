/*
 * Surgical frontmatter edits.
 *
 * Changes single scalar keys in a vault file's YAML frontmatter and leaves
 * every other byte of the file exactly as the author wrote it. The Studio
 * form path (gray-matter stringify) re-serialises the whole block, which
 * re-quotes strings and reorders nothing but still produces noisy diffs;
 * a one-tap "+10%" should produce a one-line diff.
 *
 * Deliberately narrow: only top-level scalar keys. If the key currently
 * holds a list or block (indented continuation lines), it refuses rather
 * than guess. Pure module, no I/O, so it is unit-testable outside Next.
 */

export type ScalarChange = string | number | null;   // null removes the key

const YAML_RESERVED = /^(true|false|null|yes|no|on|off|~)$/i;
const PLAIN_SAFE = /^[A-Za-z0-9][A-Za-z0-9 _./-]*$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function format(value: string | number): string {
  if (typeof value === 'number') return String(value);
  if (ISO_DAY.test(value)) return value;
  if (PLAIN_SAFE.test(value) && !YAML_RESERVED.test(value) && !/^\d+(\.\d+)?$/.test(value)) return value;
  return JSON.stringify(value);   // double-quoted YAML string
}

export function patchFrontmatter(raw: string, changes: Record<string, ScalarChange>): string {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(eol);
  if (lines[0] !== '---') throw new Error('file has no frontmatter block');
  const close = lines.indexOf('---', 1);
  if (close === -1) throw new Error('frontmatter block is not closed');

  const fm = lines.slice(1, close);
  for (const [key, value] of Object.entries(changes)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(key)) throw new Error(`unsupported key: ${key}`);
    const at = fm.findIndex((l) => l.startsWith(`${key}:`) && (l.length === key.length + 1 || /\s/.test(l[key.length + 1])));
    if (at !== -1) {
      const next = fm[at + 1];
      if (next !== undefined && /^(\s+\S|- )/.test(next)) {
        throw new Error(`${key} holds a list or block; refusing a scalar edit`);
      }
      if (value === null) fm.splice(at, 1);
      else fm[at] = `${key}: ${format(value)}`;
    } else if (value !== null) {
      fm.push(`${key}: ${format(value)}`);
    }
  }
  return [lines[0], ...fm, ...lines.slice(close)].join(eol);
}
