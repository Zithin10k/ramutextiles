import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ShoppingCart, Trash2, Share2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import { supabase, trackProductInteraction } from '../lib/supabase';
import toast from 'react-hot-toast';

interface WishlistItem {
  id: string;
  product_id: string;
  created_at: string;
  products: {
    id: string;
    name: string;
    price: number;
    compare_price?: number;
    short_description?: string;
    product_media: Array<{
      url: string;
      media_type: 'image' | 'video';
    }>;
  };
}

export const WishlistPage: React.FC = () => {
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadWishlist();
    }
  }, [user]);

  const loadWishlist = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('wishlists')
        .select(`
          id,
          product_id,
          created_at,
          products (
            id,
            name,
            price,
            compare_price,
            short_description,
            product_media (
              url,
              media_type,
              display_order
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setWishlistItems(data || []);
    } catch (error) {
      console.error('Error loading wishlist:', error);
      toast.error('Failed to load wishlist');
    } finally {
      setIsLoading(false);
    }
  };

  const removeFromWishlist = async (productId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);

      if (error) throw error;

      setWishlistItems(prev => prev.filter(item => item.product_id !== productId));
      toast.success('Removed from wishlist');
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      toast.error('Failed to remove from wishlist');
    }
  };

  const handleAddToCart = async (product: any) => {
    try {
      await addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        media: product.product_media,
      });
      toast.success('Added to cart!');
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Failed to add to cart');
    }
  };

  const handleShare = async (product: any) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: product.short_description,
          url: window.location.href,
        });
        await trackProductInteraction(product.id, 'shares');
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
      await trackProductInteraction(product.id, 'shares');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black pt-20 pb-24 lg:pb-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-20 pb-24 lg:pb-8">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white mb-2">Your Wishlist</h1>
          <p className="text-white/60">
            {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} saved
          </p>
        </motion.div>

        {wishlistItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Heart className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-white mb-2">Your wishlist is empty</h2>
            <p className="text-white/60 mb-6">Save products you love to find them easily later</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {wishlistItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gray-900 rounded-2xl overflow-hidden border border-white/10 hover:border-white/20 transition-all duration-300"
                >
                  {/* Product Image */}
                  <div className="relative aspect-square overflow-hidden bg-gray-800">
                    {item.products.product_media?.[0] && (
                      <img
                        src={item.products.product_media[0].url}
                        alt={item.products.name}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    )}
                    
                    {/* Remove from Wishlist */}
                    <button
                      onClick={() => removeFromWishlist(item.product_id)}
                      className="absolute top-3 right-3 p-2 bg-black/50 backdrop-blur-sm rounded-full text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Heart className="w-5 h-5 fill-current" />
                    </button>
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">
                      {item.products.name}
                    </h3>
                    
                    {item.products.short_description && (
                      <p className="text-white/60 text-sm mb-3 line-clamp-2">
                        {item.products.short_description}
                      </p>
                    )}

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-xl font-bold text-white">
                          ${item.products.price.toFixed(2)}
                        </span>
                        {item.products.compare_price && item.products.compare_price > item.products.price && (
                          <span className="text-sm text-white/60 line-through">
                            ${item.products.compare_price.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleAddToCart(item.products)}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center"
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Add to Cart
                      </button>
                      
                      <button
                        onClick={() => handleShare(item.products)}
                        className="p-2 text-white/60 border border-white/20 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};