import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Anime Card Scroll Reveal Animation', () => {
  it('AnimeCard wraps component in motion.div with requested scroll reveal parameters', () => {
    const cardPath = path.resolve(process.cwd(), 'src/components/AnimeCard.tsx');
    const content = fs.readFileSync(cardPath, 'utf-8');

    // Verify import from framer-motion
    assert.ok(
      content.includes("from 'framer-motion'"),
      'AnimeCard must import motion from framer-motion'
    );

    // Verify initial state: { opacity: 0, y: 30 }
    assert.ok(
      content.includes('opacity: 0, y: 30'),
      'AnimeCard must configure initial state with opacity 0 and y: 30'
    );

    // Verify whileInView state: { opacity: 1, y: 0 }
    assert.ok(
      content.includes('opacity: 1, y: 0'),
      'AnimeCard must configure whileInView state with opacity 1 and y: 0'
    );

    // Verify viewport trigger: { once: true, amount: 0.1 }
    assert.ok(
      content.includes('once: true, amount: 0.1') || (content.includes('once: true') && content.includes('amount: 0.1')),
      'AnimeCard must configure viewport with once: true and amount: 0.1'
    );

    // Verify transition duration: 0.5, ease: "easeOut"
    assert.ok(
      content.includes('duration: 0.5') && content.includes('ease: "easeOut"'),
      'AnimeCard must configure transition with duration 0.5 and ease "easeOut"'
    );
  });

  it('PublicHomeView cards feature scroll reveal motion with matching parameters', () => {
    const homePath = path.resolve(process.cwd(), 'src/components/PublicHomeView.tsx');
    const content = fs.readFileSync(homePath, 'utf-8');

    assert.ok(
      content.includes("from 'framer-motion'"),
      'PublicHomeView must import motion from framer-motion'
    );

    assert.ok(
      content.includes('opacity: 0, y: 30'),
      'PublicHomeView cards must have opacity: 0, y: 30 initial state'
    );

    assert.ok(
      content.includes('once: true, amount: 0.1'),
      'PublicHomeView cards must have viewport once: true and amount: 0.1'
    );
  });
});
