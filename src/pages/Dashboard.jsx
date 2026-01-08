import { useState, useEffect } from 'react';
import {
  Users,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Calendar,
  RefreshCw
} from 'lucide-react';
import Layout from '../components/layout/Layout';
import StatCard from '../components/dashboard/StatCard';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useNotification } from '../contexts/NotificationContext';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { analyticsAPI, customerAPI, employeeAPI, gymAPI } from '../services/api';
import './Dashboard.css';

const transformRevenueTrend = (trend = []) => {
  if (!Array.isArray(trend)) return [];
  return trend.map(entry => {
    const date = entry.date || entry._id?.date || entry._id;
    const revenue = entry.totalRevenue ?? entry.revenue ?? entry.total ?? entry.amount ?? 0;
    const transactions = entry.transactions ?? entry.transactionCount ?? entry.count ?? 0;
    return {
      date,
      totalRevenue: revenue,
      transactions
    };
  });
};

const buildSafeDataFromAnalytics = (data = {}) => {
  const customers = data.customers || data.customerMetrics || {};
  const employees = data.employees || data.employeeStats || [];
  const memberships = data.memberships || {};
  const revenue = data.revenue || {};

  return {
    customerMetrics: {
      totalCustomers: customers.totalCustomers || 0,
      newCustomers: customers.newCustomers || 0,
      averageLoyaltyPoints: customers.averageLoyaltyPoints || 0
    },
    employeeStats: {
      totalEmployees: Array.isArray(employees)
        ? employees.reduce((sum, emp) => sum + (emp.count || 0), 0)
        : employees.totalEmployees || 0
    },
    membershipMetrics: (Array.isArray(memberships.byType) && memberships.byType.length > 0)
      ? memberships.byType.map(item => ({
          type: item._id || item.type || 'active',
          count: item.count || 0
        }))
      : (data.membershipMetrics || [{ type: 'active', count: data.activeMemberships || memberships.total || 0 }]),
    revenueByBusinessUnit: revenue.byBusinessUnit || data.revenueByBusinessUnit || [],
    revenueTrend: transformRevenueTrend(revenue.trend || data.revenueTrend || []),
    revenueTotal: revenue.total || 0
  };
};

const buildSafeDataFallback = (customersCount, employeesCount, membershipsCount) => ({
  customerMetrics: {
    totalCustomers: customersCount
  },
  employeeStats: {
    totalEmployees: employeesCount
  },
  membershipMetrics: [{ type: 'active', count: membershipsCount }],
  revenueByBusinessUnit: [],
  revenueTrend: [],
  revenueTotal: 0
});

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const { connected, subscribeToInventoryLowStock } = useWebSocket();
  const { warning, info } = useNotification();

  // Real data states
  const [dashboardData, setDashboardData] = useState({
    stats: [],
    revenueData: [],
    businessUnitData: [],
    customerActivityData: [],
    recentActivities: [],
    upcomingEvents: []
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!connected) return;

    const unsubscribe = subscribeToInventoryLowStock((data) => {
      warning(`Low stock alert: ${data.itemName}`, 8000);
    });

    return () => unsubscribe && unsubscribe();
  }, [connected, subscribeToInventoryLowStock, warning]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      let safeData = {};

      // Try to fetch from analytics API first
      try {
        const response = await analyticsAPI.getExecutiveDashboard();
        const payload = response?.data ?? response;
        const data = payload?.data || payload || {};

        if (payload?.success === false && Object.keys(data).length === 0) {
          throw new Error('Analytics API returned unsuccessful response');
        }

        safeData = buildSafeDataFromAnalytics(data);
      } catch (analyticsError) {
        console.warn('Analytics API unavailable, fetching from individual endpoints:', analyticsError.message);

        // Fallback: Fetch from individual endpoints
        const [customersRes, employeesRes, membershipsRes] = await Promise.allSettled([
          customerAPI.getAll({ limit: 1 }),
          employeeAPI.getAll({ limit: 1 }),
          gymAPI.getMemberships({ limit: 1 })
        ]);

        // Debug: Log the actual responses
        console.log('Customers Response:', customersRes);
        console.log('Employees Response:', employeesRes);
        console.log('Memberships Response:', membershipsRes);

        // Extract counts from responses (matching Customers.jsx pattern)
        const getCustomerCount = () => {
          if (customersRes.status !== 'fulfilled') return 0;
          const res = customersRes.value;
          return res?.pagination?.total || res?.data?.customers?.length || res?.customers?.length || 0;
        };

        const getEmployeeCount = () => {
          if (employeesRes.status !== 'fulfilled') return 0;
          const res = employeesRes.value;
          return res?.pagination?.total || res?.data?.employees?.length || res?.employees?.length || 0;
        };

        const getMembershipCount = () => {
          if (membershipsRes.status !== 'fulfilled') return 0;
          const res = membershipsRes.value;
          return res?.pagination?.total || res?.data?.memberships?.length || res?.memberships?.length || 0;
        };

        // Build safeData from individual responses
        safeData = buildSafeDataFallback(
          getCustomerCount(),
          getEmployeeCount(),
          getMembershipCount()
        );

        console.log('Processed safeData:', safeData);
      }

      const stats = [
        {
          title: 'Total Customers',
          value: formatNumber(safeData.customerMetrics?.totalCustomers || 0),
          icon: Users,
          trend: 'up',
          trendValue: '0',
          color: 'var(--primary-color)'
        },
        {
          title: 'Monthly Revenue',
          value: formatCurrency(safeData.revenueTotal || safeData.revenueByBusinessUnit?.reduce((sum, bu) => sum + (bu.totalRevenue || 0), 0) || 0),
          icon: DollarSign,
          trend: 'up',
          trendValue: '0',
          color: 'var(--success)'
        },
        {
          title: 'Active Memberships',
          value: formatNumber(safeData.membershipMetrics?.reduce((sum, m) => sum + (m.count || 0), 0) || 0),
          icon: TrendingUp,
          trend: 'up',
          trendValue: '0',
          color: 'var(--gym-color)'
        },
        {
          title: 'Total Employees',
          value: formatNumber(safeData.employeeStats?.totalEmployees || 0),
          icon: ShoppingBag,
          trend: 'up',
          trendValue: '0',
          color: 'var(--manufacturing-color)'
        }
      ];

      // Process revenue trend data (last 6 months)
      const revenueData = processRevenueTrendData(safeData.revenueTrend || []);

      // Process business unit data
      const businessUnitData = processBusinessUnitData(safeData.revenueByBusinessUnit || []);

      // Process customer activity (last 7 days from revenue trend)
      const customerActivityData = processCustomerActivityData(safeData.revenueTrend || []);

      // Get recent activities from transaction history if available
      const recentActivities = [];

      // Get upcoming events from appointments if available
      const upcomingEvents = [];

      setDashboardData({
        stats,
        revenueData,
        businessUnitData,
        customerActivityData,
        recentActivities,
        upcomingEvents
      });

      setLoading(false);
    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError('Failed to load dashboard data. Please try refreshing.');
      setLoading(false);

      // Set empty data on error
      setDashboardData({
        stats: [
          { title: 'Total Customers', value: '0', icon: Users, trend: 'up', trendValue: '0', color: 'var(--primary-color)' },
          { title: 'Monthly Revenue', value: formatCurrency(0), icon: DollarSign, trend: 'up', trendValue: '0', color: 'var(--success)' },
          { title: 'Active Memberships', value: '0', icon: TrendingUp, trend: 'up', trendValue: '0', color: 'var(--gym-color)' },
          { title: 'Total Employees', value: '0', icon: ShoppingBag, trend: 'up', trendValue: '0', color: 'var(--manufacturing-color)' }
        ],
        revenueData: [],
        businessUnitData: [],
        customerActivityData: [],
        recentActivities: [],
        upcomingEvents: []
      });
    }
  };

  // Helper function to process revenue trend data
  const processRevenueTrendData = (revenueTrend) => {
    if (!revenueTrend || revenueTrend.length === 0) return [];

    // Get last 6 months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const last6Months = revenueTrend.slice(-180); // Approximately 6 months of daily data

    // Group by month
    const monthlyData = {};
    last6Months.forEach(day => {
      const date = new Date(day.date);
      if (isNaN(date)) {
        return;
      }
      const monthKey = months[date.getMonth()];

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthKey, revenue: 0, expenses: 0 };
      }

      monthlyData[monthKey].revenue += day.totalRevenue || day.revenue || 0;
      // Note: expenses data not available in current API, setting to 0
      monthlyData[monthKey].expenses += 0;
    });

    return Object.values(monthlyData);
  };

  // Helper function to process business unit data
  const processBusinessUnitData = (revenueByBusinessUnit) => {
    if (!revenueByBusinessUnit || revenueByBusinessUnit.length === 0) return [];

    const businessUnitColors = {
      'gym': 'var(--gym-color)',
      'spa': 'var(--spa-color)',
      'salon': 'var(--salon-color)',
      'restaurant': 'var(--restaurant-color)',
      'childcare': 'var(--childcare-color)',
      'manufacturing': 'var(--manufacturing-color)'
    };

    const businessUnitNames = {
      'gym': 'The Ring (Gym)',
      'spa': 'The Olive Room (Spa)',
      'salon': 'Salon',
      'restaurant': 'Restaurant',
      'childcare': 'Childcare',
      'manufacturing': 'Manufacturing'
    };

    return revenueByBusinessUnit.map(bu => ({
      name: businessUnitNames[bu._id] || bu._id,
      value: bu.totalRevenue || 0,
      color: businessUnitColors[bu._id] || 'var(--gray-400)'
    }));
  };

  // Helper function to process customer activity (last 7 days)
  const processCustomerActivityData = (revenueTrend) => {
    if (!revenueTrend || revenueTrend.length === 0) return [];

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const last7Days = revenueTrend.slice(-7);

    return last7Days.map(day => {
      const date = new Date(day.date);
      if (isNaN(date)) {
        return null;
      }
      return {
        day: days[date.getDay()],
        customers: day.transactions || day.transactionCount || 0
      };
    }).filter(Boolean);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
    info('Dashboard refreshed', 2000);
  };

  const { stats, revenueData, businessUnitData, customerActivityData, recentActivities, upcomingEvents } = dashboardData;

  return (
    <Layout title="Dashboard" subtitle="Welcome back! Here's what's happening with your business">
      {error && (
        <div className="alert alert-warning mb-lg">
          {error}
        </div>
      )}

      <div className="dashboard-header mb-lg">
        <Button
          variant="secondary"
          icon={RefreshCw}
          onClick={handleRefresh}
          loading={refreshing}
          disabled={loading}
        >
          Refresh
        </Button>
        {connected && (
          <span className="connection-status">
            <span className="status-dot online"></span>
            Real-time updates active
          </span>
        )}
      </div>

      <div className="dashboard">
        {/* Stats Grid */}
        <div className="grid grid-4 mb-xl">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} loading={loading} />
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-2 mb-xl">
          <Card title="Revenue Overview" subtitle="Last 6 months">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                <XAxis dataKey="month" stroke="var(--gray-400)" />
                <YAxis stroke="var(--gray-400)" />
                <Tooltip
                  contentStyle={{
                    background: 'var(--white)',
                    border: '1px solid var(--gray-200)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                />
                <Legend />
                <Bar dataKey="revenue" fill="var(--primary-color)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expenses" fill="var(--accent-gold)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Business Unit Performance" subtitle="Revenue distribution">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={businessUnitData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {businessUnitData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Weekly Activity */}
        <div className="grid grid-1 mb-xl">
          <Card title="Weekly Customer Activity" subtitle="Customer visits per day">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={customerActivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                <XAxis dataKey="day" stroke="var(--gray-400)" />
                <YAxis stroke="var(--gray-400)" />
                <Tooltip
                  contentStyle={{
                    background: 'var(--white)',
                    border: '1px solid var(--gray-200)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="customers"
                  stroke="var(--primary-color)"
                  strokeWidth={3}
                  dot={{ fill: 'var(--primary-color)', r: 6 }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Recent Activities and Upcoming Events */}
        <div className="grid grid-2">
          <Card title="Recent Activities" subtitle="Latest updates across all business units">
            <div className="activity-list">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity, index) => {
                  const Icon = activity.icon;
                  return (
                    <div key={index} className="activity-item">
                      <div className="activity-icon" style={{ background: activity.color }}>
                        <Icon size={18} />
                      </div>
                      <div className="activity-content">
                        <h4>{activity.title}</h4>
                        <p>{activity.description}</p>
                      </div>
                      <span className="activity-time">{activity.time}</span>
                    </div>
                  );
                })
              ) : (
                <div className="empty-state" style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                  <p>No recent activities to display</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Upcoming Events" subtitle="Scheduled activities">
            <div className="events-list">
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event, index) => (
                  <div key={index} className="event-item">
                    <div className="event-date">
                      <div className="event-day">{event.date}</div>
                      <div className="event-month">{event.month}</div>
                    </div>
                    <div className="event-content">
                      <h4>{event.title}</h4>
                      <div className="event-details">
                        <Calendar size={14} />
                        <span>{event.time}</span>
                        <span className="event-dot">•</span>
                        <span>{event.type}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state" style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                  <p>No upcoming events scheduled</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
