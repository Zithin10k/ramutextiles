import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { useModalStore } from '../stores/modalStore';
import toast from 'react-hot-toast';

export const CartModal: React.FC = () => {
  const { isCartOpen, closeCart } = useModalStore();
  const { items, updateQuantity, removeItem, clearCart, getTotalPrice } = useCartStore();

  const handleQuantityChange = async (productId: string, quantity: number) => {
    try {
      await updateQuantity(productId, quantity);
    } catch (error) {
      toast.error('Failed to update quantity');
    }
  };

  const handleRemoveItem = async (productId: string) => {
    try {
      await removeItem(productId);
      toast.success('Item removed from cart');
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const handleClearCart = async () => {
    try {
      await clearCart();
      toast.success('Cart cleared');
    } catch (error) {
      toast.error('Failed to clear cart');
    }
  };

  const totalPrice = getTotalPrice();

  return (
    <AnimatePresence>
      {isCartOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/50" onClick={closeCart} />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-2xl bg-gray-900 rounded-2xl shadow-2xl border border-white/10 max-h-[90vh] overflow-hidden"
          >
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center">
                  <ShoppingBag className="w-6 h-6 mr-2" />
                  Shopping Cart ({items.length})
                </h2>
                <button
                  onClick={closeCart}
                  className="p-2 text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-96">
              {items.length === 0 ? (
                <div className="p-8 text-center">
                  <ShoppingBag className="w-16 h-16 text-white/20 mx-auto mb-4" />
                  <p className="text-white/60 text-lg">Your cart is empty</p>
                  <p className="text-white/40 mt-2">Add some products to get started!</p>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  {items.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="flex items-center space-x-4 p-4 bg-white/5 rounded-lg"
                    >
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      )}
                      
                      <div className="flex-1">
                        <h3 className="text-white font-medium">{item.name}</h3>
                        <p className="text-white/60">${item.price.toFixed(2)}</p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleQuantityChange(item.product_id, item.quantity - 1)}
                          className="p-1 text-white/60 hover:text-white transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        
                        <span className="text-white font-medium w-8 text-center">
                          {item.quantity}
                        </span>
                        
                        <button
                          onClick={() => handleQuantityChange(item.product_id, item.quantity + 1)}
                          className="p-1 text-white/60 hover:text-white transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleRemoveItem(item.product_id)}
                        className="p-2 text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="p-6 border-t border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white/60">Total:</span>
                  <span className="text-2xl font-bold text-white">
                    ${totalPrice.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={handleClearCart}
                    className="flex-1 py-3 text-white/60 border border-white/20 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    Clear Cart
                  </button>
                  
                  <button
                    onClick={() => {
                      toast.success('Checkout coming soon!');
                      closeCart();
                    }}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                  >
                    Checkout
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};