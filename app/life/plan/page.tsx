import Link from 'next/link';
import { Eyebrow } from '@/components/Primitives';
import { getMasterPlanParts } from '@/lib/content/master-plan';
import styles from './plan.module.css';

/*
 * Master Plan index — table of contents for the operating document.
 * Eighteen Parts, in order, each linking to its own detail page where
 * the long-form markdown body renders. The plan is the constitutional
 * document beneath the rest of the Life Plan surface; it defines what
 * "the work" actually is across ten domains.
 *
 * Per the brief's voice band — conversational with editorial discipline.
 * Each Part listing shows the title and a short editor's summary so the
 * reader can navigate by intent rather than by ordinal alone.
 */

export const revalidate = 60; // ISR — vault webhook calls revalidatePath() on push for immediate freshness

export const metadata = {
  title: 'The Master Plan',
  description:
    "The operating document for the entire life — eighteen Parts covering identity, learning method, ten technical domains, integration, portfolio, artifacts, seasons, templates, and the master index.",
};

/* Editor's summaries — written for the website, not extracted from
   the source PDF. One sentence each, sequenced so a reader skimming
   the TOC can decide where to dive in. */
const PART_SUMMARIES: Record<string, string> = {
  'master-architecture':      "Identity, motto, the ten domains, the learning method, the AI usage constitution, the phases — the whole shape on one canvas.",
  'source-architecture':      "Why primary sources beat secondhand explanations, and the four-tier hierarchy that every roadmap below should follow.",
  'software-development':     "Frontend, backend, DevOps, design — the ladder from first HTML page to deployed product, with the project ladder and twelve serious artifacts.",
  'design':                   "Product taste, Figma, design systems, Nielsen heuristics, the IDEO process — design as a required component of software, not a parallel one.",
  'ai-engineering':           "Custom agents, RAG, evals, fine-tuning, LoRA, paper reproductions — the roadmap from prompts to research-paper-level understanding.",
  'mathematics':              "Arithmetic repair through calculus, linear algebra, probability, proof writing — the language required for every other technical domain.",
  'physics':                  "Foundational physics into quantum mechanics, quantum computing, and quantum hardware. Targets: Griffiths and Nielsen-Chuang.",
  'electronics':              "Circuits, simulation, breadboards, datasheets, PCBs, embedded systems, semiconductors — theory becomes measurement becomes hardware.",
  'cybersecurity':            "Hack The Box, CPTS, OSCP, web exploitation, Active Directory, bug bounties — practical offensive security with professional writeups.",
  'operating-systems':        "Linux, C, Rust, kernels, allocators, compilers, networking — building the tools most developers only use.",
  'philosophy':               "Metaphysics, epistemology, ethics, logic, philosophy of language and science — serious reflection, not aesthetic reading.",
  'research-writing':         "Mini essays, literature mapping, citation discipline, paper drafts — the operating mode of every other domain.",
  'integration-system':       "The personal operating system that holds the whole plan together — folder structure, weekly rituals, AI assistants, daily build log.",
  'github-portfolio':         "Username, README, repo templates, public profile — the public record of serious work as it accumulates.",
  'first-90-artifacts':       "The concrete starting list. Ninety artifacts across all ten domains, each one a discrete thing that can be built, shipped, and pointed at.",
  'priority-seasons':         "How seasons are organised — active domains, maintenance domains, dormant domains. Season 1 and Season 2 laid out explicitly.",
  'templates-checklists':     "The repeatable forms — project templates, weekly review checklists, AI assistant instructions, artifact criteria.",
  'master-index':             "The final index. Every Part, every Domain, every artifact category, every checklist — the navigable map of the whole document.",
};

export default async function MasterPlanIndex() {
  const parts = await getMasterPlanParts();

  return (
    <div className="page page--life">
      <Eyebrow number="11">Life Plan</Eyebrow>
      <p className={styles.kicker}>
        <Link href="/life">← Life Plan</Link>
      </p>
      <h1 className={styles.title}>The Master Plan</h1>
      <p className={styles.dek}>
        The operating document beneath the rest of this site. Eighteen
        Parts that define what the work actually is, in which order,
        with which standards, and against which I check myself. The
        document was authored privately as a working brief; the
        published version is the same text, lightly edited for reading.
      </p>

      <ol className={styles.list}>
        {parts.map((p) => (
          <li key={p.slug} className={styles.item}>
            <Link href={`/life/plan/${p.slug}`} className={styles.link}>
              <span className={styles.num}>{String(p.partNumber).padStart(2, '0')}</span>
              <span className={styles.text}>
                <span className={styles.partTitle}>{p.title}</span>
                <span className={styles.partSummary}>{PART_SUMMARIES[p.slug] ?? ''}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
