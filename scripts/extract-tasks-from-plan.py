#!/usr/bin/env python3
"""
Extract task-like content from the Master Plan into vault/tasks/.

Pulls from three places:
  1. Part 15 — 90 named artifacts ({Category} Artifact N — Title)
  2. Part 16 — Season 1 main + stretch lists (plain numbered items)
  3. Part 17 — review templates (daily/weekly/monthly/quarterly/yearly)

Output: one markdown file per task under vault/tasks/, organised in
subfolders so the vault stays scannable. Slug is set in frontmatter
so the parser ignores the path nesting when keying the DB row.

Re-runnable: idempotent. Existing task files are overwritten with the
extracted version. Hand-edited files outside the extracted set are
left alone.
"""

import re
import sys
from pathlib import Path
from collections import defaultdict

VAULT = Path('/Users/husayngokal/Documents/obsidian_vault')
PLAN  = VAULT / 'life' / 'master-plan'
OUT   = VAULT / 'tasks'

# ----- Part 15: 90 artifacts -------------------------------------

# 9 prefixes → (output subfolder, category slug)
ARTIFACT_CATEGORIES = {
    'Software':       ('artifacts/software',      'software'),
    'AI':             ('artifacts/ai',             'ai'),
    'Math':           ('artifacts/math',           'math'),
    'Physics':        ('artifacts/physics',        'physics'),
    'EEE':            ('artifacts/electronics',   'electronics'),
    'Cybersecurity':  ('artifacts/cybersecurity',  'cybersecurity'),
    'Systems':        ('artifacts/systems',       'systems'),
    'Philosophy':     ('artifacts/philosophy',    'philosophy'),
    'Public':         ('artifacts/public',         'public'),
}
ARTIFACT_HEADING_RE = re.compile(
    r'^(Software|AI|Math|Physics|EEE|Cybersecurity|Systems|Philosophy|Public)\s+Artifact\s+(\d+)\s+—\s+(.+)$'
)


def slugify(text: str) -> str:
    """Lowercase, hyphenated, no symbols."""
    s = text.lower()
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s[:80]


def extract_artifact_blocks(plan_text: str) -> list[dict]:
    """Walk Part 15's body, capture each artifact heading + the lines
    that follow it (description, 'Done means:', criteria, Priority:)
    until the next artifact heading or category boundary."""
    lines = plan_text.split('\n')
    artifacts = []
    cur = None
    for line in lines:
        m = ARTIFACT_HEADING_RE.match(line.strip())
        if m:
            if cur:
                artifacts.append(cur)
            prefix, num, title = m.group(1), int(m.group(2)), m.group(3).strip()
            cur = {
                'prefix': prefix,
                'num': num,
                'title': title.rstrip(' :'),
                'lines': [],
            }
            continue
        # Stop accumulating if we hit a top-level heading (next part of plan)
        if line.startswith('## ') or line.startswith('# '):
            if cur:
                artifacts.append(cur)
                cur = None
            continue
        if cur is not None:
            cur['lines'].append(line)
    if cur:
        artifacts.append(cur)
    return artifacts


def write_artifact(art: dict) -> Path:
    subfolder, category = ARTIFACT_CATEGORIES[art['prefix']]
    folder = OUT / subfolder
    folder.mkdir(parents=True, exist_ok=True)
    # Slug like "sw-01-developer-os" — short prefix for the file system,
    # full title slug in frontmatter for the URL.
    short_prefix = {
        'Software': 'sw', 'AI': 'ai', 'Math': 'math',
        'Physics': 'phy', 'EEE': 'eee', 'Cybersecurity': 'cyb',
        'Systems': 'sys', 'Philosophy': 'phil', 'Public': 'pub',
    }[art['prefix']]
    title_slug = slugify(art['title'])
    fname = f"{short_prefix}-{art['num']:02d}-{title_slug}.md"
    url_slug = f"artifact-{short_prefix}-{art['num']:02d}-{title_slug}"

    # Trim the body — keep description, Done means, and Priority. Drop
    # stray blank runs.
    body = '\n'.join(art['lines']).strip()
    body = re.sub(r'\n{3,}', '\n\n', body)

    fpath = folder / fname
    fpath.write_text(f"""---
slug: {url_slug}
title: "{art['title'].replace('"', "'")}"
status: open
scope: lifetime
category: {category}
ordinal: {art['num']}
---

{body}
""")
    return fpath


# ----- Part 16: Season 1 main + stretch --------------------------

def extract_season_1(plan16: str) -> list[dict]:
    """Pull the two numbered lists under '## 9. Season 1 Main Artifacts'
    and '## 10. Season 1 Stretch Artifacts'."""
    items: list[dict] = []
    sections = [
        ('Main',    '## 9. Season 1 Main Artifacts',    'this-month', 1),
        ('Stretch', '## 10. Season 1 Stretch Artifacts', 'this-quarter', 2),
    ]
    for label, header, scope, priority in sections:
        idx = plan16.find(header)
        if idx == -1:
            continue
        # Read until the next ## heading
        nxt = plan16.find('\n## ', idx + len(header))
        block = plan16[idx:nxt] if nxt != -1 else plan16[idx:]
        for m in re.finditer(r'^\s*(\d+)\.\s+(.+)$', block, re.MULTILINE):
            num = int(m.group(1))
            title = m.group(2).strip()
            items.append({
                'season': 1, 'label': label, 'num': num,
                'title': title, 'scope': scope, 'priority': priority,
            })
    return items


def write_season_task(item: dict) -> Path:
    folder = OUT / 'season-1'
    folder.mkdir(parents=True, exist_ok=True)
    suffix = 'main' if item['label'] == 'Main' else 'stretch'
    title_slug = slugify(item['title'])
    fname = f"s1-{suffix}-{item['num']:02d}-{title_slug}.md"
    url_slug = f"season-1-{suffix}-{item['num']:02d}-{title_slug}"
    fpath = folder / fname
    fpath.write_text(f"""---
slug: {url_slug}
title: "{item['title'].replace('"', "'")}"
status: open
scope: {item['scope']}
category: season-1-{suffix}
priority: {item['priority']}
ordinal: {item['num']}
---

Season 1 {item['label'].lower()} artifact — see Part 16 of the
[[master plan]] for context.
""")
    return fpath


# ----- Part 17: recurring routines -------------------------------

ROUTINES = [
    # (heading-in-part-17, title, recurrence, scope, ordinal)
    ('## 3. Daily Execution Template',  'Daily execution plan',  'daily',   'today',       1),
    ('## 4. Daily Shutdown Template',   'Daily shutdown',         'daily',   'today',       2),
    ('## 2. Master Weekly Planning Template', 'Master weekly plan', 'weekly',  'this-week',  1),
    ('## 10. Weekly Review Template',   'Weekly review',          'weekly',  'this-week',  2),
    ('## 11. Monthly Review Template',  'Monthly review',         'monthly', 'this-month', 1),
    ('## 12. Seasonal Review Template', 'Seasonal review',        'quarterly','this-quarter', 1),
    ('## 13. Yearly Review Template',   'Yearly review',          'yearly',  'this-year',  1),
]


def write_routines() -> list[Path]:
    folder = OUT / 'routines'
    folder.mkdir(parents=True, exist_ok=True)
    written = []
    for header, title, recur, scope, ordinal in ROUTINES:
        title_slug = slugify(title)
        fname = f"{recur}-{title_slug}.md"
        url_slug = f"routine-{recur}-{title_slug}"
        fpath = folder / fname
        fpath.write_text(f"""---
slug: {url_slug}
title: "{title}"
status: open
scope: {scope}
recurrence: {recur}
category: routine
ordinal: {ordinal}
---

Recurring routine — see [[master plan]] Part 17 for the full template.
This task surfaces on every {recur} cycle as a reminder; mark
in-progress while running, then done.
""")
        written.append(fpath)
    return written


# ----- Main ------------------------------------------------------

def main():
    print(f'Extracting tasks from {PLAN} into {OUT}/')

    # 1. Part 15 — 90 artifacts
    plan15 = (PLAN / '15-first-90-artifacts.md').read_text()
    artifacts = extract_artifact_blocks(plan15)
    print(f'  Part 15: {len(artifacts)} artifacts found')
    by_prefix: dict[str, int] = defaultdict(int)
    for art in artifacts:
        if art['prefix'] not in ARTIFACT_CATEGORIES:
            print(f'    skip unknown prefix: {art["prefix"]} — {art["title"]}', file=sys.stderr)
            continue
        write_artifact(art)
        by_prefix[art['prefix']] += 1
    for p, n in sorted(by_prefix.items()):
        print(f'    {p:14} {n} artifacts')

    # 2. Part 16 — Season 1 main + stretch
    plan16 = (PLAN / '16-priority-seasons.md').read_text()
    s1 = extract_season_1(plan16)
    main_n = sum(1 for x in s1 if x['label'] == 'Main')
    stretch_n = sum(1 for x in s1 if x['label'] == 'Stretch')
    print(f'  Part 16: {main_n} Season 1 main, {stretch_n} stretch')
    for it in s1:
        write_season_task(it)

    # 3. Part 17 — recurring routines
    routines = write_routines()
    print(f'  Part 17: {len(routines)} recurring routines')

    total = sum(by_prefix.values()) + main_n + stretch_n + len(routines)
    print(f'\nTotal task files written: {total}')


if __name__ == '__main__':
    main()
