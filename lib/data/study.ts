import type {
  StudyCredential,
  StudyDomain,
  Publication,
  Conference,
} from '../types';

/*
 * Credentials per Part X of BRIEF.md — CAPM, ICS Foundation Diploma
 * (Introduction to Shipping passed May 2026, Marine Insurance pending),
 * Qiskit Advocate, CS50AI, ASTI HID, with Curtin BSc IT in progress.
 *
 * Every credential carries the structurally-required what-stuck and
 * what-didnt fields. No credential without an honest assessment.
 */

export const STUDY_CREDENTIALS: StudyCredential[] = [
  {
    slug: 'capm',
    title: 'CAPM',
    fullTitle: 'Certified Associate in Project Management',
    institution: 'Project Management Institute',
    earned: '2025-09-15',
    expires: '2028-09-15',
    depth: 'working-in',
    lastAssessed: '2026-05-01',
    tags: ['project-management', 'credential'],
    whatStuck:
      'The framework for thinking about scope, schedule, and cost trade-offs has been useful in client conversations, and the explicit vocabulary for risk registers and stakeholder analysis is something I reach for repeatedly.',
    whatDidnt:
      'The PMI-specific terminology rarely matters outside formal PMI environments; I translate to plain English in practice. The detailed mathematical formulas for EVM I have not used since the exam.',
  },
  {
    slug: 'ics-introduction-to-shipping',
    title: 'ICS — Introduction to Shipping',
    fullTitle: 'ICS Foundation Diploma — Introduction to Shipping',
    institution: 'Institute of Chartered Shipbrokers',
    earned: '2026-05-08',
    depth: 'learning',
    lastAssessed: '2026-05-10',
    tags: ['shipping', 'marine'],
    whatStuck:
      'The structural picture of how chartering markets, owners, brokers, charterers, and ports interact as a system. That model is now operational for me when I read industry news.',
    whatDidnt:
      'Specific dry-bulk charter party clauses without the rest of a working context — they are exam-shaped knowledge that will decay unless I encounter them in real work.',
  },
  {
    slug: 'ics-marine-insurance',
    title: 'ICS — Marine Insurance',
    fullTitle: 'ICS Foundation Diploma — Marine Insurance',
    institution: 'Institute of Chartered Shipbrokers',
    pending: true,
    earned: undefined,
    depth: 'learning',
    lastAssessed: '2026-05-10',
    tags: ['insurance', 'marine'],
    whatStuck:
      'Provisional, ahead of the exam — the Institute clauses (ITC Hulls, ICC A/B/C), the structure of cover, the role of warranties, and the practical workings of subrogation are now part of the working set for Slipwise.',
    whatDidnt:
      'To be re-assessed honestly two weeks after the exam, when the shape of what carried into practice will be clearer.',
  },
  {
    slug: 'qiskit-advocate',
    title: 'Qiskit Advocate',
    institution: 'IBM Quantum',
    earned: '2024-11-20',
    depth: 'dabbled',
    lastAssessed: '2026-04-15',
    tags: ['quantum', 'computing'],
    whatStuck:
      'A working mental model for gate-based quantum computation and an ability to read the relevant literature without translation. The vocabulary is internalised.',
    whatDidnt:
      'Without a current research or build context I am not actively using Qiskit week-to-week. The hands-on facility has decayed to about half of what it was at the exam window.',
  },
  {
    slug: 'cs50ai',
    title: 'CS50AI',
    fullTitle: 'CS50 Introduction to Artificial Intelligence with Python',
    institution: 'Harvard (online)',
    earned: '2024-08-12',
    depth: 'working-in',
    lastAssessed: '2026-05-01',
    tags: ['ai', 'computer-science'],
    whatStuck:
      'Concrete fluency with search, constraint satisfaction, classical ML, and Markov decision processes. The mental scaffolding that lets me read modern LLM agent papers without losing my place.',
    whatDidnt:
      'The minimax / alpha-beta material has not come up in practice; it is preserved as knowledge but not as skill.',
  },
  {
    slug: 'asti-hid',
    title: 'ASTI Higher International Diploma',
    fullTitle: 'Higher International Diploma in Electrical and Electronic Engineering',
    institution: 'ASTI',
    earned: '2024-06-10',
    depth: 'working-in',
    lastAssessed: '2026-04-25',
    tags: ['electrical', 'electronic', 'engineering'],
    whatStuck:
      'Solid foundational facility with circuit analysis, basic signal processing, and embedded systems thinking. The hands-on lab work was the part that carried.',
    whatDidnt:
      'Some of the advanced power-systems content has decayed since I have not been working in that domain.',
  },
  {
    slug: 'curtin-bsc-it',
    title: 'BSc Information Technology (in progress)',
    institution: 'Curtin University',
    pending: true,
    depth: 'learning',
    lastAssessed: '2026-04-30',
    tags: ['degree', 'computer-science'],
    whatStuck: 'In progress — the assessment is deferred until the degree is well underway.',
    whatDidnt: 'In progress — see above.',
  },
];

export const STUDY_DOMAINS: StudyDomain[] = [
  {
    slug: 'software-development',
    title: 'Software Development and Product Engineering',
    depth: 'teaching-from',
    body:
      'My primary professional domain. Web development, system design, product architecture, and engineering process. Most of my Slipwise work lives in this domain — full-stack TypeScript, Postgres, event-driven architecture, regulated-tech disciplines. I am most current here on the system-design and product-engineering boundary; less current on pure-frontend craft, which I deliberately let lag because it is the part of the field that changes fastest.',
  },
  {
    slug: 'ai-engineering',
    title: 'AI Engineering',
    depth: 'working-in',
    body:
      'Large language model integration, agentic systems, prompt engineering, retrieval-augmented generation, evaluations. The fastest-moving of the eight domains; my depth indicators here are updated more frequently than anywhere else. Most of the work that earns the working-in label has been on Slipwise (AI-assisted underwriting workflows under regulated constraints) plus prior consulting work.',
  },
  {
    slug: 'mathematics',
    title: 'Mathematics',
    depth: 'learning',
    body:
      'Linear algebra (most current), calculus (decayed), probability and statistics (planned), proof-based mathematics (planned). The honest assessment is that I am at late-high-school to early-undergraduate level in pure math and rebuilding deliberately. This domain has the largest gap between where I want to be and where I am, and the gap is closing only as fast as deliberate study time allows.',
  },
  {
    slug: 'physics-and-quantum-computing',
    title: 'Physics and Quantum Computing',
    depth: 'working-in',
    body:
      'Foundational physics through undergraduate level, plus active study of quantum computing through the Qiskit ecosystem. My 2024 publication on quantum graph neural networks for financial fraud detection lives in this domain; I am not currently in active research on it but the vocabulary is operational.',
  },
  {
    slug: 'electrical-and-electronic-engineering',
    title: 'Electrical and Electronic Engineering',
    depth: 'working-in',
    body:
      'Circuit design, embedded systems, signal processing. Foundational from the ASTI diploma. Current depth is working-in for the basics, dabbled for advanced topics like power systems and RF design where I have not had recent work to maintain capability.',
  },
  {
    slug: 'cybersecurity',
    title: 'Cybersecurity',
    depth: 'working-in',
    body:
      'Application security, authentication, authorization, threat modeling. Working-in depth from Slipwise\'s regulatory requirements and prior project work. The honest gaps: red-team / offensive practice, which I have not done at any scale; and formal cryptography, which I treat with deliberate humility.',
  },
  {
    slug: 'low-level-programming',
    title: 'Low-Level Programming',
    depth: 'learning',
    body:
      'Systems programming, memory management, compilers. Currently a learning domain rather than a working-in one. I am working through deliberate exercises — small C projects, a Rust ownership refresher, some toy compiler work — to lift this from dabbled to working-in over the next eighteen months.',
  },
  {
    slug: 'philosophy',
    title: 'Philosophy',
    depth: 'working-in',
    body:
      'Epistemology, philosophy of science, ethics at the level of method. Held deliberately as a separate domain rather than folded into others because my relationship to philosophy is methodological rather than discipline-specific. The reading list rotates between contemporary epistemology, classical Islamic philosophy, and methodological writing from working scientists.',
  },
];

export const PUBLICATIONS: Publication[] = [
  {
    slug: 'qgnn-fraud-2024',
    title: 'Quantum Graph Neural Networks for Financial Fraud Detection',
    venue: 'Springer Nature — Quantum Machine Intelligence',
    year: 2024,
    authors: 'H. Gokal et al.',
    href: 'https://link.springer.com/',
  },
];

export const CONFERENCES: Conference[] = [
  {
    slug: 'ibm-quantum-summit-2024',
    name: 'IBM Quantum Summit',
    year: 2024,
    role: 'Attendee',
  },
];
