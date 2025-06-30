import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Eye, 
  Heart, 
  Share2, 
  ShoppingCart, 
  DollarSign,
  Users,
  Package,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AnalyticsData {
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  totalSaves: number;
  totalCartAdds: number;
  totalPurchases: number;
  totalRevenue: number;
  totalUsers: number;
  totalProducts: number;
  conversionRate: number;
}

interface ProductAnalytics {
  product_id: string;
  product_name: string;
  views: number;
  likes: number;
  shares: number;
  saves: number;
  cart_adds: number;
  purchases: number;
  revenue: number;
  conversion_rate: number;
}

interface DailyStats {
  date: string;
  views: number;
  likes: number;
  shares: number;
  saves: number;
  cart_adds: number;
  purchases: number;
  revenue: number;
}

export const AdminAnalyticsPage: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    totalViews: 0,
    totalLikes: 0,
    totalShares: 0,
    totalSaves: 0,
    totalCartAdds: 0,
    totalPurchases: 0,
    totalRevenue: 0,
    totalUsers: 0,
    totalProducts: 0,
    conversionRate: 0,
  });
  const [topProducts, setTopProducts] = useState<ProductAnalytics[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange]);

  const loadAnalyticsData = async () => {
    try {
      setError(null);
      console.log('Loading analytics data...');

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 7);
      }

      // Load analytics data with error handling
      const analyticsPromises = [
        supabase
          .from('product_analytics')
          .select('*')
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]),
        supabase
          .from('orders')
          .select('total_amount, created_at')
          .eq('payment_status', 'paid')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString()),
        supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true)
      ];

      const results = await Promise.allSettled(analyticsPromises);
      
      let analytics = null;
      let orders = null;
      let totalUsers = 0;
      let totalProducts = 0;

      if (results[0].status === 'fulfilled') {
        analytics = results[0].value.data;
      } else {
        console.error('Error loading analytics:', results[0].reason);
      }

      if (results[1].status === 'fulfilled') {
        orders = results[1].value.data;
      } else {
        console.error('Error loading orders:', results[1].reason);
      }

      if (results[2].status === 'fulfilled') {
        totalUsers = results[2].value.count || 0;
      } else {
        console.error('Error loading users count:', results[2].reason);
      }

      if (results[3].status === 'fulfilled') {
        totalProducts = results[3].value.count || 0;
      } else {
        console.error('Error loading products count:', results[3].reason);
      }

      // Calculate totals
      const totals = analytics?.reduce((acc, item) => ({
        totalViews: acc.totalViews + (item.views || 0),
        totalLikes: acc.totalLikes + (item.likes || 0),
        totalShares: acc.totalShares + (item.shares || 0),
        totalSaves: acc.totalSaves + (item.saves || 0),
        totalCartAdds: acc.totalCartAdds + (item.cart_adds || 0),
        totalPurchases: acc.totalPurchases + (item.purchases || 0),
        totalRevenue: acc.totalRevenue + (item.revenue || 0),
      }), {
        totalViews: 0,
        totalLikes: 0,
        totalShares: 0,
        totalSaves: 0,
        totalCartAdds: 0,
        totalPurchases: 0,
        totalRevenue: 0,
      }) || {
        totalViews: 0,
        totalLikes: 0,
        totalShares: 0,
        totalSaves: 0,
        totalCartAdds: 0,
        totalPurchases: 0,
        totalRevenue: 0,
      };

      // Calculate additional revenue from orders
      const orderRevenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      
      const conversionRate = totals.totalViews > 0 ? (totals.totalPurchases / totals.totalViews) * 100 : 0;

      setAnalyticsData({
        ...totals,
        totalRevenue: Math.max(totals.totalRevenue, orderRevenue),
        totalUsers,
        totalProducts,
        conversionRate,
      });

      // Load top products with error handling
      try {
        const { data: productAnalytics } = await supabase
          .from('product_analytics')
          .select(`
            product_id,
            products (name),
            views,
            likes,
            shares,
            saves,
            cart_adds,
            purchases,
            revenue
          `)
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);

        // Aggregate by product
        const productMap = new Map<string, ProductAnalytics>();
        
        productAnalytics?.forEach(item => {
          const productId = item.product_id;
          const existing = productMap.get(productId);
          
          if (existing) {
            existing.views += item.views || 0;
            existing.likes += item.likes || 0;
            existing.shares += item.shares || 0;
            existing.saves += item.saves || 0;
            existing.cart_adds += item.cart_adds || 0;
            existing.purchases += item.purchases || 0;
            existing.revenue += item.revenue || 0;
          } else {
            productMap.set(productId, {
              product_id: productId,
              product_name: (item.products as any)?.name || 'Unknown Product',
              views: item.views || 0,
              likes: item.likes || 0,
              shares: item.shares || 0,
              saves: item.saves || 0,
              cart_adds: item.cart_adds || 0,
              purchases: item.purchases || 0,
              revenue: item.revenue || 0,
              conversion_rate: 0,
            });
          }
        });

        // Calculate conversion rates and sort
        const topProductsList = Array.from(productMap.values())
          .map(product => ({
            ...product,
            conversion_rate: product.views > 0 ? (product.purchases / product.views) * 100 : 0,
          }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 10);

        setTopProducts(topProductsList);
      } catch (error) {
        console.error('Error loading product analytics:', error);
        setTopProducts([]);
      }

      // Load daily stats
      const dailyMap = new Map<string, DailyStats>();
      
      analytics?.forEach(item => {
        const date = item.date;
        const existing = dailyMap.get(date);
        
        if (existing) {
          existing.views += item.views || 0;
          existing.likes += item.likes || 0;
          existing.shares += item.shares || 0;
          existing.saves += item.saves || 0;
          existing.cart_adds += item.cart_adds || 0;
          existing.purchases += item.purchases || 0;
          existing.revenue += item.revenue || 0;
        } else {
          dailyMap.set(date, {
            date,
            views: item.views || 0,
            likes: item.likes || 0,
            shares: item.shares || 0,
            saves: item.saves || 0,
            cart_adds: item.cart_adds || 0,
            purchases: item.purchases || 0,
            revenue: item.revenue || 0,
          });
        }
      });

      const dailyStatsList = Array.from(dailyMap.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setDailyStats(dailyStatsList);

      console.log('Analytics data loaded successfully');
    } catch (error) {
      console.error('Error loading analytics data:', error);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setIsLoading(false);
    }
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const statCards = [
    {
      title: 'Total Views',
      value: analyticsData.totalViews,
      icon: Eye,
      color: 'bg-blue-500',
      format: formatNumber,
    },
    {
      title: 'Total Likes',
      value: analyticsData.totalLikes,
      icon: Heart,
      color: 'bg-red-500',
      format: formatNumber,
    },
    {
      title: 'Total Shares',
      value: analyticsData.totalShares,
      icon: Share2,
      color: 'bg-green-500',
      format: formatNumber,
    },
    {
      title: 'Cart Additions',
      value: analyticsData.totalCartAdds,
      icon: ShoppingCart,
      color: 'bg-purple-500',
      format: formatNumber,
    },
    {
      title: 'Total Revenue',
      value: analyticsData.totalRevenue,
      icon: DollarSign,
      color: 'bg-yellow-500',
      format: formatCurrency,
    },
    {
      title: 'Conversion Rate',
      value: analyticsData.conversionRate,
      icon: TrendingUp,
      color: 'bg-indigo-500',
      format: (val: number) => `${val.toFixed(2)}%`,
    },
    {
      title: 'Total Users',
      value: analyticsData.totalUsers,
      icon: Users,
      color: 'bg-cyan-500',
      format: formatNumber,
    },
    {
      title: 'Active Products',
      value: analyticsData.totalProducts,
      icon: Package,
      color: 'bg-orange-500',
      format: formatNumber,
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Analytics</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadAnalyticsData}
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-2">Track your platform performance and insights</p>
        </div>
        
        <div>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Views Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Views</h3>
          <div className="h-64 flex items-end justify-between space-x-2">
            {dailyStats.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                No data available
              </div>
            ) : (
              dailyStats.map((stat, index) => {
                const maxViews = Math.max(...dailyStats.map(s => s.views));
                const height = maxViews > 0 ? (stat.views / maxViews) * 100 : 0;
                
                return (
                  <div key={stat.date} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600"
                      style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0px' }}
                      title={`${stat.views} views on ${formatDate(stat.date)}`}
                    />
                    <span className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-top-left">
                      {formatDate(stat.date)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Daily Revenue Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Revenue</h3>
          <div className="h-64 flex items-end justify-between space-x-2">
            {dailyStats.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                No data available
              </div>
            ) : (
              dailyStats.map((stat, index) => {
                const maxRevenue = Math.max(...dailyStats.map(s => s.revenue));
                const height = maxRevenue > 0 ? (stat.revenue / maxRevenue) * 100 : 0;
                
                return (
                  <div key={stat.date} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-green-500 rounded-t transition-all duration-300 hover:bg-green-600"
                      style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0px' }}
                      title={`${formatCurrency(stat.revenue)} revenue on ${formatDate(stat.date)}`}
                    />
                    <span className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-top-left">
                      {formatDate(stat.date)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Top Performing Products</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Views
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Likes
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cart Adds
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purchases
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Conversion
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {topProducts.map((product, index) => (
                <motion.tr
                  key={product.product_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="font-medium text-gray-900">{product.product_name}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-gray-700">
                    {formatNumber(product.views)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-gray-700">
                    {formatNumber(product.likes)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-gray-700">
                    {formatNumber(product.cart_adds)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-gray-700">
                    {formatNumber(product.purchases)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`font-medium ${
                      product.conversion_rate > 5 ? 'text-green-600' :
                      product.conversion_rate > 2 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {product.conversion_rate.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                    {formatCurrency(product.revenue)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {topProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No product data available</p>
          </div>
        )}
      </div>
    </div>
  );
};