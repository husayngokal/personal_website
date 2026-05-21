import { Eyebrow } from '@/components/Primitives';
import { FoodGallery } from '@/components/FoodGallery';
import { FOOD_ITEMS } from '@/lib/content/food';
import styles from './food.module.css';

/* Static gallery — the image list never changes per request. Prerender
   it and let the CDN serve it. */
export const dynamic = 'force-static';

export const metadata = {
  title: 'Food',
  description: "Some of the best food I've had over the years. Some simple, some fancy, all equally delicious and memory-filled.",
};

/*
 * Food (Part: gallery surface). A wall of dishes, each labelled with
 * what it is and nothing more. The stories and the places stay off the
 * page on purpose; this is the eating, not the writing about it.
 */

export default function FoodPage() {
  return (
    <div className="page page--wide" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.head}>
        <Eyebrow number="16">Food</Eyebrow>
        <h1 className={styles.title}>Food</h1>
        <p className={styles.dek}>
          Some of the best food I&apos;ve had over the years. Some simple, some
          fancy, all equally delicious and memory-filled.
        </p>
        <p className={styles.count}>{FOOD_ITEMS.length} photos</p>
      </header>

      <FoodGallery items={FOOD_ITEMS} />
    </div>
  );
}
