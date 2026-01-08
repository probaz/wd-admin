// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import axios from '../utils/axios';
import { 
  UsersIcon, 
  ShoppingBagIcon, 
  CubeIcon, 
  CurrencyDollarIcon,
  UserGroupIcon,
  ArchiveBoxIcon,
  ChartBarIcon,
  BuildingStorefrontIcon,
  CheckCircleIcon,
  ClockIcon,
  PhoneIcon
} from '@heroicons/react/24/outline';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import Loading from '../components/Loading';
import Error from '../components/Error';

const StatCard = ({ title, value, icon: Icon, trend, prefix = '', info }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="flex items-center">
      <div className="flex-shrink-0">
        <Icon className="h-6 w-6 text-primary-600" />
      </div>
      <div className="ml-4">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p className="text-2xl font-semibold text-gray-900">
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {trend && (
          <p className={`text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% from last month
          </p>
        )}
        {info && <p className="text-xs text-gray-500 mt-1">{info}</p>}
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalUsers: 0,
      totalShops: 0,
      totalProducts: 0,
      totalTransactions: 0,
      totalEcocashTransactions: 0,
      pendingEcocashTransactions: 0,
      totalAmount: 0,
      totalEcocashAmount: 0,
      activeUsers: 0,
      userTrend: 0,
      pendingTargetUsers: 0,
      readyForRedemptionUsers: 0,
      totalTargetAmount: 0,
      startedPayingUsers: 0,
      startedPaymentFulfillment: 0,
      redemptionCount: 0,
      recentTransactions: []
    },
    charts: {
      transactions: [],
      productPopularity: []
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, chartsRes] = await Promise.all([
        axios.get('/admin_innovations/dashboard/stats'),
        axios.get('/admin_innovations/dashboard/charts')
      ]);

      setDashboardData({
        stats: statsRes.data,
        charts: chartsRes.data
      });
      setError(null);
    } catch (err) {
      console.error('Dashboard data error:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatCompactCurrency = (amount) => {
    if (amount === undefined || amount === null) return '$0';
    
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    const trim = (value) => {
      const rounded = value >= 10 ? Math.round(value) : Number(value.toFixed(1));
      return rounded.toString().replace(/\.0$/, '');
    };

    if (abs >= 1_000_000_000) return `${sign}$${trim(abs / 1_000_000_000)}B+`;
    if (abs >= 1_000_000) return `${sign}$${trim(abs / 1_000_000)}M+`;
    if (abs >= 1_000) return `${sign}$${trim(abs / 1_000)}k+`;
    return `${sign}$${abs.toLocaleString()}`;
  };

  if (loading) return <Loading />;
  if (error) return <Error message={error} />;

  const { stats, charts } = dashboardData;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Overview of system performance and metrics</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={UsersIcon}
          trend={stats.userTrend}
          info={`${stats.activeUsers} active users`}
        />
        <StatCard
          title="Total Target Amount"
          value={formatCompactCurrency(stats.totalTargetAmount)}
          icon={CurrencyDollarIcon}
          info={`${stats.readyForRedemptionUsers} users ready for redemption`}
        />
        <StatCard
          title="Pending Target Users"
          value={stats.pendingTargetUsers}
          icon={ClockIcon}
          info="Users still saving toward target"
        />
        <StatCard
          title="Started Payments"
          value={stats.startedPayingUsers}
          icon={UserGroupIcon}
          info={`Remaining to fulfill: ${formatCurrency(stats.startedPaymentFulfillment)}`}
        />
        <StatCard
          title="Seed Redemptions"
          value={stats.redemptionCount}
          icon={CheckCircleIcon}
          info="Seeds redeemed at shops"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 lg:grid-cols-3">
        <StatCard
          title="Active Shops"
          value={stats.totalShops}
          icon={BuildingStorefrontIcon}
        />
        <StatCard
          title="Available Products"
          value={stats.totalProducts}
          icon={CubeIcon}
        />
        <StatCard
          title="EcoCash Top-Ups"
          value={stats.totalEcocashTransactions}
          icon={PhoneIcon}
          info={`${formatCurrency(stats.totalEcocashAmount)} total volume`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Transaction History Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Top-Ups vs Redemptions</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={charts.transactions}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                />
                <YAxis 
                  tickFormatter={(value) => formatCurrency(value).replace('$', '')}
                />
                <Tooltip 
                  formatter={(value) => formatCurrency(value)}
                  labelFormatter={formatDate}
                />
                <Line 
                  name="Top-Ups"
                  type="monotone" 
                  dataKey="topupAmount" 
                  stroke="#0891b2" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  name="Redemptions"
                  type="monotone" 
                  dataKey="redemptionAmount" 
                  stroke="#16a34a" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Popularity Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Popular Products</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={charts.productPopularity}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Bar 
                  dataKey="count" 
                  fill="#16a34a"
                  name="Orders"
                />
                <Bar 
                  dataKey="totalQuantity" 
                  fill="#22c55e"
                  name="Total Quantity"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {stats.recentTransactions && stats.recentTransactions.length > 0 ? (
            stats.recentTransactions.map((transaction) => (
              <div key={transaction._id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-gray-900">
                        {transaction.userId?.fullName || 'Unknown User'}
                      </p>
                      <p className="ml-2 text-sm text-gray-500">
                        ({transaction.userId?.phone || 'No Phone'})
                      </p>
                    </div>
                    <p className="text-sm text-gray-500">
                      {new Date(transaction.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {transaction.shopId && (
                      <p className="text-xs text-primary-600 mt-1">
                        Shop: {transaction.shopId.name}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      transaction.type === 'topup' 
                        ? 'bg-green-100 text-green-800' 
                        : transaction.type === 'redemption'
                        ? 'bg-blue-100 text-blue-800'
                        : transaction.type === 'purchase'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {transaction.type === 'topup' ? 'Top Up' : 
                       transaction.type === 'redemption' ? 'Seed Redemption' : 
                       transaction.type === 'purchase' ? 'Purchase' :
                       transaction.type}
                      {transaction.amount ? ` (${formatCurrency(transaction.amount)})` : ''}
                    </span>
                    <span className={`mt-1 text-xs ${
                      transaction.status === 'COMPLETED' ? 'text-green-600' : 
                      transaction.status === 'PENDING SUBSCRIBER VALIDATION' ? 'text-blue-600' :
                      transaction.status === 'PENDING' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {transaction.status === 'PENDING SUBSCRIBER VALIDATION' 
                        ? 'Awaiting EcoCash PIN' 
                        : transaction.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-4 text-center text-gray-500">
              No recent transactions
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
