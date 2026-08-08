'use client';

import { usePathname } from 'next/navigation';

/*
 * Hides the global site chrome (top nav, footer line, Cmd-K palette) on the
 * Studio surface. Studio is a private authoring tool with its own header, so
 * the marketing chrome would just stack a second header on top of it.
 *
 * Server components (e.g. TopNav with its location prop) are passed through as
 * children; this client wrapper only decides whether to include them, based on
 * the current path.
 */
export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith('/studio')) return null;
  return <>{children}</>;
}
