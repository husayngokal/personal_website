import './life.css';

/*
 * Life Plan layout — surface-specific visual treatment per Part XI.
 *
 *   - Warmer cream background (#F5EFE0)
 *   - Body-large (19px / 1.7) for the prose register
 *   - Tighter measure (60ch)
 *   - Increased vertical breathing room (--space-5xl in places)
 *   - Surface-specific page width (--page-life, 720px)
 *
 * The treatment physically slows the reader. A page that elsewhere
 * fits in one screen takes two on the Life Plan because the breathing
 * room is more generous. (Part XI)
 */

export default function LifeLayout({ children }: { children: React.ReactNode }) {
  return <div className="lifeSurface">{children}</div>;
}
