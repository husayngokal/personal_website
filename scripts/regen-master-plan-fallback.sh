#!/bin/bash
# Generate lib/data/master-plan.ts from the vault's life/master-plan/*.md
# Each file already has YAML frontmatter (part, title, slug) followed by
# the body content. We emit a TypeScript module that mirrors the schema.

set -euo pipefail

VAULT=/Users/husayngokal/Documents/obsidian_vault/life/master-plan
OUT=/Users/husayngokal/Documents/personal_website/lib/data/master-plan.ts

# Pretty header
cat > "$OUT" <<'HDR'
import type { MasterPlanPart } from '../types';

/*
 * Master Plan fallback data — used when Supabase is offline or when
 * the life_master_plan table hasn't been populated yet. The vault's
 * /life/master-plan/*.md files are the canonical source; the syncer
 * upserts them into life_master_plan on every push. These embedded
 * copies are a build-time snapshot so the site renders the plan even
 * without a database connection. Regenerate via scripts/regen-master-plan-fallback.sh.
 */

export const MASTER_PLAN_PARTS: MasterPlanPart[] = [
HDR

shopt -s nullglob
for f in "$VAULT"/*.md; do
  base=$(basename "$f" .md)
  # Parse YAML frontmatter
  part=$(awk '/^part:/ {gsub(/"/, "", $2); print $2}' "$f")
  title=$(awk -F'"' '/^title:/ {print $2; exit}' "$f")
  slug=$(awk '/^slug:/ {print $2}' "$f")

  # Body: everything after the second `---` line
  body=$(awk 'BEGIN{c=0} /^---$/{c++; next} c==2{print}' "$f")

  # Escape backticks and template-literal interpolation markers
  esc_body=$(printf '%s' "$body" | sed -e 's/\\/\\\\/g' -e 's/`/\\`/g' -e 's/\$\\{/\\${/g')

  # Render entry
  cat >> "$OUT" <<EOF
  {
    slug: '$slug',
    partNumber: $((10#$part)),
    title: '$(printf '%s' "$title" | sed "s/'/\\\\'/g")',
    body: \`$esc_body\`,
  },
EOF
done

cat >> "$OUT" <<'TAIL'
];
TAIL

echo "Wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes, $(grep -c '^  {' "$OUT") parts)"
