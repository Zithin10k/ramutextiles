/**
 * Image handling utilities for the e-commerce platform
 * Provides comprehensive image management, optimization, and fallback handling
 */

// Image configuration constants
export const IMAGE_CONFIG = {
  // Supabase Storage configuration
  STORAGE_BUCKET: 'product-images',
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  
  // Image dimensions and optimization
  THUMBNAIL_SIZE: { width: 200, height: 200 },
  MEDIUM_SIZE: { width: 600, height: 600 },
  LARGE_SIZE: { width: 1200, height: 1200 },
  
  // Quality settings
  JPEG_QUALITY: 85,
  WEBP_QUALITY: 80,
  
  // Fallback images
  FALLBACK_PRODUCT_IMAGE: 'https://images.pexels.com/photos/4465124/pexels-photo-4465124.jpeg?auto=compress&cs=tinysrgb&w=800',
  FALLBACK_THUMBNAIL: 'https://images.pexels.com/photos/4465124/pexels-photo-4465124.jpeg?auto=compress&cs=tinysrgb&w=200',
  PLACEHOLDER_IMAGE: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjgwMCIgdmlld0JveD0iMCAwIDgwMCA4MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iODAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zNzUgMzI1SDQyNVYzNzVIMzc1VjMyNVoiIGZpbGw9IiM5Q0EzQUYiLz4KPHBhdGggZD0iTTMwMCA0MDBIMzUwVjQ1MEgzMDBWNDAwWiIgZmlsbD0iIzlDQTNBRiIvPgo8cGF0aCBkPSJNNDUwIDQwMEg1MDBWNDQ1SDQ1MFY0MDBaIiBmaWxsPSIjOUNBM0FGIi8+CjxwYXRoIGQ9Ik0zNzUgNDc1SDQyNVY1MjVIMzc1VjQ3NVoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+',
};

// Image validation
export const validateImageFile = (file: File): { isValid: boolean; error?: string } => {
  // Check file type
  if (!IMAGE_CONFIG.ALLOWED_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: `Invalid file type. Allowed types: ${IMAGE_CONFIG.ALLOWED_TYPES.join(', ')}`
    };
  }

  // Check file size
  if (file.size > IMAGE_CONFIG.MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File too large. Maximum size: ${IMAGE_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`
    };
  }

  return { isValid: true };
};

// Generate optimized image URL with transformations
export const getOptimizedImageUrl = (
  originalUrl: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  } = {}
): string => {
  if (!originalUrl) return IMAGE_CONFIG.FALLBACK_PRODUCT_IMAGE;

  // If it's a Pexels URL, use their optimization parameters
  if (originalUrl.includes('pexels.com')) {
    const url = new URL(originalUrl);
    if (options.width) url.searchParams.set('w', options.width.toString());
    if (options.height) url.searchParams.set('h', options.height.toString());
    url.searchParams.set('auto', 'compress');
    url.searchParams.set('cs', 'tinysrgb');
    return url.toString();
  }

  // For Supabase storage URLs, add transformation parameters
  if (originalUrl.includes('supabase')) {
    const url = new URL(originalUrl);
    const params = new URLSearchParams();
    
    if (options.width) params.set('width', options.width.toString());
    if (options.height) params.set('height', options.height.toString());
    if (options.quality) params.set('quality', options.quality.toString());
    if (options.format) params.set('format', options.format);
    
    if (params.toString()) {
      url.search = params.toString();
    }
    
    return url.toString();
  }

  return originalUrl;
};

// Generate responsive image URLs
export const getResponsiveImageUrls = (originalUrl: string) => {
  return {
    thumbnail: getOptimizedImageUrl(originalUrl, IMAGE_CONFIG.THUMBNAIL_SIZE),
    medium: getOptimizedImageUrl(originalUrl, IMAGE_CONFIG.MEDIUM_SIZE),
    large: getOptimizedImageUrl(originalUrl, IMAGE_CONFIG.LARGE_SIZE),
    original: originalUrl
  };
};

// Image loading state management
export const createImageLoader = () => {
  const loadedImages = new Set<string>();
  const failedImages = new Set<string>();

  return {
    isLoaded: (url: string) => loadedImages.has(url),
    isFailed: (url: string) => failedImages.has(url),
    markLoaded: (url: string) => loadedImages.add(url),
    markFailed: (url: string) => failedImages.add(url),
    preloadImage: (url: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (loadedImages.has(url)) {
          resolve();
          return;
        }

        const img = new Image();
        img.onload = () => {
          loadedImages.add(url);
          resolve();
        };
        img.onerror = () => {
          failedImages.add(url);
          reject(new Error(`Failed to load image: ${url}`));
        };
        img.src = url;
      });
    }
  };
};

// Generate placeholder while loading
export const generatePlaceholder = (width: number, height: number, text?: string): string => {
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#F3F4F6"/>
      <rect x="${width/2 - 20}" y="${height/2 - 20}" width="40" height="40" rx="4" fill="#9CA3AF"/>
      ${text ? `<text x="${width/2}" y="${height/2 + 30}" text-anchor="middle" fill="#6B7280" font-family="Arial" font-size="14">${text}</text>` : ''}
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

// Image upload utilities
export const resizeImage = (
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.8
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to resize image'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image for resizing'));
    img.src = URL.createObjectURL(file);
  });
};

// Cache management
export const imageCache = {
  cache: new Map<string, string>(),
  
  get(key: string): string | undefined {
    return this.cache.get(key);
  },
  
  set(key: string, value: string): void {
    // Limit cache size to prevent memory issues
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  },
  
  clear(): void {
    this.cache.clear();
  }
};

// Error handling and retry logic
export const loadImageWithRetry = async (
  url: string,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<string> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      return url;
    } catch (error) {
      if (attempt === maxRetries) {
        console.warn(`Failed to load image after ${maxRetries} attempts:`, url);
        return IMAGE_CONFIG.FALLBACK_PRODUCT_IMAGE;
      }
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  return IMAGE_CONFIG.FALLBACK_PRODUCT_IMAGE;
};