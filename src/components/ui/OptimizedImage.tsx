import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageIcon, AlertCircle } from 'lucide-react';
import { 
  getOptimizedImageUrl, 
  getResponsiveImageUrls, 
  generatePlaceholder,
  loadImageWithRetry,
  IMAGE_CONFIG 
} from '../../lib/imageUtils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  lazy?: boolean;
  fallbackSrc?: string;
  placeholder?: 'blur' | 'empty';
  onLoad?: () => void;
  onError?: () => void;
  sizes?: string;
  quality?: number;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  width,
  height,
  priority = false,
  lazy = true,
  fallbackSrc,
  placeholder = 'blur',
  onLoad,
  onError,
  sizes,
  quality = IMAGE_CONFIG.JPEG_QUALITY,
  objectFit = 'cover'
}) => {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);
  const [isInView, setIsInView] = useState(!lazy || priority);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || priority || isInView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [lazy, priority, isInView]);

  // Load image when in view
  useEffect(() => {
    if (!isInView || !src) return;

    const loadImage = async () => {
      try {
        setImageState('loading');
        
        // Get optimized URL
        const optimizedSrc = getOptimizedImageUrl(src, {
          width,
          height,
          quality,
          format: 'webp'
        });

        // Load with retry logic
        const loadedSrc = await loadImageWithRetry(optimizedSrc);
        setCurrentSrc(loadedSrc);
        setImageState('loaded');
        onLoad?.();
      } catch (error) {
        console.error('Failed to load image:', error);
        setCurrentSrc(fallbackSrc || IMAGE_CONFIG.FALLBACK_PRODUCT_IMAGE);
        setImageState('error');
        onError?.();
      }
    };

    loadImage();
  }, [isInView, src, width, height, quality, fallbackSrc, onLoad, onError]);

  // Generate responsive URLs for srcSet
  const responsiveUrls = src ? getResponsiveImageUrls(src) : null;

  // Generate placeholder
  const placeholderSrc = placeholder === 'blur' 
    ? generatePlaceholder(width || 400, height || 400, 'Loading...')
    : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB2aWV3Qm94PSIwIDAgMSAxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InRyYW5zcGFyZW50Ii8+PC9zdmc+';

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      <AnimatePresence mode="wait">
        {imageState === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-gray-100"
          >
            {placeholder === 'blur' ? (
              <img
                src={placeholderSrc}
                alt=""
                className="w-full h-full object-cover filter blur-sm"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-400">
                <ImageIcon className="w-8 h-8 mb-2" />
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
              </div>
            )}
          </motion.div>
        )}

        {imageState === 'loaded' && currentSrc && (
          <motion.img
            key="loaded"
            ref={imgRef}
            src={currentSrc}
            srcSet={responsiveUrls ? `
              ${responsiveUrls.thumbnail} 200w,
              ${responsiveUrls.medium} 600w,
              ${responsiveUrls.large} 1200w
            ` : undefined}
            sizes={sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
            alt={alt}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full"
            style={{ objectFit }}
            loading={lazy && !priority ? 'lazy' : 'eager'}
            decoding="async"
          />
        )}

        {imageState === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-gray-100"
          >
            <div className="flex flex-col items-center justify-center text-gray-400">
              <AlertCircle className="w-8 h-8 mb-2" />
              <span className="text-sm">Failed to load</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Specialized components for different use cases
export const ProductImage: React.FC<Omit<OptimizedImageProps, 'fallbackSrc'>> = (props) => (
  <OptimizedImage
    {...props}
    fallbackSrc={IMAGE_CONFIG.FALLBACK_PRODUCT_IMAGE}
    quality={IMAGE_CONFIG.JPEG_QUALITY}
  />
);

export const ProductThumbnail: React.FC<Omit<OptimizedImageProps, 'fallbackSrc' | 'width' | 'height'>> = (props) => (
  <OptimizedImage
    {...props}
    fallbackSrc={IMAGE_CONFIG.FALLBACK_THUMBNAIL}
    width={IMAGE_CONFIG.THUMBNAIL_SIZE.width}
    height={IMAGE_CONFIG.THUMBNAIL_SIZE.height}
    quality={IMAGE_CONFIG.WEBP_QUALITY}
  />
);

export const ProductGalleryImage: React.FC<OptimizedImageProps> = (props) => (
  <OptimizedImage
    {...props}
    priority={false}
    lazy={true}
    placeholder="blur"
    quality={IMAGE_CONFIG.JPEG_QUALITY}
  />
);