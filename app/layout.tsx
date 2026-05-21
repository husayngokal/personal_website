import type { Metadata, Viewport } from 'next';
import { sourceSerif, plexSans, plexMono, notoSymbols } from './fonts';
import { TopNav } from '@/components/TopNav';
import { MementoLine } from '@/components/MementoLine';
import { RouteTransition } from '@/components/RouteTransition';
import { SearchPalette } from '@/components/SearchPalette';
import { LoadingSplash } from '@/components/LoadingSplash';
import { LoadingSplashGate } from '@/components/LoadingSplashGate';
import { getCurrentLocation } from '@/lib/content/location';
import './globals.css';

/*
 * Root layout — applies the type stack as CSS variables, mounts the top
 * navigation (identical on every page per Part IV), and registers the
 * Cmd-K search palette (Part IV, "Search").
 *
 * The site has no conventional footer. The logo lives only in the top
 * nav. The discipline of a single rendering, in one place, repeated,
 * is what gives the mark its weight (Part II).
 */

/* Single source of truth for the site description so the page meta,
   Open Graph, Twitter card, and manifest never drift apart. */
const SITE_DESCRIPTION =
  'The public notebook of Husayn Gokal. Building software, breaking systems, reading, writing, and studying across eight domains, shown as the work moves, not after.';

export const metadata: Metadata = {
  metadataBase: new URL('https://husayngokal.com'),
  title: {
    default: 'husayn gokal.',
    /* Middle dot, not an em-dash: this string shows in browser tabs and
       search results, which are user-visible. */
    template: '%s · husayn gokal.',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'husayngokal.com',
  authors: [{ name: 'Husayn Gokal', url: 'https://husayngokal.com' }],
  creator: 'Husayn Gokal',
  publisher: 'Husayn Gokal',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    title: 'husayn gokal.',
    description: SITE_DESCRIPTION,
    url: 'https://husayngokal.com',
    siteName: 'husayn gokal.',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'husayn gokal.',
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

/* JSON-LD Person schema. Lets search engines and social platforms
   resolve "Husayn Gokal" as an entity (name, role, what he works on)
   rather than just a string. Only verifiable facts go in here; no
   guessed social profiles. */
const PERSON_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Husayn Gokal',
  alternateName: 'husayn gokal',
  url: 'https://husayngokal.com',
  email: 'mailto:husayn@husayngokal.com',
  description: SITE_DESCRIPTION,
  knowsAbout: [
    'Software engineering',
    'Cybersecurity',
    'Mathematics',
    'Physics',
    'Electronics',
    'Research',
    'Writing',
    'Reading',
  ],
};

/* Viewport — tints the mobile browser chrome (iOS status bar, Android
   toolbar) to the page-beige paper. The site has no dark mode (Part III),
   so theme-color is a single static value. */
export const viewport: Viewport = {
  themeColor: '#EFE7D7',
  colorScheme: 'light',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /* Server-fetch the author's location so the status pulse renders
     with the right city + timezone on first paint. Falls back to
     Sharjah inside getCurrentLocation if Supabase isn't configured
     or no row exists.

     The search index used to be fetched here too, but it touches a
     dozen tables and most visitors never open Cmd-K. The palette now
     pulls /api/search-index lazily on first open, cutting every
     page-render's Supabase fan-out down to a single small query. */
  const location = await getCurrentLocation();
  return (
    /* suppressHydrationWarning: the splash gate script sets
       data-splash on <html> during body parse, before React hydrates.
       Without this, that attribute is a root-level hydration mismatch
       ("won't be patched up"), which degrades hydration on the homepage
       — the navigation hub. This is the same pattern next-themes uses
       for its pre-hydration <html> class script. Scope is one level
       (the <html> element's own attributes), so real mismatches inside
       the tree are still reported. */
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sourceSerif.variable} ${plexSans.variable} ${plexMono.variable} ${notoSymbols.variable}`}
      >
        {/* Sync gate — first thing in <body> so it executes
            synchronously during HTML parsing, before any visible
            body content paints. Decides whether the loading splash
            should be visible on this navigation. */}
        <LoadingSplashGate />
        {/* Person structured data for search + social entity resolution. */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(PERSON_JSON_LD) }}
        />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <TopNav location={{ city: location.city, timezone: location.timezone }} />
        <main id="main">
          <RouteTransition>{children}</RouteTransition>
        </main>
        <MementoLine />
        <SearchPalette />
        <LoadingSplash />
      </body>
    </html>
  );
}
