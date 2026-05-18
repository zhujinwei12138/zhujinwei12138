import { useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import { TrendingUp, ShoppingBag, Users, DollarSign, ArrowUpRight } from "lucide-react";
import { useData } from "../../context/DataContext";

const COLORS = ["#f59e0b", "#fb923c", "#f97316", "#eab308", "#84cc16", "#34d399", "#38bdf8", "#818cf8"];

function StatCard({ label, value, sub, icon: Icon, color, trend }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; trend?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={20} />
        </div>
        {trend && (
          <span className="text-green-500 text-xs flex items-center gap-0.5 bg-green-50 px-2 py-1 rounded-full" style={{ fontWeight: 600 }}>
            <ArrowUpRight size={12} />
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-gray-400 text-sm mb-1">{label}</p>
        <p className="text-gray-900" style={{ fontWeight: 700, fontSize: "1.6rem", lineHeight: 1 }}>{value}</p>
        {sub && <p className="text-gray-400 text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { merchants, orders } = useData();

  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const weekAgo = now.getTime() - 7 * 86400000;
    const todayOrders = orders.filter((o) => new Date(o.timestamp).toDateString() === today);
    const weekOrders = orders.filter((o) => new Date(o.timestamp).getTime() >= weekAgo);
    return {
      totalMerchants: merchants.length,
      activeMerchants: merchants.filter((m) => m.status === "active").length,
      totalOrders: orders.length,
      totalRevenue: orders.reduce((s, o) => s + o.total, 0),
      todayRevenue: todayOrders.reduce((s, o) => s + o.total, 0),
      todayOrders: todayOrders.length,
      weekRevenue: weekOrders.reduce((s, o) => s + o.total, 0),
      pendingOrders: orders.filter((o) => o.status === "pending" || o.status === "preparing").length,
    };
  }, [merchants, orders]);

  // 14-day revenue trend
  const trendData = useMemo(() => {
    const days: { date: string; revenue: number; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      const dayOrders = orders.filter(
        (o) => new Date(o.timestamp).toDateString() === d.toDateString()
      );
      days.push({ date: label, revenue: dayOrders.reduce((s, o) => s + o.total, 0), count: dayOrders.length });
    }
    return days;
  }, [orders]);

  // Top beers
  const topBeers = useMemo(() => {
    const map: Record<string, { name: string; quantity: number; revenue: number }> = {};
    orders.forEach((o) =>
      o.items.forEach((item) => {
        if (!map[item.beerName]) map[item.beerName] = { name: item.beerName, quantity: 0, revenue: 0 };
        map[item.beerName].quantity += item.quantity;
        map[item.beerName].revenue += item.price * item.quantity;
      })
    );
    return Object.values(map).sort((a, b) => b.quantity - a.quantity).slice(0, 6);
  }, [orders]);

  // Merchant pie
  const merchantPie = useMemo(() =>
    merchants.map((m) => ({
      name: m.name.length > 7 ? m.name.slice(0, 6) + "…" : m.name,
      value: orders.filter((o) => o.merchantId === m.id).reduce((s, o) => s + o.total, 0),
    })).filter((m) => m.value > 0),
    [merchants, orders]
  );

  // Recent orders
  const recentOrders = orders.slice(0, 8);

  const statusStyle: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    preparing: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-600",
    cancelled: "bg-gray-100 text-gray-400",
  };
  const statusLabel: Record<string, string> = {
    pending: "待处理", preparing: "制作中", completed: "已完成", cancelled: "已取消",
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-gray-900" style={{ fontWeight: 700 }}>数据概览</h1>
        <p className="text-gray-400 text-sm">实时掌握平台运营情况</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="商家总数" value={`${stats.totalMerchants}`} sub={`${stats.activeMerchants} 家营业中`} icon={Users} color="bg-blue-50 text-blue-500" trend="+1" />
        <StatCard label="今日订单" value={`${stats.todayOrders}`} sub={`待处理 ${stats.pendingOrders} 笔`} icon={ShoppingBag} color="bg-purple-50 text-purple-500" />
        <StatCard label="今日营业额" value={`¥${stats.todayRevenue.toLocaleString()}`} sub="实时更新" icon={DollarSign} color="bg-green-50 text-green-500" trend="+12%" />
        <StatCard label="累计营业额" value={`¥${stats.totalRevenue.toLocaleString()}`} sub={`共 ${stats.totalOrders} 笔订单`} icon={TrendingUp} color="bg-amber-50 text-amber-500" />
      </div>

      {/* Revenue Trend */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-gray-900" style={{ fontWeight: 600 }}>近14天营业额趋势</h3>
            <p className="text-gray-400 text-xs mt-0.5">本周合计 ¥{stats.weekRevenue.toLocaleString()}</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trendData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#9ca3af" }} />
            <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} tickFormatter={(v) => `¥${v}`} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.1)", fontSize: 13 }}
              formatter={(v: number) => [`¥${v}`, "营业额"]}
            />
            <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-gray-900 mb-4" style={{ fontWeight: 600 }}>热销啤酒 Top 6</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topBeers} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} width={90} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.1)", fontSize: 12 }}
                formatter={(v: number) => [`${v} 杯`, "销量"]}
              />
              <Bar dataKey="quantity" radius={[0, 6, 6, 0]}>
                {topBeers.map((_, idx) => <Cell key={idx} fill={COLORS[idx]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-gray-900 mb-4" style={{ fontWeight: 600 }}>各商家营业额占比</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={merchantPie} cx="40%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {merchantPie.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
              </Pie>
              <Legend
                layout="vertical" align="right" verticalAlign="middle"
                formatter={(value) => <span style={{ fontSize: 12, color: "#6b7280" }}>{value}</span>}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.1)", fontSize: 12 }}
                formatter={(v: number) => [`¥${v}`, "营业额"]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-gray-900" style={{ fontWeight: 600 }}>最新订单</h3>
          <span className="text-gray-400 text-xs">最近 8 笔</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                {["时间", "商家", "桌号", "商品", "金额", "状态"].map((h) => (
                  <th key={h} className="text-left text-gray-400 text-xs px-5 py-3" style={{ fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order, idx) => (
                <tr key={order.id} className={`border-t border-gray-50 ${idx % 2 === 0 ? "" : "bg-gray-50/30"}`}>
                  <td className="px-5 py-3.5 text-gray-500 text-sm whitespace-nowrap">
                    {new Date(order.timestamp).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-5 py-3.5 text-gray-800 text-sm" style={{ fontWeight: 500 }}>{order.merchantName}</td>
                  <td className="px-5 py-3.5"><span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">{order.tableNo}</span></td>
                  <td className="px-5 py-3.5 text-gray-500 text-sm max-w-48 truncate">
                    {order.items.map((i) => `${i.beerName}×${i.quantity}`).join("、")}
                  </td>
                  <td className="px-5 py-3.5 text-amber-600 text-sm" style={{ fontWeight: 600 }}>¥{order.total}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-1 rounded-full ${statusStyle[order.status]}`} style={{ fontWeight: 500 }}>
                      {statusLabel[order.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
