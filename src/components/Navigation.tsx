import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  ShoppingBag, 
  User, 
  Heart, 
  Menu, 
  X,
  Home,
  Settings
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import { useModalStore } from '../stores/modalStore';

export const Navigation: React.FC = () => {
  const location = useLocation();
  const { user, isAdmin } = useAuthStore();
  const { getTotalItems } = useCartStore();
  const { openAuth, openCart } = useModalStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const cartItemCount = getTotalItems();

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/search', icon: Search, label: 'Search' },
    { path: '/wishlist', icon: Heart, label: 'Wishlist', requireAuth: true },
    { path: '/profile', icon: User, label: 'Profile', requireAuth: true },
  ];

  if (isAdmin) {
    navItems.push({ path: '/admin', icon: Settings, label: 'Admin', requireAuth: true });
  }

  const handleAuthAction = () => {
    if (user) {
      setIsMobileMenuOpen(false);
    } else {
      openAuth();
      setIsMobileMenuOpen(false);
    }
  };

  const handleCartOpen = () => {
    openCart();
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 lg:block hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">ShopFlow</span>
            </Link>

            {/* Navigation Items */}
            <div className="flex items-center space-x-6">
              {navItems.map(({ path, icon: Icon, label, requireAuth }) => {
                if (requireAuth && !user) return null;
                
                const isActive = location.pathname === path;
                
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{label}</span>
                  </Link>
                );
              })}

              {/* Cart */}
              <button
                onClick={handleCartOpen}
                className="relative p-2 text-white/70 hover:text-white transition-colors"
              >
                <ShoppingBag className="w-6 h-6" />
                {cartItemCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    {cartItemCount}
                  </motion.span>
                )}
              </button>

              {/* Auth Button */}
              {!user ? (
                <button
                  onClick={openAuth}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  Sign In
                </button>
              ) : (
                <div className="flex items-center space-x-2 text-white">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="font-medium">
                    {user.email?.split('@')[0]}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-t border-white/10 lg:hidden">
        <div className="flex items-center justify-around py-2">
          {navItems.slice(0, 4).map(({ path, icon: Icon, requireAuth }) => {
            if (requireAuth && !user) return null;
            
            const isActive = location.pathname === path;
            
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center space-y-1 p-2 transition-colors ${
                  isActive ? 'text-purple-400' : 'text-white/70'
                }`}
              >
                <Icon className="w-6 h-6" />
              </Link>
            );
          })}

          {/* Cart */}
          <button
            onClick={handleCartOpen}
            className="relative flex flex-col items-center space-y-1 p-2 text-white/70"
          >
            <ShoppingBag className="w-6 h-6" />
            {cartItemCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
              >
                {cartItemCount}
              </motion.span>
            )}
          </button>

          {/* Menu */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center space-y-1 p-2 text-white/70"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 lg:hidden"
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
            
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute right-0 top-0 h-full w-80 bg-gray-900 shadow-xl"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-xl font-bold text-white">Menu</h2>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-white/70 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {user ? (
                  <div className="flex items-center space-x-3 p-4 bg-white/5 rounded-lg">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {user.email?.split('@')[0]}
                      </p>
                      <p className="text-white/60 text-sm">{user.email}</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleAuthAction}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-medium"
                  >
                    Sign In
                  </button>
                )}

                <div className="space-y-2">
                  {navItems.map(({ path, icon: Icon, label, requireAuth }) => {
                    if (requireAuth && !user) return null;
                    
                    return (
                      <Link
                        key={path}
                        to={path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center space-x-3 p-3 text-white hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <Icon className="w-5 h-5" />
                        <span>{label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};