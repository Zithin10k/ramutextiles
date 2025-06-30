import React, { useState, useEffect, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Bookmark, Share2, ShoppingCart, Play, Pause } from 'lucide-react';
import { supabase, trackProductInteraction } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  price: number;
  compare_price?: number;
  short_description?: string;
  media: Array<{
    id: string;
    media_type: 'image' | 'video';
    url: string;
    thumbnail_url?: string;
  }>;
  categories?: {
    name: string;
  };
}

interface ProductCardProps {
  product: Product;
  isActive: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, isActive }) => {
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);

  const primaryMedia = product.media?.[0];
  const isVideo = primaryMedia?.media_type === 'video';

  useEffect(() => {
    if (isActive && isVideo && videoRef) {
      videoRef.play();
      setIsPlaying(true);
    } else if (videoRef) {
      videoRef.pause();
      setIsPlaying(false);
    }
  }, [isActive, isVideo, videoRef]);

  // Check user interactions on mount
  useEffect(() => {
    const checkUserInteractions = async () => {
      if (!user) return;

      try {
        // Check if user has liked this product
        const { data: likeData } = await supabase
          .from('user_interactions')
          .select('id')
          .eq('user_id', user.id)
          .eq('product_id', product.id)
          .eq('interaction_type', 'like')
          .maybeSingle();

        setIsLiked(!!likeData);

        // Check if user has saved this product
        const { data: saveData } = await supabase
          .from('wishlists')
          .select('id')
          .eq('user_id', user.id)
          .eq('product_id', product.id)
          .maybeSingle();

        setIsSaved(!!saveData);
      } catch (error) {
        // Ignore errors for checking interactions
        console.debug('Error checking user interactions:', error);
      }
    };

    checkUserInteractions();
  }, [user, product.id]);

  const handleLike = async () => {
    if (!user) {
      toast.error('Please sign in to like products');
      return;
    }

    try {
      if (isLiked) {
        await supabase
          .from('user_interactions')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id)
          .eq('interaction_type', 'like');
      } else {
        await supabase
          .from('user_interactions')
          .insert({
            user_id: user.id,
            product_id: product.id,
            interaction_type: 'like',
          });
        // Track analytics (non-blocking)
        trackProductInteraction(product.id, 'likes');
      }
      setIsLiked(!isLiked);
    } catch (error) {
      console.error('Error handling like:', error);
      toast.error('Failed to update like status');
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('Please sign in to save products');
      return;
    }

    try {
      if (isSaved) {
        await supabase
          .from('wishlists')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id);
      } else {
        await supabase
          .from('wishlists')
          .insert({
            user_id: user.id,
            product_id: product.id,
          });
        // Track analytics (non-blocking)
        trackProductInteraction(product.id, 'saves');
      }
      setIsSaved(!isSaved);
    } catch (error) {
      console.error('Error handling save:', error);
      toast.error('Failed to update save status');
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: product.short_description,
          url: window.location.href,
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      }
      // Track analytics (non-blocking)
      trackProductInteraction(product.id, 'shares');
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error('Failed to share product');
    }
  };

  const handleAddToCart = async () => {
    try {
      await addItem(product);
      toast.success('Added to cart!');
      // Track analytics (non-blocking)
      trackProductInteraction(product.id, 'cart_adds');
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Failed to add to cart');
    }
  };

  const toggleVideoPlay = () => {
    if (!videoRef) return;
    
    if (isPlaying) {
      videoRef.pause();
      setIsPlaying(false);
    } else {
      videoRef.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden">
      {/* Media Container */}
      <div className="absolute inset-0">
        {isVideo ? (
          <>
            <video
              ref={setVideoRef}
              className="w-full h-full object-cover"
              loop
              muted
              playsInline
              poster={primaryMedia?.thumbnail_url}
            >
              <source src={primaryMedia?.url} type="video/mp4" />
            </video>
            
            {/* Video Play/Pause Overlay */}
            <button
              onClick={toggleVideoPlay}
              className="absolute inset-0 flex items-center justify-center bg-transparent"
            >
              <AnimatePresence>
                {!isPlaying && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="bg-black/50 rounded-full p-4"
                  >
                    <Play className="w-12 h-12 text-white" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </>
        ) : (
          <img
            src={primaryMedia?.url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/30" />

      {/* Content */}
      <div className="absolute inset-0 flex">
        {/* Left Side - Product Info */}
        <div className="flex-1 flex flex-col justify-end p-6 pb-32">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            {product.categories && (
              <span className="inline-block bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-sm text-white font-medium">
                {product.categories.name}
              </span>
            )}
            
            <h2 className="text-2xl font-bold text-white leading-tight">
              {product.name}
            </h2>
            
            {product.short_description && (
              <p className="text-white/90 text-base leading-relaxed">
                {product.short_description}
              </p>
            )}
            
            <div className="flex items-center space-x-3">
              <span className="text-3xl font-bold text-white">
                ${product.price.toFixed(2)}
              </span>
              {product.compare_price && product.compare_price > product.price && (
                <span className="text-xl text-white/60 line-through">
                  ${product.compare_price.toFixed(2)}
                </span>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Side - Actions */}
        <div className="w-20 flex flex-col items-center justify-end pb-32 space-y-6">
          <motion.button
            onClick={handleLike}
            whileTap={{ scale: 0.9 }}
            className="relative group"
          >
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 transition-all duration-200 group-hover:bg-white/30">
              <Heart 
                className={`w-6 h-6 transition-colors ${
                  isLiked ? 'text-red-500 fill-current' : 'text-white'
                }`} 
              />
            </div>
          </motion.button>

          <motion.button
            onClick={handleSave}
            whileTap={{ scale: 0.9 }}
            className="relative group"
          >
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 transition-all duration-200 group-hover:bg-white/30">
              <Bookmark 
                className={`w-6 h-6 transition-colors ${
                  isSaved ? 'text-yellow-500 fill-current' : 'text-white'
                }`} 
              />
            </div>
          </motion.button>

          <motion.button
            onClick={handleShare}
            whileTap={{ scale: 0.9 }}
            className="relative group"
          >
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 transition-all duration-200 group-hover:bg-white/30">
              <Share2 className="w-6 h-6 text-white" />
            </div>
          </motion.button>

          <motion.button
            onClick={handleAddToCart}
            whileTap={{ scale: 0.9 }}
            className="relative group"
          >
            <div className="bg-purple-600 backdrop-blur-sm rounded-full p-4 transition-all duration-200 group-hover:bg-purple-500">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export const ProductFeed: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
  });

  const loadProducts = useCallback(async (offset = 0) => {
    try {
      setError(null);
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          compare_price,
          short_description,
          product_media (
            id,
            media_type,
            url,
            thumbnail_url,
            display_order
          ),
          categories (
            name
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + 9);

      if (error) throw error;

      const formattedProducts = data?.map(product => ({
        ...product,
        media: product.product_media?.sort((a, b) => a.display_order - b.display_order) || [],
      })) || [];

      if (offset === 0) {
        setProducts(formattedProducts);
        
        // Track view for first product (non-blocking)
        if (formattedProducts.length > 0) {
          trackProductInteraction(formattedProducts[0].id, 'views');
        }
      } else {
        setProducts(prev => [...prev, ...formattedProducts]);
      }

      setHasMore(formattedProducts.length === 10);
    } catch (error) {
      console.error('Error loading products:', error);
      setError('Failed to load products. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      loadProducts(products.length);
    }
  }, [inView, hasMore, isLoading, products.length, loadProducts]);

  const handleScroll = useCallback(async (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY;
    
    if (delta > 0 && currentIndex < products.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      
      // Track view for new product (non-blocking)
      if (products[newIndex]) {
        trackProductInteraction(products[newIndex].id, 'views');
      }
    } else if (delta < 0 && currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      
      // Track view for new product (non-blocking)
      if (products[newIndex]) {
        trackProductInteraction(products[newIndex].id, 'views');
      }
    }
  }, [currentIndex, products]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touchStartY = e.touches[0].clientY;
    
    const handleTouchEnd = async (endEvent: TouchEvent) => {
      const touchEndY = endEvent.changedTouches[0].clientY;
      const diff = touchStartY - touchEndY;
      
      if (Math.abs(diff) > 50) {
        if (diff > 0 && currentIndex < products.length - 1) {
          const newIndex = currentIndex + 1;
          setCurrentIndex(newIndex);
          
          // Track view for new product (non-blocking)
          if (products[newIndex]) {
            trackProductInteraction(products[newIndex].id, 'views');
          }
        } else if (diff < 0 && currentIndex > 0) {
          const newIndex = currentIndex - 1;
          setCurrentIndex(newIndex);
          
          // Track view for new product (non-blocking)
          if (products[newIndex]) {
            trackProductInteraction(products[newIndex].id, 'views');
          }
        }
      }
      
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchend', handleTouchEnd, { once: true });
  }, [currentIndex, products]);

  if (isLoading && products.length === 0) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-white">Loading products...</p>
        </div>
      </div>
    );
  }

  if (error && products.length === 0) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white p-6">
          <h2 className="text-xl font-bold mb-4">Unable to load products</h2>
          <p className="text-white/80 mb-6">{error}</p>
          <button
            onClick={() => {
              setIsLoading(true);
              loadProducts();
            }}
            className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white p-6">
          <h2 className="text-xl font-bold mb-4">No products found</h2>
          <p className="text-white/80">Check back later for new products!</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative h-screen overflow-hidden"
      onWheel={handleScroll}
      onTouchStart={handleTouchStart}
    >
      <AnimatePresence mode="wait">
        {products.map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: index > currentIndex ? '100%' : '-100%' }}
            animate={{ 
              opacity: index === currentIndex ? 1 : 0,
              y: index === currentIndex ? '0%' : index > currentIndex ? '100%' : '-100%'
            }}
            exit={{ 
              opacity: 0,
              y: index > currentIndex ? '100%' : '-100%'
            }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className={`absolute inset-0 ${index === currentIndex ? 'z-10' : 'z-0'}`}
          >
            <ProductCard 
              product={product} 
              isActive={index === currentIndex}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Load More Trigger */}
      {currentIndex > products.length - 3 && (
        <div ref={loadMoreRef} className="absolute bottom-0 w-full h-1" />
      )}

      {/* Progress Indicators */}
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 space-y-2 z-20">
        {products.slice(Math.max(0, currentIndex - 2), currentIndex + 3).map((_, index) => {
          const actualIndex = Math.max(0, currentIndex - 2) + index;
          return (
            <div
              key={actualIndex}
              className={`w-1 h-8 rounded-full transition-all duration-300 ${
                actualIndex === currentIndex 
                  ? 'bg-white' 
                  : 'bg-white/30'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};