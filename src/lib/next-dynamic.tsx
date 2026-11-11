import React, { Suspense } from 'react';

export interface DynamicOptions<P = any> {
  loading?: React.ComponentType<any> | (() => React.ReactNode | null);
  ssr?: boolean;
}

/**
 * Next.js compatible `dynamic()` loader for code-splitting heavy components
 * so they do not block the initial main-thread bundle on mobile.
 */
export default function dynamic<P extends object = any>(
  loader: () => Promise<React.ComponentType<P> | { default: React.ComponentType<P> }>,
  options?: DynamicOptions<P>
): React.FC<P> {
  const LazyComponent = React.lazy(async () => {
    const mod = await loader();
    if (typeof mod === 'function') {
      return { default: mod };
    }
    if (mod && typeof mod === 'object' && 'default' in mod) {
      return mod as { default: React.ComponentType<P> };
    }
    const firstExport = Object.values(mod as any).find((v) => typeof v === 'function') as React.ComponentType<P>;
    return { default: firstExport };
  });

  const LoadingFallback = options?.loading;

  const DynamicWrapper: React.FC<P> = (props) => {
    const fallbackNode = LoadingFallback ? <LoadingFallback /> : null;
    return (
      <Suspense fallback={fallbackNode}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };

  return DynamicWrapper;
}
