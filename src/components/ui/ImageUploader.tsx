import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  X, 
  GripVertical, 
  Star, 
  AlertCircle, 
  CheckCircle,
  Image as ImageIcon 
} from 'lucide-react';
import { validateImageFile, resizeImage, IMAGE_CONFIG } from '../../lib/imageUtils';
import toast from 'react-hot-toast';

export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  isMain?: boolean;
  uploadProgress?: number;
  error?: string;
}

interface ImageUploaderProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  maxImages?: number;
  allowReorder?: boolean;
  allowMainSelection?: boolean;
  className?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  images,
  onImagesChange,
  maxImages = 5,
  allowReorder = true,
  allowMainSelection = false,
  className = ''
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    const remainingSlots = maxImages - images.length;

    if (fileArray.length > remainingSlots) {
      toast.error(`Can only upload ${remainingSlots} more image(s)`);
      return;
    }

    const newImages: UploadedImage[] = [];

    for (const file of fileArray) {
      const validation = validateImageFile(file);
      
      if (!validation.isValid) {
        toast.error(`${file.name}: ${validation.error}`);
        continue;
      }

      try {
        // Resize image if needed
        const resizedBlob = await resizeImage(
          file,
          IMAGE_CONFIG.LARGE_SIZE.width,
          IMAGE_CONFIG.LARGE_SIZE.height,
          IMAGE_CONFIG.JPEG_QUALITY / 100
        );

        const resizedFile = new File([resizedBlob], file.name, {
          type: 'image/jpeg',
          lastModified: Date.now()
        });

        const preview = URL.createObjectURL(resizedFile);
        
        newImages.push({
          id: `img-${Date.now()}-${Math.random()}`,
          file: resizedFile,
          preview,
          isMain: images.length === 0 && newImages.length === 0, // First image is main
        });
      } catch (error) {
        console.error('Error processing image:', error);
        toast.error(`Failed to process ${file.name}`);
      }
    }

    if (newImages.length > 0) {
      onImagesChange([...images, ...newImages]);
      toast.success(`${newImages.length} image(s) uploaded successfully`);
    }
  }, [images, maxImages, onImagesChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const removeImage = useCallback((index: number) => {
    const newImages = [...images];
    URL.revokeObjectURL(newImages[index].preview);
    newImages.splice(index, 1);
    
    // If removed image was main, make first image main
    if (newImages.length > 0 && !newImages.some(img => img.isMain)) {
      newImages[0].isMain = true;
    }
    
    onImagesChange(newImages);
  }, [images, onImagesChange]);

  const setMainImage = useCallback((index: number) => {
    if (!allowMainSelection) return;
    
    const newImages = images.map((img, i) => ({
      ...img,
      isMain: i === index
    }));
    onImagesChange(newImages);
  }, [images, onImagesChange, allowMainSelection]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (!allowReorder) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, [allowReorder]);

  const handleImageDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (!allowReorder || draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newImages = [...images];
    const draggedImage = newImages[draggedIndex];
    
    newImages.splice(draggedIndex, 1);
    newImages.splice(dropIndex, 0, draggedImage);
    
    // Update main image if first position changed
    if (dropIndex === 0 || draggedIndex === 0) {
      newImages.forEach((img, i) => {
        img.isMain = i === 0;
      });
    }
    
    onImagesChange(newImages);
    setDraggedIndex(null);
  }, [allowReorder, draggedIndex, images, onImagesChange]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer ${
          isDragOver
            ? 'border-purple-500 bg-purple-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${images.length >= maxImages ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => {
          if (images.length < maxImages) {
            fileInputRef.current?.click();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={IMAGE_CONFIG.ALLOWED_TYPES.join(',')}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          disabled={images.length >= maxImages}
        />
        
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-900 mb-2">
          {images.length >= maxImages 
            ? `Maximum ${maxImages} images reached`
            : 'Click to upload or drag and drop'
          }
        </p>
        <p className="text-sm text-gray-500">
          {IMAGE_CONFIG.ALLOWED_TYPES.join(', ').toUpperCase()} up to {IMAGE_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB each
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Recommended: 800x800px minimum, square aspect ratio
        </p>
      </div>

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              Uploaded Images ({images.length}/{maxImages})
            </p>
            {allowReorder && (
              <p className="text-xs text-gray-500">
                Drag to reorder • First image is the main product image
              </p>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <AnimatePresence>
              {images.map((image, index) => (
                <motion.div
                  key={image.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  draggable={allowReorder}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleImageDrop(e, index)}
                  className={`relative group border-2 rounded-lg overflow-hidden transition-all duration-200 ${
                    draggedIndex === index 
                      ? 'opacity-50 scale-95 border-purple-500' 
                      : 'border-gray-200 hover:border-gray-300'
                  } ${
                    image.isMain || index === 0
                      ? 'ring-2 ring-purple-500 border-purple-500'
                      : ''
                  } ${allowReorder ? 'cursor-move' : ''}`}
                >
                  {/* Drag Handle */}
                  {allowReorder && (
                    <div className="absolute top-2 left-2 z-10 bg-black bg-opacity-50 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical className="w-3 h-3 text-white" />
                    </div>
                  )}

                  {/* Main Badge */}
                  {(image.isMain || index === 0) && (
                    <div className="absolute top-2 left-8 z-10 bg-purple-600 text-white text-xs px-2 py-1 rounded-full flex items-center">
                      <Star className="w-3 h-3 mr-1" />
                      Main
                    </div>
                  )}
                  
                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 z-10 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>

                  {/* Set Main Button */}
                  {allowMainSelection && !image.isMain && index !== 0 && (
                    <button
                      type="button"
                      onClick={() => setMainImage(index)}
                      className="absolute bottom-2 left-2 z-10 bg-purple-600 text-white text-xs px-2 py-1 rounded hover:bg-purple-700 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Set Main
                    </button>
                  )}

                  {/* Image */}
                  <img
                    src={image.preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-32 object-cover"
                  />

                  {/* Upload Progress */}
                  {image.uploadProgress !== undefined && image.uploadProgress < 100 && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <div className="text-white text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-2" />
                        <p className="text-xs">{image.uploadProgress}%</p>
                      </div>
                    </div>
                  )}

                  {/* Error State */}
                  {image.error && (
                    <div className="absolute inset-0 bg-red-500 bg-opacity-90 flex items-center justify-center">
                      <div className="text-white text-center">
                        <AlertCircle className="w-6 h-6 mx-auto mb-1" />
                        <p className="text-xs">Upload failed</p>
                      </div>
                    </div>
                  )}

                  {/* Success State */}
                  {image.uploadProgress === 100 && !image.error && (
                    <div className="absolute top-2 right-8 z-10 bg-green-600 text-white rounded-full p-1">
                      <CheckCircle className="w-3 h-3" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Guidelines */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Image Guidelines</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• Use high-quality images with good lighting</li>
          <li>• Square aspect ratio (1:1) works best</li>
          <li>• Minimum 800x800px for best quality</li>
          <li>• Show product from multiple angles</li>
          <li>• First image will be used as the main product image</li>
          <li>• Images will be automatically optimized for web</li>
        </ul>
      </div>
    </div>
  );
};