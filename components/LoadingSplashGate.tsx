/*
 * Sync gate for the loading splash. Renders an inline <script> as the
 * first element of <body> so it executes synchronously as the browser
 * parses the document, before any visible body content paints.
 *
 * The plain JSX <script> tag survives Next.js App Router's renderer
 * when placed inside the body. (Inside <head> the same element gets
 * moved into the React Flight stream and runs late; next/script's
 * beforeInteractive only queues, doesn't sync-execute.)
 *
 * Logic:
 *   1. pathname is not '/'                  → no splash
 *   2. sessionStorage already has hg-loaded  → no splash
 *   3. prefers-reduced-motion                → no splash
 *   4. otherwise                              → data-splash='showing'
 */

/* The failsafe setTimeout removes the attribute after 4s no matter what.
   The splash overlay is CSS-hidden the instant the attribute is gone, so
   even if React never hydrates (JS error, slow chunk) the page can never
   stay stuck behind the splash. The component's own timeline clears it
   earlier (2.5s) on the happy path. */
const SCRIPT = `try{if(location.pathname==='/'&&sessionStorage.getItem('hg-loaded')!=='1'&&!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)){var d=document.documentElement;d.setAttribute('data-splash','showing');setTimeout(function(){d.removeAttribute('data-splash');},4000);}}catch(e){}`;

export function LoadingSplashGate() {
  return (
    <script
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
    />
  );
}
