import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';
import { getSlugRegistry } from './content/links';
import { resolveTarget } from './wikilinks';

/*
 * Markdown → HTML for post bodies. Server-side only.
 *
 * Wikilinks ([[slug]] and [[slug|display]]) resolve cross-surface via
 * the slug registry built from current DB content (lib/content/links).
 * A slug that's unresolved stays as plain text — better a missing link
 * than a 404. Pass `sourceTable` to prefer same-surface resolution on
 * slug collision (Notebook→Notebook over Notebook→Library when both
 * exist with the same slug).
 */

/* Obsidian-style embed (image / file) — must be processed BEFORE the
   plain wikilink regex, otherwise [[file]] inside ![[file]] gets
   matched as a wikilink and the leading ! becomes literal text. */
const EMBED    = /!\[\[([^|\]\n]+)(?:\|([^\]\n]+))?\]\]/g;
const WIKILINK = /\[\[([^|\]\n]+)(?:\|([^\]\n]+))?\]\]/g;

/* Image / asset extensions Obsidian users embed. Anything else
   (.md / .pdf / unknown) renders as a missing-asset placeholder. */
const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

function expandEmbeds(src: string): string {
  return src.replace(EMBED, (_, raw: string, display?: string) => {
    const file = raw.trim();
    const alt  = (display ?? file).trim();
    const isImg = IMAGE_RE.test(file);
    /* Vault assets aren't published to the web today (vault repo is
       private; no media host configured). Render a placeholder until
       NEXT_PUBLIC_VAULT_MEDIA_URL is set, then auto-resolve embeds
       against that base. Setting the env requires Cloudflare R2 or
       similar — see BRIEF + lib/content/documents (TBD). */
    const base = process.env.NEXT_PUBLIC_VAULT_MEDIA_URL;
    if (isImg && base) {
      const url = `${base.replace(/\/+$/, '')}/${encodeURIComponent(file)}`;
      return `![${escapeMd(alt)}](${url})`;
    }
    return `<span class="embed-missing">[${isImg ? 'image' : 'embed'}: ${escapeMd(file)}]</span>`;
  });
}

function escapeMd(s: string): string {
  /* For text inside an alt or placeholder — strip backticks and
     pipes that would otherwise confuse the markdown pipeline. */
  return s.replace(/[`|<>]/g, '');
}

async function expandWikilinks(src: string, sourceTable?: string): Promise<string> {
  const registry = await getSlugRegistry();
  return src.replace(WIKILINK, (_, raw: string, display?: string) => {
    const trimmed = raw.trim();
    const hashIdx = trimmed.indexOf('#');
    const target  = (hashIdx === -1 ? trimmed : trimmed.slice(0, hashIdx)).trim();
    const anchor  = hashIdx === -1 ? '' : `#${trimmed.slice(hashIdx + 1).trim()}`;
    const entry   = resolveTarget(registry, target, sourceTable);
    if (!entry) return display?.trim() || target; // graceful unresolved
    const text = (display ?? entry.title).trim();
    return `<a href="${entry.url}${anchor}">${text}</a>`;
  });
}

export async function renderMarkdown(src: string, sourceTable?: string): Promise<string> {
  /* Order matters: expand image embeds first so their `![[...]]`
     syntax isn't half-eaten by the plain wikilink pass below. */
  const withEmbeds   = expandEmbeds(src);
  const withLinks    = await expandWikilinks(withEmbeds, sourceTable);
  /* `allowDangerousHtml` keeps our embed-placeholder <span> from
     being stripped by remark-html's sanitiser. */
  const file = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(withLinks);
  return String(file);
}
