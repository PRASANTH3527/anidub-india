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
  it('normalizes local /logo.png and CDN image URLs cleanly without Unsplash dependencies', () => {
    const cdn = '  https://i.ibb.co/98W13PY/poster.jpg  ';
    assert.strictEqual(buildOptimizedImageUrl(cdn), 'https://i.ibb.co/98W13PY/poster.jpg');
    assert.strictEqual(buildOptimizedImageUrl('/logo.png'), '/logo.png');
    assert.strictEqual(buildResponsiveSrcSet('https://i.ibb.co/98W13PY/poster.jpg'), undefined);

    const optImgContent = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/OptimizedImage.tsx'),
      'utf-8'
    );
    assert.ok(optImgContent.includes("DEFAULT_FALLBACK = '/logo.png'"));
    assert.strictEqual(optImgContent.includes('unsplash.com'), false);
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
