import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, X, Grid, List, Heart, ShoppingCart } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { supabase, trackProductInteraction } from '../lib/supabase';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  price: number;
  compare_price?: number;
  short_description?: string;
  product_media: Array<{
    url: string;
    media_type: 'image' | 'video';
  }>;
  categories?: {
    name: string;
  };
}

interface Category {
  id: string;
  name: string;
}

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadProducts();
    updateURL();
  }, [searchTerm, selectedCategory, sortBy]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          compare_price,
          short_description,
          product_media (
            url,
            media_type,
            display_order
          ),
          categories (
            name
          )
        `)
        .eq('is_active', true);

      // Apply search filter
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,short_description.ilike.%${searchTerm}%`);
      }

      // Apply category filter
      if (selectedCategory) {
        query = query.eq('category_id', selectedCategory);
      }

      // Apply sorting
      switch (sortBy) {
        case 'price-low':
          query = query.order('price', { ascending: true });
          break;
        case 'price-high':
          query = query.order('price', { ascending: false });
          break;
        case 'name':
          query = query.order('name', { ascending: true });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;

      const formattedProducts = data?.map(product => ({
        ...product,
        product_media: product.product_media?.sort((a, b) => a.display_order - b.display_order) || [],
      })) || [];

      setProducts(formattedProducts);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const updateURL = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('q', searchTerm);
    if (selectedCategory) params.set('category', selectedCategory);
    if (sortBy !== 'newest') params.set('sort', sortBy);
    setSearchParams(params, { replace: true });
  };

  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Apply price range filter
    if (priceRange.min || priceRange.max) {
      filtered = filtered.filter(product => {
        const price = product.price;
        const min = priceRange.min ? parseFloat(priceRange.min) : 0;
        const max = priceRange.max ? parseFloat(priceRange.max) : Infinity;
        return price >= min && price <= max;
      });
    }

    return filtered;
  }, [products, priceRange]);

  const handleAddToCart = async (product: Product) => {
    try {
      await addItem(product);
      toast.success('Added to cart!');
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Failed to add to cart');
    }
  };

  const handleToggleWishlist = async (product: Product) => {
    if (!user) {
      toast.error('Please sign in to save products');
      return;
    }

    try {
      // Check if already in wishlist
      const { data: existing } = await supabase
        .from('wishlists')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle();

      if (existing) {
        // Remove from wishlist
        await supabase
          .from('wishlists')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id);
        toast.success('Removed from wishlist');
      } else {
        // Add to wishlist
        await supabase
          .from('wishlists')
          .insert({
            user_id: user.id,
            product_id: product.id,
          });
        await trackProductInteraction(product.id, 'saves');
        toast.success('Added to wishlist');
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
      toast.error('Failed to update wishlist');
    }
  };

  return (
    <div className="min-h-screen bg-black pt-20 pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Search Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-12 pr-4 py-3 bg-gray-900 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-900 border border-white/10 rounded-lg text-white hover:bg-gray-800 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </button>

              <div className="flex items-center space-x-2 bg-gray-900 border border-white/10 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 p-4 bg-gray-900 border border-white/10 rounded-xl"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Category Filter */}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Category
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="">All Categories</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sort By */}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Sort By
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="newest">Newest</option>
                      <option value="price-low">Price: Low to High</option>
                      <option value="price-high">Price: High to Low</option>
                      <option value="name">Name: A to Z</option>
                    </select>
                  </div>

                  {/* Price Range */}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Price Range
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        placeholder="Min"
                        value={priceRange.min}
                        onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                      />
                      <input
                        type="number"
                        placeholder="Max"
                        value={priceRange.max}
                        onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Clear Filters */}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategory('');
                      setSortBy('newest');
                      setPriceRange({ min: '', max: '' });
                    }}
                    className="px-4 py-2 text-white/60 hover:text-white transition-colors"
                  >
                    Clear All Filters
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Info */}
          <div className="mt-4 text-white/60">
            {isLoading ? (
              'Searching...'
            ) : (
              <>
                {filteredProducts.length} {filteredProducts.length === 1 ? 'result' : 'results'}
                {searchTerm && ` for "${searchTerm}"`}
              </>
            )}
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-white mb-2">No products found</h2>
            <p className="text-white/60">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
          }>
            <AnimatePresence>
              {filteredProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-gray-900 rounded-2xl overflow-hidden border border-white/10 hover:border-white/20 transition-all duration-300 ${
                    viewMode === 'list' ? 'flex items-center p-4' : ''
                  }`}
                >
                  {/* Product Image */}
                  <div className={`relative bg-gray-800 ${
                    viewMode === 'list' 
                      ? 'w-24 h-24 rounded-lg mr-4 flex-shrink-0' 
                      : 'aspect-square'
                  } overflow-hidden`}>
                    {product.product_media?.[0] && (
                      <img
                        src={product.product_media[0].url}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    )}
                    
                    {viewMode === 'grid' && (
                      <button
                        onClick={() => handleToggleWishlist(product)}
                        className="absolute top-3 right-3 p-2 bg-black/50 backdrop-blur-sm rounded-full text-white/60 hover:text-red-400 transition-colors"
                      >
                        <Heart className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className={viewMode === 'list' ? 'flex-1' : 'p-4'}>
                    <h3 className={`font-semibold text-white mb-2 ${
                      viewMode === 'list' ? 'text-lg' : 'text-lg line-clamp-2'
                    }`}>
                      {product.name}
                    </h3>
                    
                    {product.short_description && (
                      <p className="text-white/60 text-sm mb-3 line-clamp-2">
                        {product.short_description}
                      </p>
                    )}

                    <div className={`flex items-center ${
                      viewMode === 'list' ? 'justify-between' : 'justify-between mb-4'
                    }`}>
                      <div className="flex items-center space-x-2">
                        <span className="text-xl font-bold text-white">
                          ${product.price.toFixed(2)}
                        </span>
                        {product.compare_price && product.compare_price > product.price && (
                          <span className="text-sm text-white/60 line-through">
                            ${product.compare_price.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {product.categories && (
                        <span className="text-xs bg-white/10 text-white/70 px-2 py-1 rounded-full">
                          {product.categories.name}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className={`flex space-x-2 ${viewMode === 'list' ? 'mt-4' : ''}`}>
                      <button
                        onClick={() => handleAddToCart(product)}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center"
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Add to Cart
                      </button>
                      
                      {viewMode === 'list' && (
                        <button
                          onClick={() => handleToggleWishlist(product)}
                          className="p-2 text-white/60 border border-white/20 rounded-lg hover:bg-white/5 transition-colors"
                        >
                          <Heart className="w-4 h-4" />
                        </button>
                      )}
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