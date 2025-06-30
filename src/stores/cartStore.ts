import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, trackProductInteraction } from '../lib/supabase';
import { useAuthStore } from './authStore';

export interface CartItem {
  id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  variant_id?: string;
  variant_name?: string;
}

interface CartState {
  items: CartItem[];
  isLoading: boolean;
  addItem: (product: any, quantity?: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  loadCart: () => Promise<void>;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,

      addItem: async (product: any, quantity = 1) => {
        const { user } = useAuthStore.getState();
        const existingItem = get().items.find(item => item.product_id === product.id);
        
        if (existingItem) {
          await get().updateQuantity(product.id, existingItem.quantity + quantity);
        } else {
          const newItem: CartItem = {
            id: `${product.id}-${Date.now()}`,
            product_id: product.id,
            name: product.name,
            price: product.price,
            quantity,
            image_url: product.media?.[0]?.url,
          };
          
          set({ items: [...get().items, newItem] });
          
          // Track analytics
          await trackProductInteraction(product.id, 'cart_adds');
          
          // Sync with database if user is logged in
          if (user) {
            try {
              const { data: cart } = await supabase
                .from('shopping_carts')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();
              
              let cartId = cart?.id;
              
              if (!cartId) {
                const { data: newCart } = await supabase
                  .from('shopping_carts')
                  .insert({ user_id: user.id })
                  .select('id')
                  .single();
                cartId = newCart?.id;
              }
              
              if (cartId) {
                await supabase.from('cart_items').insert({
                  cart_id: cartId,
                  product_id: product.id,
                  quantity,
                  unit_price: product.price,
                });
              }
            } catch (error) {
              console.error('Error syncing cart:', error);
            }
          }
        }
      },

      removeItem: async (productId: string) => {
        const { user } = useAuthStore.getState();
        
        set({ items: get().items.filter(item => item.product_id !== productId) });
        
        // Sync with database if user is logged in
        if (user) {
          try {
            const { data: cart } = await supabase
              .from('shopping_carts')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();
            
            if (cart?.id) {
              await supabase
                .from('cart_items')
                .delete()
                .eq('cart_id', cart.id)
                .eq('product_id', productId);
            }
          } catch (error) {
            console.error('Error removing item from cart:', error);
          }
        }
      },

      updateQuantity: async (productId: string, quantity: number) => {
        const { user } = useAuthStore.getState();
        
        if (quantity <= 0) {
          await get().removeItem(productId);
          return;
        }
        
        set({
          items: get().items.map(item =>
            item.product_id === productId ? { ...item, quantity } : item
          ),
        });
        
        // Sync with database if user is logged in
        if (user) {
          try {
            const { data: cart } = await supabase
              .from('shopping_carts')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();
            
            if (cart?.id) {
              await supabase
                .from('cart_items')
                .update({ quantity })
                .eq('cart_id', cart.id)
                .eq('product_id', productId);
            }
          } catch (error) {
            console.error('Error updating cart item:', error);
          }
        }
      },

      clearCart: async () => {
        const { user } = useAuthStore.getState();
        
        set({ items: [] });
        
        // Sync with database if user is logged in
        if (user) {
          try {
            const { data: cart } = await supabase
              .from('shopping_carts')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();
            
            if (cart?.id) {
              await supabase
                .from('cart_items')
                .delete()
                .eq('cart_id', cart.id);
            }
          } catch (error) {
            console.error('Error clearing cart:', error);
          }
        }
      },

      loadCart: async () => {
        const { user } = useAuthStore.getState();
        
        if (!user) return;
        
        set({ isLoading: true });
        
        try {
          const { data: cart } = await supabase
            .from('shopping_carts')
            .select(`
              id,
              cart_items (
                id,
                product_id,
                quantity,
                unit_price,
                products (
                  name,
                  product_media (
                    url,
                    is_primary
                  )
                )
              )
            `)
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (cart?.cart_items) {
            const items: CartItem[] = cart.cart_items.map((item: any) => ({
              id: item.id,
              product_id: item.product_id,
              name: item.products.name,
              price: item.unit_price,
              quantity: item.quantity,
              image_url: item.products.product_media?.find((m: any) => m.is_primary)?.url,
            }));
            
            set({ items });
          }
        } catch (error) {
          console.error('Error loading cart:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getTotalPrice: () => {
        return get().items.reduce((total, item) => total + (item.price * item.quantity), 0);
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);