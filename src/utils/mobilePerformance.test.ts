import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildOptimizedImageUrl,
  buildResponsiveSrcSet,
  resolveImagePerformanceAttrs,
} from '../components/OptimizedImage';

describe('Mobile Lighthouse Performance Optimizations', () => {
  it('optimizes Unsplash image URLs with width, quality, and auto WebP/AVIF format', () => {
    const raw = 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800';
    const optimized = buildOptimizedImageUrl(raw, 480, 75);
    assert.ok(optimized.includes('auto=format'), 'Must include auto=format');
    assert.ok(optimized.includes('fit=crop'), 'Must include fit=crop');
    assert.ok(optimized.includes('q=75'), 'Must include q=75');
    assert.ok(optimized.includes('w=480'), 'Must resize to requested width w=480');
  });

  it('generates responsive srcSet for Unsplash images across mobile and desktop widths', () => {
    const raw = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800';
    const srcSet = buildResponsiveSrcSet(raw, 75);
    assert.ok(srcSet, 'Should return a non-empty srcSet string');
    assert.ok(srcSet.includes('320w'), 'Must include 320w mobile candidate');
    assert.ok(srcSet.includes('480w'), 'Must include 480w mobile candidate');
    assert.ok(srcSet.includes('800w'), 'Must include 800w tablet/desktop candidate');
  });

  it('resolves priority image attributes for above-the-fold LCP images and lazy attributes for others', () => {
    const priorityAttrs = resolveImagePerformanceAttrs({
      priority: true,
      sizes: '(max-width: 768px) 100vw, 1200px',
    });
    assert.strictEqual(priorityAttrs.loading, 'eager');
    assert.strictEqual(priorityAttrs.fetchPriority, 'high');
    assert.strictEqual(priorityAttrs.decoding, 'sync');
    assert.strictEqual(priorityAttrs.sizes, '(max-width: 768px) 100vw, 1200px');

    const lazyAttrs = resolveImagePerformanceAttrs({
      priority: false,
      loading: 'lazy',
    });
    assert.strictEqual(lazyAttrs.loading, 'lazy');
    assert.strictEqual(lazyAttrs.fetchPriority, 'low');
    assert.strictEqual(lazyAttrs.decoding, 'async');
    assert.ok(lazyAttrs.sizes.includes('48vw'));
  });

  it('uses OptimizedImage with priority, loading="lazy", and sizes across AnimeCard and PublicHomeView', () => {
    const cardContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AnimeCard.tsx'), 'utf-8');
    assert.ok(cardContent.includes("from './OptimizedImage'"), 'AnimeCard must import OptimizedImage');
    assert.ok(cardContent.includes('priority={isPriorityCard}'), 'AnimeCard must set priority for above-the-fold cards');
    assert.ok(cardContent.includes('sizes='), 'AnimeCard must provide responsive sizes attribute');

    const homeContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/PublicHomeView.tsx'), 'utf-8');
    assert.ok(homeContent.includes("from './OptimizedImage'"), 'PublicHomeView must import OptimizedImage');
    assert.ok(homeContent.includes('priority'), 'PublicHomeView hero banner must set priority');
    assert.ok(homeContent.includes('loading="lazy"'), 'PublicHomeView below-the-fold posters must use loading="lazy"');
    assert.ok(homeContent.includes('sizes='), 'PublicHomeView images must specify sizes');
  });

  it('uses React.lazy and Suspense to code-split heavy and below-the-fold components', () => {
    const appContent = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
    assert.ok(appContent.includes('lazy('), 'App.tsx must use React.lazy for non-critical views');
    assert.ok(appContent.includes('<Suspense'), 'App.tsx must wrap lazy views in Suspense');

    const catalogContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/CatalogView.tsx'), 'utf-8');
    assert.ok(catalogContent.includes('lazy('), 'CatalogView.tsx must use React.lazy for below-the-fold rows');
  });

  it('eliminates render-blocking fonts and scripts via idle scheduling and async stylesheet preload', () => {
    const trackerContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/GodModeTracker.tsx'), 'utf-8');
    assert.ok(trackerContent.includes('requestIdleCallback'), 'GodModeTracker must defer analytics initialization until idle/load');

    const htmlContent = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
    assert.ok(htmlContent.includes('rel="preload"'), 'index.html must preload font stylesheet');
    assert.ok(htmlContent.includes('media="print"'), 'index.html must load Google Fonts non-blockingly');
  });
});
