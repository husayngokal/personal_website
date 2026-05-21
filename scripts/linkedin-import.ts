/*
 * LinkedIn → credentials importer.
 *
 *   npm run linkedin:import -- ~/Downloads/linkedin-export.zip
 *   npm run linkedin:import -- ~/Downloads/linkedin-export.zip --dry-run
 *
 * Reads the CSVs inside the LinkedIn data export zip and writes one
 * credentials/<slug>.md per entry into the vault. Three sources:
 *
 *   - Certifications.csv → type: certificate
 *   - Education.csv      → type: diploma
 *   - Honors.csv         → type: other
 *
 * (Positions / work experience is deliberately NOT imported — it's
 * the wrong shape for a credentials surface.)
 *
 * Output entries have NO file_path (LinkedIn doesn't host the cert
 * PDFs), only metadata + a verification URL. The credential detail
 * page renders the verify link as the primary CTA when no file is
 * present.
 *
 * Idempotent: re-running never overwrites a slug that already exists
 * in the vault.
 */

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const exec = promisify(execFile);

const VAULT_CREDENTIALS = '/Users/husayngokal/Documents/obsidian_vault/credentials';

interface Row {
  [column: string]: string;
}

/* Tiny CSV parser — LinkedIn's CSVs use comma + double-quote escaping
   per RFC 4180. The format is too simple to pull in a dependency. */
function parseCSV(text: string): Row[] {
  /* Strip a UTF-8 BOM if present. */
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cur += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(cur); cur = ''; i++; continue; }
    if (c === '\n' || c === '\r') {
      row.push(cur); cur = '';
      rows.push(row); row = [];
      if (c === '\r' && text[i + 1] === '\n') i += 2; else i++;
      continue;
    }
    cur += c; i++;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => {
      const obj: Row = {};
      headers.forEach((h, j) => obj[h] = (r[j] ?? '').trim());
      return obj;
    });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function yamlString(s: string): string {
  /* Quote with double quotes, escape internal double quotes. */
  return `"${s.replace(/"/g, '\\"')}"`;
}

async function existingFile(path: string): Promise<boolean> {
  try { await stat(path); return true; }
  catch { return false; }
}

function yearFrom(...candidates: string[]): number | undefined {
  for (const c of candidates) {
    const m = c?.match(/\b(19|20)\d{2}\b/);
    if (m) return Number(m[0]);
  }
  return undefined;
}

/* Pull the LinkedIn data export zip apart in /tmp so we can read
   the CSVs by name without depending on a zip library. The macOS
   `ditto` tool ships with the OS and handles the extraction cleanly. */
async function extractZip(zipPath: string): Promise<string> {
  const dest = join(tmpdir(), `linkedin-import-${Date.now()}`);
  await mkdir(dest, { recursive: true });
  await exec('ditto', ['-xk', zipPath, dest]);
  return dest;
}

async function readCsvIfPresent(dir: string, name: string): Promise<Row[]> {
  const path = join(dir, name);
  if (!await existingFile(path)) return [];
  return parseCSV(await readFile(path, 'utf8'));
}

interface Entry {
  type: 'certificate' | 'diploma' | 'other';
  title: string;
  institution?: string;
  year?: number;
  dateIssued?: string;       // ISO-ish "YYYY-MM"
  description?: string;
  verificationUrl?: string;
  body?: string;             // optional markdown body
}

/* ----- Certifications ------------------------------------------------ */

function mapCertifications(rows: Row[]): Entry[] {
  /* LinkedIn columns: Name, Url, Authority, Started On, Finished On,
     License Number. Some exports use slightly different headers (e.g.
     "Started" instead of "Started On") so we read with fallbacks. */
  return rows.map((r): Entry | null => {
    const name = r['Name'] || r['Title'] || '';
    if (!name) return null;
    const authority = r['Authority'] || r['Issuer'] || '';
    const url = r['Url'] || r['URL'] || '';
    const started = r['Started On'] || r['Started'] || '';
    const finished = r['Finished On'] || r['Finished'] || '';
    const license = r['License Number'] || '';
    const year = yearFrom(finished, started);
    const dateIssued = (finished || started).match(/(\d{4})[-/]?(\d{2})?/);
    const desc = license ? `Credential ID ${license}` : undefined;
    return {
      type: 'certificate',
      title: name,
      institution: authority || undefined,
      year,
      dateIssued: dateIssued ? `${dateIssued[1]}${dateIssued[2] ? '-' + dateIssued[2] : ''}` : undefined,
      description: desc,
      verificationUrl: url || undefined,
    };
  }).filter((x): x is Entry => x !== null);
}

/* ----- Education ---------------------------------------------------- */

function mapEducation(rows: Row[]): Entry[] {
  /* Columns: School Name, Start Date, End Date, Notes, Degree Name,
     Activities. The degree + school combination is the title; the
     school is the institution. */
  return rows.map((r): Entry | null => {
    const school = r['School Name'] || r['School'] || '';
    const degree = r['Degree Name'] || r['Degree'] || '';
    if (!school && !degree) return null;
    const start = r['Start Date'] || r['Started On'] || '';
    const end = r['End Date'] || r['Finished On'] || '';
    const notes = r['Notes'] || '';
    const activities = r['Activities'] || '';
    const title = degree ? `${degree} — ${school}` : school;
    const year = yearFrom(end, start);
    const descParts: string[] = [];
    if (activities) descParts.push(`Activities: ${activities}`);
    return {
      type: 'diploma',
      title,
      institution: school || undefined,
      year,
      dateIssued: yearFrom(end)?.toString(),
      description: descParts.length ? descParts.join(' · ') : undefined,
      body: notes || undefined,
    };
  }).filter((x): x is Entry => x !== null);
}

/* ----- Honors ------------------------------------------------------- */

function mapHonors(rows: Row[]): Entry[] {
  return rows.map((r): Entry | null => {
    const title = r['Title'] || r['Name'] || '';
    if (!title) return null;
    const issuer = r['Issuer'] || r['Authority'] || '';
    const date = r['Date'] || '';
    const description = r['Description'] || '';
    return {
      type: 'other',
      title,
      institution: issuer || undefined,
      year: yearFrom(date),
      dateIssued: date || undefined,
      description: description || undefined,
    };
  }).filter((x): x is Entry => x !== null);
}

/* ----- Write to vault ---------------------------------------------- */

async function writeEntry(entry: Entry, dryRun: boolean): Promise<{ written: boolean; skipped?: 'exists' | 'empty'; path: string }> {
  const slug = slugify(
    entry.institution
      ? `${entry.institution}-${entry.title}`
      : entry.title,
  );
  if (!slug) return { written: false, skipped: 'empty', path: '' };
  const path = join(VAULT_CREDENTIALS, `${slug}.md`);
  if (await existingFile(path)) {
    return { written: false, skipped: 'exists', path };
  }
  const lines = [
    '---',
    `title: ${yamlString(entry.title)}`,
    `type: ${entry.type}`,
    ...(entry.institution ? [`institution: ${yamlString(entry.institution)}`] : []),
    ...(entry.year ? [`year: ${entry.year}`] : []),
    ...(entry.dateIssued ? [`date-issued: ${yamlString(entry.dateIssued)}`] : []),
    ...(entry.description ? [`description: ${yamlString(entry.description)}`] : []),
    ...(entry.verificationUrl ? [`verification-url: ${yamlString(entry.verificationUrl)}`] : []),
    'public: true',
    '---',
    '',
    entry.body ?? '',
  ];
  if (!dryRun) {
    await mkdir(VAULT_CREDENTIALS, { recursive: true });
    await writeFile(path, lines.join('\n'));
  }
  return { written: true, path };
}

/* ----- Main -------------------------------------------------------- */

async function main() {
  const args = process.argv.slice(2);
  const zipPath = args.find((a) => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');

  if (!zipPath) {
    console.error('Usage: npm run linkedin:import -- <path/to/Basic_LinkedInDataExport.zip> [--dry-run]');
    console.error('\nGet the zip from: https://www.linkedin.com/mypreferences/d/download-my-data');
    process.exit(1);
  }
  if (!await existingFile(zipPath)) {
    console.error(`File not found: ${zipPath}`);
    process.exit(1);
  }

  console.log(`Extracting ${zipPath} ...`);
  const dir = await extractZip(zipPath);
  console.log(`Extracted to ${dir}`);

  const certs = await readCsvIfPresent(dir, 'Certifications.csv');
  const edus  = await readCsvIfPresent(dir, 'Education.csv');
  const hons  = await readCsvIfPresent(dir, 'Honors.csv');
  console.log(`\nFound: ${certs.length} certifications, ${edus.length} education entries, ${hons.length} honors\n`);

  const entries: Entry[] = [
    ...mapCertifications(certs),
    ...mapEducation(edus),
    ...mapHonors(hons),
  ];

  let written = 0, skipped = 0, empty = 0;
  for (const e of entries) {
    const r = await writeEntry(e, dryRun);
    if (r.written) {
      written++;
      const tag = dryRun ? '[dry-run]' : '+';
      console.log(`  ${tag} ${e.type.padEnd(11)} ${e.title.slice(0, 50).padEnd(50)} ${e.institution ? '· ' + e.institution.slice(0, 30) : ''}`);
    } else if (r.skipped === 'exists') {
      skipped++;
    } else if (r.skipped === 'empty') {
      empty++;
    }
  }

  console.log(`\n${dryRun ? 'Would write' : 'Wrote'} ${written} new credential file${written === 1 ? '' : 's'}.`);
  if (skipped > 0) console.log(`Skipped ${skipped} already in vault.`);
  if (empty > 0)   console.log(`Skipped ${empty} with empty title.`);
  if (dryRun) console.log('\nRe-run without --dry-run to actually write.');
  else console.log(`\nNext: review files in ${VAULT_CREDENTIALS}, then commit + push the vault.`);
}

main().catch((err) => { console.error('\nFailed:', err); process.exit(1); });
