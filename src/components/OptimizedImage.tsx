import React, { useState, useEffect } from 'react';

export interface OptimizedImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height' | 'loading'> {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  priority?: boolean;
  loading?: 'lazy' | 'eager';
  sizes?: string;
  quality?: number;
  unoptimized?: boolean;
  fallbackSrc?: string;
}

/**
 * Normalizes an image URL cleanly for responsive rendering.
 */
export function buildOptimizedImageUrl(rawSrc: string, _width?: number, _quality: number = 75): string {
  if (!rawSrc || typeof rawSrc !== 'string') return '';
  return rawSrc.trim();
}

/**
 * Generates a responsive `srcSet` string when a CDN supports width transforms.
 */
export function buildResponsiveSrcSet(_rawSrc: string, _quality: number = 75): string | undefined {
  return undefined;
}

/**
 * Resolves standard HTML image performance attributes for priority and lazy images.
 */
export function resolveImagePerformanceAttrs(
  props: Pick<OptimizedImageProps, 'priority' | 'loading' | 'sizes' | 'fill'>
) {
  const isPriority = Boolean(props.priority);
  const resolvedLoading: 'eager' | 'lazy' = isPriority ? 'eager' : props.loading || 'lazy';
  const resolvedDecoding: 'sync' | 'async' = isPriority ? 'sync' : 'async';
  const resolvedFetchPriority: 'high' | 'low' | 'auto' = isPriority
    ? 'high'
    : resolvedLoading === 'lazy'
      ? 'low'
      : 'auto';
  const resolvedSizes =
    props.sizes ||
    (props.fill
      ? '100vw'
      : '(max-width: 640px) 48vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px');

  return {
    loading: resolvedLoading,
    decoding: resolvedDecoding,
    fetchPriority: resolvedFetchPriority,
    sizes: resolvedSizes,
  };
}

const DEFAULT_FALLBACK = '/logo.png';

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  fill = false,
  priority = false,
  loading,
  sizes,
  quality = 75,
  unoptimized = false,
  fallbackSrc = DEFAULT_FALLBACK,
  className = '',
  style,
  onError,
  ...rest
}) => {
  const numericWidth = typeof width === 'number' ? width : width ? parseInt(String(width), 10) : 480;
  const optimizedSrc = unoptimized ? src : buildOptimizedImageUrl(src, numericWidth || 480, quality);
  const [currentSrc, setCurrentSrc] = useState(optimizedSrc || fallbackSrc);

  useEffect(() => {
    setCurrentSrc(
      unoptimized ? src : buildOptimizedImageUrl(src, numericWidth || 480, quality) || fallbackSrc
    );
  }, [src, numericWidth, quality, unoptimized, fallbackSrc]);

  const perfAttrs = resolveImagePerformanceAttrs({ priority, loading, sizes, fill });
  const srcSet = !unoptimized && currentSrc === optimizedSrc ? buildResponsiveSrcSet(src, quality) : undefined;

  // Inject preload link for priority LCP images
  useEffect(() => {
    if (!priority || typeof document === 'undefined' || !currentSrc) return;
    const selector = `link[rel="preload"][as="image"][href="${CSS.escape(currentSrc)}"]`;
    if (document.head.querySelector(selector)) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = currentSrc;
    if (srcSet) link.setAttribute('imagesrcset', srcSet);
    if (perfAttrs.sizes) link.setAttribute('imagesizes', perfAttrs.sizes);
    link.setAttribute('fetchpriority', 'high');
    document.head.appendChild(link);
  }, [priority, currentSrc, srcSet, perfAttrs.sizes]);

  const fillStyles: React.CSSProperties | undefined = fill
    ? {
        position: 'absolute',
        height: '100%',
        width: '100%',
        inset: 0,
        ...style,
      }
    : style;

  return (
    <img
      src={currentSrc}
      srcSet={srcSet}
      alt={alt || ''}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      loading={perfAttrs.loading}
      decoding={perfAttrs.decoding}
      fetchPriority={perfAttrs.fetchPriority}
      sizes={perfAttrs.sizes}
      style={fillStyles}
      className={className}
      onError={(e) => {
        if (fallbackSrc && currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
        if (onError) onError(e);
      }}
      {...rest}
    />
  );
};

export default OptimizedImage;
