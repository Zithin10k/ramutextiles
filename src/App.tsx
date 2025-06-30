import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import { useCartStore } from './stores/cartStore';

// Components
import { Navigation } from './components/Navigation';
import { ProductFeed } from './components/ProductFeed';
import { AuthModal } from './components/AuthModal';
import { CartModal } from './components/CartModal';
import { ProfilePage } from './pages/ProfilePage';
import { WishlistPage } from './pages/WishlistPage';
import { SearchPage } from './pages/SearchPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { LoadingSpinner } from './components/LoadingSpinner';

function App() {
  const { initialize, isLoading, user } = useAuthStore();
  const { loadCart } = useCartStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (user) {
      loadCart();
    }
  }, [user, loadCart]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-black">
        <Routes>
          {/* Main Product Feed */}
          <Route path="/" element={
            <>
              <Navigation />
              <ProductFeed />
            </>
          } />
          
          {/* Search */}
          <Route path="/search" element={
            <>
              <Navigation />
              <SearchPage />
            </>
          } />
          
          {/* User Profile */}
          <Route path="/profile" element={
            user ? (
              <>
                <Navigation />
                <ProfilePage />
              </>
            ) : (
              <Navigate to="/" replace />
            )
          } />
          
          {/* Wishlist */}
          <Route path="/wishlist" element={
            user ? (
              <>
                <Navigation />
                <WishlistPage />
              </>
            ) : (
              <Navigate to="/" replace />
            )
          } />
          
          {/* Admin Dashboard */}
          <Route path="/admin/*" element={<AdminDashboard />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        
        {/* Global Modals */}
        <AuthModal />
        <CartModal />
        
        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1F2937',
              color: '#F9FAFB',
              border: '1px solid #374151',
            },
            success: {
              iconTheme: {
                primary: '#10B981',
                secondary: '#F9FAFB',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#F9FAFB',
              },
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App;