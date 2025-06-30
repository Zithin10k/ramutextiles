import { supabase } from './supabase';
import { resizeImage, validateImageFile, IMAGE_CONFIG } from './imageUtils';
import { debugLogger, createPerformanceMonitor, validateFileUpload } from './debugUtils';

export interface UploadResult {
  url: string;
  path: string;
  error?: string;
}

export interface UploadProgress {
  progress: number;
  stage: 'validating' | 'resizing' | 'uploading' | 'complete' | 'error';
}

/**
 * Upload image to Supabase Storage with comprehensive debugging
 */
export const uploadProductImage = async (
  file: File,
  productId: string,
  index: number = 0,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const monitor = createPerformanceMonitor(`uploadProductImage-${file.name}`);
  
  try {
    debugLogger.info('UPLOAD', `Starting upload for ${file.name}`, {
      productId,
      index,
      fileSize: file.size,
      fileType: file.type
    });

    // Validation
    onProgress?.({ progress: 10, stage: 'validating' });
    monitor.checkpoint('validation-start');
    
    const fileValidation = validateFileUpload(file);
    if (!fileValidation.valid) {
      const error = `File validation failed: ${fileValidation.error}`;
      debugLogger.error('UPLOAD', error);
      return { url: '', path: '', error };
    }

    const validation = validateImageFile(file);
    if (!validation.isValid) {
      debugLogger.error('UPLOAD', `Image validation failed: ${validation.error}`);
      return { url: '', path: '', error: validation.error };
    }
    
    monitor.checkpoint('validation-complete');

    // Resize image
    onProgress?.({ progress: 30, stage: 'resizing' });
    monitor.checkpoint('resize-start');
    
    debugLogger.info('UPLOAD', 'Starting image resize');
    const resizedBlob = await resizeImage(
      file,
      IMAGE_CONFIG.LARGE_SIZE.width,
      IMAGE_CONFIG.LARGE_SIZE.height,
      IMAGE_CONFIG.JPEG_QUALITY / 100
    );
    
    debugLogger.info('UPLOAD', 'Image resized successfully', {
      originalSize: file.size,
      resizedSize: resizedBlob.size,
      compressionRatio: ((file.size - resizedBlob.size) / file.size * 100).toFixed(2) + '%'
    });
    
    monitor.checkpoint('resize-complete');

    // Generate file path
    const fileExt = 'jpg'; // Always convert to JPG for consistency
    const fileName = `${productId}-${index}-${Date.now()}.${fileExt}`;
    const filePath = `products/${fileName}`;
    
    debugLogger.info('UPLOAD', `Generated file path: ${filePath}`);

    // Upload to Supabase Storage
    onProgress?.({ progress: 60, stage: 'uploading' });
    monitor.checkpoint('upload-start');
    
    debugLogger.info('UPLOAD', 'Starting Supabase storage upload', {
      bucket: IMAGE_CONFIG.STORAGE_BUCKET,
      path: filePath,
      contentType: 'image/jpeg'
    });

    const { data, error } = await supabase.storage
      .from(IMAGE_CONFIG.STORAGE_BUCKET)
      .upload(filePath, resizedBlob, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (error) {
      debugLogger.error('UPLOAD', 'Supabase storage upload failed', {
        error: error.message,
        bucket: IMAGE_CONFIG.STORAGE_BUCKET,
        path: filePath
      });
      return { url: '', path: '', error: error.message };
    }

    debugLogger.info('UPLOAD', 'Upload successful', data);
    monitor.checkpoint('upload-complete');

    // Get public URL
    monitor.checkpoint('url-generation-start');
    const { data: { publicUrl } } = supabase.storage
      .from(IMAGE_CONFIG.STORAGE_BUCKET)
      .getPublicUrl(data.path);

    debugLogger.info('UPLOAD', 'Public URL generated', { publicUrl });
    monitor.checkpoint('url-generation-complete');

    onProgress?.({ progress: 100, stage: 'complete' });
    monitor.complete();

    return {
      url: publicUrl,
      path: data.path
    };

  } catch (error) {
    debugLogger.error('UPLOAD', 'Upload failed with exception', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    onProgress?.({ progress: 0, stage: 'error' });
    monitor.complete();
    
    return { 
      url: '', 
      path: '', 
      error: error instanceof Error ? error.message : 'Upload failed' 
    };
  }
};

/**
 * Upload multiple images for a product with detailed progress tracking
 */
export const uploadProductImages = async (
  files: File[],
  productId: string,
  onProgress?: (index: number, progress: UploadProgress) => void
): Promise<UploadResult[]> => {
  const monitor = createPerformanceMonitor(`uploadProductImages-${files.length}-files`);
  
  debugLogger.info('BATCH_UPLOAD', `Starting batch upload of ${files.length} files`, {
    productId,
    files: files.map(f => ({ name: f.name, size: f.size, type: f.type }))
  });

  const results: UploadResult[] = [];

  for (let i = 0; i < files.length; i++) {
    monitor.checkpoint(`file-${i + 1}-start`);
    
    debugLogger.info('BATCH_UPLOAD', `Processing file ${i + 1}/${files.length}: ${files[i].name}`);
    
    const result = await uploadProductImage(
      files[i],
      productId,
      i,
      (progress) => {
        debugLogger.info('BATCH_UPLOAD', `File ${i + 1} progress: ${progress.progress}% (${progress.stage})`);
        onProgress?.(i, progress);
      }
    );
    
    results.push(result);
    monitor.checkpoint(`file-${i + 1}-complete`);
    
    if (result.error) {
      debugLogger.error('BATCH_UPLOAD', `File ${i + 1} failed: ${result.error}`);
    } else {
      debugLogger.info('BATCH_UPLOAD', `File ${i + 1} uploaded successfully: ${result.url}`);
    }
  }

  const successCount = results.filter(r => !r.error).length;
  const failCount = results.filter(r => r.error).length;
  
  debugLogger.info('BATCH_UPLOAD', `Batch upload completed`, {
    total: files.length,
    successful: successCount,
    failed: failCount,
    results: results.map(r => ({ url: r.url, error: r.error }))
  });

  monitor.complete();
  return results;
};

/**
 * Delete image from Supabase Storage
 */
export const deleteProductImage = async (path: string): Promise<boolean> => {
  debugLogger.info('DELETE', `Deleting image: ${path}`);
  
  try {
    const { error } = await supabase.storage
      .from(IMAGE_CONFIG.STORAGE_BUCKET)
      .remove([path]);

    if (error) {
      debugLogger.error('DELETE', `Delete failed: ${error.message}`, { path });
      return false;
    }

    debugLogger.info('DELETE', `Delete successful: ${path}`);
    return true;
  } catch (error) {
    debugLogger.error('DELETE', 'Delete failed with exception', {
      path,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
};

/**
 * Get optimized URL from Supabase Storage
 */
export const getStorageImageUrl = (
  path: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg';
  } = {}
): string => {
  if (!path) {
    debugLogger.warn('URL_GENERATION', 'Empty path provided, using fallback');
    return IMAGE_CONFIG.FALLBACK_PRODUCT_IMAGE;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(IMAGE_CONFIG.STORAGE_BUCKET)
    .getPublicUrl(path);

  // Add transformation parameters if supported
  const url = new URL(publicUrl);
  if (options.width) url.searchParams.set('width', options.width.toString());
  if (options.height) url.searchParams.set('height', options.height.toString());
  if (options.quality) url.searchParams.set('quality', options.quality.toString());
  if (options.format) url.searchParams.set('format', options.format);

  debugLogger.info('URL_GENERATION', 'Generated storage URL', {
    path,
    options,
    url: url.toString()
  });

  return url.toString();
};