import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  ShoppingCart, 
  Users, 
  TrendingUp, 
  Eye,
  Heart,
  Share2,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Stats {
  totalProducts: number;
  totalOrders: number;
  totalUsers: number;
  totalRevenue: number;
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  totalSaves: number;
}

interface RecentActivity {
  id: string;
  type: 'order' | 'product' | 'user';
  title: string;
  description: string;
  timestamp: string;
  value?: number;
}

export const AdminOverviewPage: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalRevenue: 0,
    totalViews: 0,
    totalLikes: 0,
    totalShares: 0,
    totalSaves: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setError(null);
      console.log('Loading dashboard data...');

      // Load basic stats with error handling for each query
      const statsPromises = [
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('total_amount').eq('payment_status', 'paid'),
        supabase.from('product_analytics').select('views, likes, shares, saves')
      ];

      const results = await Promise.allSettled(statsPromises);
      
      // Process results with fallbacks
      const [
        productsResult,
        ordersResult,
        usersResult,
        paidOrdersResult,
        analyticsResult
      ] = results;

      let totalProducts = 0;
      let totalOrders = 0;
      let totalUsers = 0;
      let totalRevenue = 0;
      let analyticsStats = { totalViews: 0, totalLikes: 0, totalShares: 0, totalSaves: 0 };

      if (productsResult.status === 'fulfilled') {
        totalProducts = productsResult.value.count || 0;
      } else {
        console.error('Error loading products count:', productsResult.reason);
      }

      if (ordersResult.status === 'fulfilled') {
        totalOrders = ordersResult.value.count || 0;
      } else {
        console.error('Error loading orders count:', ordersResult.reason);
      }

      if (usersResult.status === 'fulfilled') {
        totalUsers = usersResult.value.count || 0;
      } else {
        console.error('Error loading users count:', usersResult.reason);
      }

      if (paidOrdersResult.status === 'fulfilled' && paidOrdersResult.value.data) {
        totalRevenue = paidOrdersResult.value.data.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      } else {
        console.error('Error loading revenue:', paidOrdersResult.status === 'rejected' ? paidOrdersResult.reason : 'No data');
      }

      if (analyticsResult.status === 'fulfilled' && analyticsResult.value.data) {
        analyticsStats = analyticsResult.value.data.reduce((acc, item) => ({
          totalViews: acc.totalViews + (item.views || 0),
          totalLikes: acc.totalLikes + (item.likes || 0),
          totalShares: acc.totalShares + (item.shares || 0),
          totalSaves: acc.totalSaves + (item.saves || 0),
        }), { totalViews: 0, totalLikes: 0, totalShares: 0, totalSaves: 0 });
      } else {
        console.error('Error loading analytics:', analyticsResult.status === 'rejected' ? analyticsResult.reason : 'No data');
      }

      setStats({
        totalProducts,
        totalOrders,
        totalUsers,
        totalRevenue,
        ...analyticsStats,
      });

      // Load recent activity with simplified queries
      const activity: RecentActivity[] = [];

      try {
        const { data: recentOrders } = await supabase
          .from('orders')
          .select('id, order_number, total_amount, created_at, user_id')
          .order('created_at', { ascending: false })
          .limit(5);

        recentOrders?.forEach(order => {
          activity.push({
            id: order.id,
            type: 'order',
            title: `Order ${order.order_number}`,
            description: `New order from ${order.user_id ? 'Registered User' : 'Guest'}`,
            timestamp: order.created_at,
            value: order.total_amount,
          });
        });
      } catch (error) {
        console.error('Error loading recent orders:', error);
      }

      try {
        const { data: recentProducts } = await supabase
          .from('products')
          .select('id, name, price, created_at')
          .order('created_at', { ascending: false })
          .limit(3);

        recentProducts?.forEach(product => {
          activity.push({
            id: product.id,
            type: 'product',
            title: product.name,
            description: `New product added - ₹${product.price}`,
            timestamp: product.created_at,
          });
        });
      } catch (error) {
        console.error('Error loading recent products:', error);
      }

      // Sort by timestamp
      activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivity(activity.slice(0, 8));

      console.log('Dashboard data loaded successfully');
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const statCards = [
    {
      title: 'Total Products',
      value: stats.totalProducts,
      icon: Package,
      color: 'bg-blue-500',
      format: (val: number) => val.toString(),
    },
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      icon: ShoppingCart,
      color: 'bg-green-500',
      format: (val: number) => val.toString(),
    },
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-purple-500',
      format: (val: number) => val.toString(),
    },
    {
      title: 'Total Revenue',
      value: stats.totalRevenue,
      icon: DollarSign,
      color: 'bg-yellow-500',
      format: formatCurrency,
    },
    {
      title: 'Total Views',
      value: stats.totalViews,
      icon: Eye,
      color: 'bg-indigo-500',
      format: formatNumber,
    },
    {
      title: 'Total Likes',
      value: stats.totalLikes,
      icon: Heart,
      color: 'bg-red-500',
      format: formatNumber,
    },
    {
      title: 'Total Shares',
      value: stats.totalShares,
      icon: Share2,
      color: 'bg-cyan-500',
      format: formatNumber,
    },
    {
      title: 'Total Saves',
      value: stats.totalSaves,
      icon: TrendingUp,
      color: 'bg-orange-500',
      format: formatNumber,
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadDashboardData}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-600 mt-2">Welcome to your e-commerce admin panel</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {card.format(card.value)}
                </p>
              </div>
              <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
        </div>
        
        <div className="divide-y divide-gray-200">
          {recentActivity.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No recent activity
            </div>
          ) : (
            recentActivity.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      activity.type === 'order' ? 'bg-green-100 text-green-600' :
                      activity.type === 'product' ? 'bg-blue-100 text-blue-600' :
                      'bg-purple-100 text-purple-600'
                    }`}>
                      {activity.type === 'order' && <ShoppingCart className="w-5 h-5" />}
                      {activity.type === 'product' && <Package className="w-5 h-5" />}
                      {activity.type === 'user' && <Users className="w-5 h-5" />}
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-900">{activity.title}</p>
                      <p className="text-sm text-gray-600">{activity.description}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {activity.value && (
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(activity.value)}
                      </p>
                    )}
                    <p className="text-sm text-gray-500">
                      {getRelativeTime(activity.timestamp)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};