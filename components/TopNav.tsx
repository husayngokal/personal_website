import { Logo } from './Logo';
import { MenuDrawer } from './MenuDrawer';
import { StatusPulse, type StatusPulseProps } from './StatusPulse';
import { SearchButton } from './SearchButton';
import styles from './TopNav.module.css';

/*
 * Top navigation — identical on every page per Part IV.
 *
 *   logo flush left
 *   "Menu" button + status pulse pushed to the far right
 *
 * The bar deliberately stays minimal: a single Menu trigger that
 * opens a panel listing every surface grouped by register
 * (see components/MenuDrawer). The brief's "one navigation
 * pattern" rule is preserved — there's still exactly one place
 * the visitor goes to find a surface — but with 9 surfaces it had
 * to stop being an inline row.
 *
 * TopNav itself is a pure server component; the drawer (state +
 * keyboard handling) is the only client island, the StatusPulse
 * the other.
 */

export function TopNav({ location }: { location?: StatusPulseProps }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Logo />
        <div className={styles.right}>
          <SearchButton />
          <StatusPulse city={location?.city} timezone={location?.timezone} />
          <MenuDrawer />
        </div>
      </div>
    </header>
  );
}
