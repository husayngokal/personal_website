#!/usr/bin/env python3
"""
Post-process the extracted Master Plan markdown files to restore the
heading hierarchy and visual structure that the PDF→text extraction
collapsed.

Rules:
  - First line "Part N — Title" → strip (redundant with frontmatter title)
  - Lines like "1. The Core Purpose" (number + period + capital text)
    on a line by themselves (next line non-blank, non-numbered) → "## 1. ..."
  - Lines starting with "Stage N", "Phase N", "Domain N", "Tier N",
    "Layer N", "Season N — " → "### ..."
  - Indented blocks of 4+ spaces (PDF callouts) → "> blockquote" lines
  - Standalone ALL-CAPS short lines like "Bad AI Use" / "Correct AI Use"
    → "### ..."
  - Bullet markers "●​" (with various invisible chars) → "-"
  - Numbered list items "1.​" → "1." (clean indentation)
  - Strip trailing zero-width / soft-hyphen artifacts
"""

import re
import sys
from pathlib import Path

VAULT = Path('/Users/husayngokal/Documents/obsidian_vault/life/master-plan')

# Bullets in the PDF use "●" followed by various zero-width characters
BULLET_RE = re.compile(r'^(\s*)[●•]\s*[​‌‍﻿]*\s*', re.UNICODE)
# Numbered list "1.​   foo" — preserve indent, normalize the marker
NUMLIST_RE = re.compile(r'^(\s*)(\d+)\.\s*[​‌‍﻿]*\s*', re.UNICODE)
# Standalone heading: "N. Title" with no body text on same line
SECTION_HEADING_RE = re.compile(r'^(\d{1,2})\.\s+([A-Z][^.\n]{2,80})$')
# Subsections like "Stage 5 — Break", "Phase 0 — Becoming Operational"
SUBSECTION_RE = re.compile(
    r'^(Stage|Phase|Domain|Tier|Layer|Season|Chapter|Appendix|Step|Week|Day|Month|Year)'
    r'\s+([\dA-Z]+(?:\.\d+)?)\s+—\s+(.+)$'
)
# Big indented callout/quote (4+ leading spaces)
INDENTED_RE = re.compile(r'^[ ]{4,}(\S)')
# Strip trailing soft-hyphen / zero-width chars
TRAILING_ZERO_RE = re.compile(r'[­​‌‍﻿]+$', re.UNICODE)
# Strip leading PDF page-break (\x0c, form feed) and other control chars
LEADING_CTRL_RE = re.compile(r'^[\x00-\x08\x0b\x0c\x0e-\x1f]+')


def looks_like_section_heading(line: str, next_line: str | None) -> bool:
    """Is this a numbered section heading vs a list item?

    A heading: starts with N., short title, followed by blank line or
    a paragraph. A list item: starts with N. and is followed by more
    list items or stays adjacent to nearby N+1 lines.
    """
    m = SECTION_HEADING_RE.match(line.strip())
    if not m:
        return False
    # Sanity: heading numbers are usually 1-50
    num = int(m.group(1))
    if num > 50:
        return False
    # Title under 80 chars, starts with capital, no sentence-ending period
    title = m.group(2).strip()
    if title.endswith('.') or len(title) > 80 or len(title) < 4:
        return False
    return True


def is_callout_block(lines: list[str], i: int) -> int:
    """Return the number of consecutive callout (indented 4+) lines
    starting at i. 0 if i is not a callout start."""
    n = 0
    while i + n < len(lines) and INDENTED_RE.match(lines[i + n]):
        n += 1
    return n


def process_file(path: Path) -> None:
    text = path.read_text()
    fm_end = text.find('\n---\n', 4)
    if fm_end == -1:
        print(f'  skip {path.name} — no frontmatter')
        return
    frontmatter = text[:fm_end + 5]
    body = text[fm_end + 5:]
    lines = body.split('\n')

    out: list[str] = []
    i = 0
    skipped_first_heading = False

    while i < len(lines):
        raw = lines[i]
        line = LEADING_CTRL_RE.sub('', TRAILING_ZERO_RE.sub('', raw.rstrip()))

        # Strip the "Part N — Title" first-line duplicate. The PDF
        # heading often wraps across 2-3 lines (e.g. "Part 9 —
        # Cybersecurity Roadmap: Linux, Networking, / Web Security,
        # HTB, CPTS, OSCP, Bug Bounties, / Reporting, and Ethical
        # Offensive Security"). Strip the first line, then keep
        # stripping continuation lines that look like title overflow
        # (Title Case, no terminal period) until we hit a heading or
        # body prose.
        if not skipped_first_heading and line.startswith('Part ') and ' — ' in line:
            skipped_first_heading = True
            i += 1
            # Eat blank + continuation lines until we hit a body line.
            while i < len(lines):
                nxt = LEADING_CTRL_RE.sub('', lines[i].rstrip())
                if not nxt:
                    i += 1
                    continue
                if nxt.startswith('## ') or nxt.startswith('### '):
                    break
                if (
                    len(nxt) <= 90
                    and nxt[0].isupper()
                    and not nxt.endswith('.')
                    and not nxt.endswith(':')
                    and SECTION_HEADING_RE.match(nxt) is None
                ):
                    i += 1
                    continue
                break
            continue

        # Detect numbered section heading
        next_line = lines[i + 1] if i + 1 < len(lines) else None
        if looks_like_section_heading(line, next_line):
            out.append('')
            out.append(f'## {line.strip()}')
            out.append('')
            i += 1
            continue

        # Subsection heading
        m = SUBSECTION_RE.match(line.strip())
        if m:
            kind, num, title = m.groups()
            out.append('')
            out.append(f'### {kind} {num} — {title.strip()}')
            out.append('')
            i += 1
            continue

        # Callout block (indented 4+) → blockquote
        callout_len = is_callout_block(lines, i)
        if callout_len >= 2:  # require 2+ lines to qualify as a callout
            out.append('')
            for j in range(callout_len):
                stripped = INDENTED_RE.sub(r'\1', lines[i + j])
                stripped = TRAILING_ZERO_RE.sub('', stripped.rstrip())
                # Strip the captured first non-space char prefix repeat
                stripped = re.sub(r'^[ ]{4,}', '', lines[i + j].rstrip())
                stripped = TRAILING_ZERO_RE.sub('', stripped)
                out.append(f'> {stripped}')
            out.append('')
            i += callout_len
            continue

        # Bullet → "-"
        m = BULLET_RE.match(line)
        if m:
            indent = m.group(1)
            content = BULLET_RE.sub('', line)
            out.append(f'{indent}- {content}')
            i += 1
            continue

        # Numbered list item (only if it's clearly a list — followed
        # by another numbered item or bullet within 2 lines)
        m = NUMLIST_RE.match(line)
        if m and not looks_like_section_heading(line, next_line):
            indent, num = m.group(1), m.group(2)
            content = NUMLIST_RE.sub('', line)
            out.append(f'{indent}{num}. {content}')
            i += 1
            continue

        # Default: passthrough, normalize trailing spaces
        out.append(line)
        i += 1

    # Collapse 3+ blank lines into 2
    cleaned: list[str] = []
    blank_run = 0
    for ln in out:
        if not ln.strip():
            blank_run += 1
            if blank_run <= 2:
                cleaned.append('')
        else:
            blank_run = 0
            cleaned.append(ln)

    new_body = '\n'.join(cleaned).strip() + '\n'
    path.write_text(frontmatter + '\n' + new_body)
    print(f'  cleaned {path.name}  ({len(new_body)} bytes)')


def main():
    files = sorted(VAULT.glob('*.md'))
    print(f'Processing {len(files)} files in {VAULT}')
    for f in files:
        process_file(f)
    print('done')


if __name__ == '__main__':
    main()
