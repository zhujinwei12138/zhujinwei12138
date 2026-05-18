import { useState, useMemo } from "react";
import { Link } from "react-router";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Store, ReceiptText, LayoutDashboard, Plus, Pencil, Trash2, X,
  ArrowLeft, TrendingUp, ShoppingBag, Users, DollarSign, ChevronDown,
  CheckCircle, XCircle, Eye,
} from "lucide-react";
import { useData, Merchant, SalesOrder } from "../context/DataContext";

type AdminTab = "overview" | "merchants" | "sales";

// ─── Merchant Modal ───────────────────────────────────────────────────────────
interface MerchantModalProps {
  initial?: Merchant | null;
  onSave: (data: Omit<Merchant, "id" | "createdAt">) => void;
  onClose: () => void;
}

function MerchantModal({ initial, onSave, onClose }: MerchantModalProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    address: initial?.address ?? "",
    phone: initial?.phone ?? "",
    status: initial?.status ?? "active" as "active" | "inactive",
  });

  const handleSubmit = () => {
    if (!form.name.trim() || !form.address.trim() || !form.phone.trim()) return;
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-gray-900" style={{ fontWeight: 700 }}>{initial ? "编辑商家" : "添加商家"}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {[
            { label: "商家名称", key: "name", placeholder: "例：老张精酿啤酒馆" },
            { label: "地址", key: "address", placeholder: "详细地址" },
            { label: "联系电话", key: "phone", placeholder: "例：010-12345678" },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="text-gray-500 text-sm block mb-1.5">{label}</label>
              <input
                type="text"
                placeholder={placeholder}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-400"
              />
            </div>
          ))}
          <div>
            <label className="text-gray-500 text-sm block mb-1.5">状态</label>
            <div className="flex gap-3">
              {(["active", "inactive"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setForm((f) => ({ ...f, status: s }))}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm transition-all ${form.status === s ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-400"}`}
                  style={{ fontWeight: form.status === s ? 600 : 400 }}
                >
                  {s === "active" ? "✅ 营业中" : "⏸ 暂停营业"}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!form.name.trim() || !form.address.trim() || !form.phone.trim()}
            className="w-full bg-amber-500 text-white py-3.5 rounded-2xl disabled:opacity-40 mt-1"
            style={{ fontWeight: 600 }}
          >
            {initial ? "保存修改" : "添加商家"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────
function OrderDetailModal({ order, onClose }: { order: SalesOrder; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-gray-900" style={{ fontWeight: 700 }}>订单详情</h3>
            <p className="text-gray-400 text-xs mt-0.5">{order.merchantName} · 桌号 {order.tableNo}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <X size={16} />
          </button>
        </div>
        <p className="text-gray-400 text-xs mb-4">{new Date(order.timestamp).toLocaleString("zh-CN")}</p>
        <div className="flex flex-col gap-2 mb-4">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-50">
              <div>
                <p className="text-gray-800 text-sm" style={{ fontWeight: 500 }}>{item.beerName}</p>
                <p className="text-gray-400 text-xs">{item.category} · ¥{item.price}/杯</p>
              </div>
              <div className="text-right">
                <p className="text-gray-600 text-sm">×{item.quantity}</p>
                <p className="text-amber-600 text-sm" style={{ fontWeight: 600 }}>¥{(item.price * item.quantity).toFixed(0)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-2">
          <span className="text-gray-500">合计</span>
          <span className="text-amber-600" style={{ fontWeight: 700, fontSize: "1.2rem" }}>¥{order.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const { merchants, orders } = useData();

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayOrders = orders.filter((o) => new Date(o.timestamp).toDateString() === today);
    return {
      merchantCount: merchants.length,
      totalOrders: orders.length,
      totalRevenue: orders.reduce((s, o) => s + o.total, 0),
      todayRevenue: todayOrders.reduce((s, o) => s + o.total, 0),
    };
  }, [merchants, orders]);

  const beerSales = useMemo(() => {
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

  const merchantSales = useMemo(() => {
    return merchants.map((m) => {
      const mOrders = orders.filter((o) => o.merchantId === m.id);
      return {
        name: m.name.length > 6 ? m.name.slice(0, 5) + "…" : m.name,
        revenue: mOrders.reduce((s, o) => s + o.total, 0),
        orders: mOrders.length,
      };
    });
  }, [merchants, orders]);

  const COLORS = ["#f59e0b", "#fb923c", "#f97316", "#eab308", "#a3e635", "#34d399"];

  const statCards = [
    { label: "商家总数", value: stats.merchantCount, suffix: "家", icon: Users, color: "bg-blue-50 text-blue-500" },
    { label: "累计订单", value: stats.totalOrders, suffix: "笔", icon: ShoppingBag, color: "bg-purple-50 text-purple-500" },
    { label: "累计营业额", value: `¥${stats.totalRevenue.toLocaleString()}`, suffix: "", icon: TrendingUp, color: "bg-amber-50 text-amber-500" },
    { label: "今日营业额", value: `¥${stats.todayRevenue.toLocaleString()}`, suffix: "", icon: DollarSign, color: "bg-green-50 text-green-500" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className={`w-9 h-9 rounded-xl ${card.color} flex items-center justify-center mb-3`}>
              <card.icon size={18} />
            </div>
            <p className="text-gray-400 text-xs mb-0.5">{card.label}</p>
            <p className="text-gray-900" style={{ fontWeight: 700, fontSize: "1.2rem" }}>
              {card.value}{card.suffix}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-gray-700 mb-4" style={{ fontWeight: 600 }}>热销啤酒 Top 6</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={beerSales} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: 12 }}
              formatter={(v: number) => [`${v} 杯`, "销量"]}
            />
            <Bar dataKey="quantity" radius={[6, 6, 0, 0]}>
              {beerSales.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-gray-700 mb-4" style={{ fontWeight: 600 }}>各商家营业额</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={merchantSales} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={(v) => `¥${v}`} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: 12 }}
              formatter={(v: number) => [`¥${v}`, "营业额"]}
            />
            <Bar dataKey="revenue" fill="#f59e0b" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Merchants Tab ────────────────────────────────────────────────────────────
function MerchantsTab() {
  const { merchants, orders, addMerchant, updateMerchant, deleteMerchant } = useData();
  const [search, setSearch] = useState("");
  const [modalData, setModalData] = useState<{ open: boolean; merchant: Merchant | null }>({ open: false, merchant: null });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = merchants.filter((m) => m.name.includes(search) || m.address.includes(search));

  const getMerchantStats = (id: string) => {
    const mOrders = orders.filter((o) => o.merchantId === id);
    return {
      orders: mOrders.length,
      revenue: mOrders.reduce((s, o) => s + o.total, 0),
    };
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="搜索商家名称或地址…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-amber-400"
        />
        <button
          onClick={() => setModalData({ open: true, merchant: null })}
          className="flex items-center gap-1.5 bg-amber-500 text-white px-4 py-2.5 rounded-xl flex-shrink-0"
          style={{ fontWeight: 600 }}
        >
          <Plus size={16} />
          添加
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((m) => {
          const stats = getMerchantStats(m.id);
          return (
            <div key={m.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-gray-900 truncate" style={{ fontWeight: 600 }}>{m.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${m.status === "active" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                      {m.status === "active" ? <CheckCircle size={10} /> : <XCircle size={10} />}
                      {m.status === "active" ? "营业中" : "已停业"}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs mt-1 truncate">{m.address}</p>
                  <p className="text-gray-400 text-xs">{m.phone}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setModalData({ open: true, merchant: m })}
                    className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(m.id)}
                    className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex gap-4 mt-3 pt-3 border-t border-gray-50">
                <div>
                  <p className="text-gray-400 text-xs">累计订单</p>
                  <p className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>{stats.orders} 笔</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">累计营业额</p>
                  <p className="text-amber-600 text-sm" style={{ fontWeight: 600 }}>¥{stats.revenue.toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">入驻时间</p>
                  <p className="text-gray-600 text-sm">{m.createdAt}</p>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-300">
            <Store size={40} className="mx-auto mb-3 opacity-40" />
            <p>暂无商家</p>
          </div>
        )}
      </div>

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-6">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center shadow-2xl">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-gray-900 mb-2" style={{ fontWeight: 700 }}>确认删除？</h3>
            <p className="text-gray-400 text-sm mb-6">删除后该商家的所有销售记录也将一并清除，此操作不可撤销。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-500">取消</button>
              <button
                onClick={() => { deleteMerchant(deleteConfirm); setDeleteConfirm(null); }}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white"
                style={{ fontWeight: 600 }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {modalData.open && (
        <MerchantModal
          initial={modalData.merchant}
          onSave={(data) => {
            if (modalData.merchant) updateMerchant(modalData.merchant.id, data);
            else addMerchant(data);
          }}
          onClose={() => setModalData({ open: false, merchant: null })}
        />
      )}
    </div>
  );
}

// ─── Sales Tab ────────────────────────────────────────────────────────────────
type DateFilter = "all" | "today" | "week";

function SalesTab() {
  const { merchants, orders } = useData();
  const [merchantFilter, setMerchantFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);

  const filtered = useMemo(() => {
    const now = Date.now();
    return orders.filter((o) => {
      if (merchantFilter !== "all" && o.merchantId !== merchantFilter) return false;
      if (dateFilter === "today") {
        return new Date(o.timestamp).toDateString() === new Date().toDateString();
      }
      if (dateFilter === "week") {
        return now - new Date(o.timestamp).getTime() < 7 * 86400000;
      }
      return true;
    });
  }, [orders, merchantFilter, dateFilter]);

  const totalRevenue = filtered.reduce((s, o) => s + o.total, 0);

  const beerBreakdown = useMemo(() => {
    const map: Record<string, { name: string; category: string; quantity: number; revenue: number }> = {};
    filtered.forEach((o) =>
      o.items.forEach((item) => {
        if (!map[item.beerName]) map[item.beerName] = { name: item.beerName, category: item.category, quantity: 0, revenue: 0 };
        map[item.beerName].quantity += item.quantity;
        map[item.beerName].revenue += item.price * item.quantity;
      })
    );
    return Object.values(map).sort((a, b) => b.quantity - a.quantity);
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <select
            value={merchantFilter}
            onChange={(e) => setMerchantFilter(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 appearance-none focus:outline-none focus:border-amber-400"
          >
            <option value="all">全部商家</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="flex gap-2">
          {(["all", "today", "week"] as DateFilter[]).map((d) => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className={`flex-1 py-2 rounded-xl text-sm transition-all ${dateFilter === d ? "bg-amber-500 text-white" : "bg-white border border-gray-200 text-gray-400"}`}
              style={{ fontWeight: dateFilter === d ? 600 : 400 }}
            >
              {d === "all" ? "全部" : d === "today" ? "今天" : "近7天"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex justify-between items-center">
        <div>
          <p className="text-amber-600 text-xs">筛选结果</p>
          <p className="text-amber-800" style={{ fontWeight: 700 }}>{filtered.length} 笔订单</p>
        </div>
        <div className="text-right">
          <p className="text-amber-600 text-xs">合计营业额</p>
          <p className="text-amber-800" style={{ fontWeight: 700, fontSize: "1.1rem" }}>¥{totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      {/* Beer breakdown */}
      {beerBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-gray-700 mb-3 text-sm" style={{ fontWeight: 600 }}>啤酒销售明细</h3>
          <div className="flex flex-col gap-2">
            {beerBreakdown.map((b, idx) => (
              <div key={b.name} className="flex items-center gap-3">
                <span className="text-gray-300 text-xs w-4" style={{ fontWeight: 700 }}>#{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-gray-800 text-sm truncate" style={{ fontWeight: 500 }}>{b.name}</p>
                    <p className="text-amber-600 text-sm flex-shrink-0 ml-2" style={{ fontWeight: 600 }}>¥{b.revenue}</p>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${(b.quantity / beerBreakdown[0].quantity) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-gray-400 text-xs flex-shrink-0">{b.quantity}杯</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders list */}
      <div className="flex flex-col gap-2">
        {filtered.map((order) => (
          <div
            key={order.id}
            onClick={() => setSelectedOrder(order)}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer active:bg-gray-50"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>{order.merchantName}</span>
                  <span className="bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded">桌 {order.tableNo}</span>
                </div>
                <p className="text-gray-400 text-xs mt-0.5">
                  {new Date(order.timestamp).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  {order.items.map((i) => `${i.beerName}×${i.quantity}`).join("、")}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <p className="text-amber-600" style={{ fontWeight: 700 }}>¥{order.total}</p>
                <Eye size={14} className="text-gray-300" />
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-300">
            <ReceiptText size={40} className="mx-auto mb-3 opacity-40" />
            <p>暂无销售记录</p>
          </div>
        )}
      </div>

      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}

// ─── AdminPage Root ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("overview");

  const tabs = [
    { id: "overview" as AdminTab, label: "概览", icon: LayoutDashboard },
    { id: "merchants" as AdminTab, label: "商家", icon: Store },
    { id: "sales" as AdminTab, label: "记录", icon: ReceiptText },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-2xl mx-auto">
      {/* Admin Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <Link to="/" className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 style={{ fontWeight: 700, fontSize: "1.1rem" }} className="text-gray-900">管理后台</h1>
            <p className="text-gray-400 text-xs">啤酒销售管理系统</p>
          </div>
        </div>
        <div className="flex px-4 gap-1 pb-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors ${tab === t.id ? "border-amber-500 text-amber-600" : "border-transparent text-gray-400"}`}
              style={{ fontWeight: tab === t.id ? 600 : 400 }}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 pb-10">
        {tab === "overview" && <OverviewTab />}
        {tab === "merchants" && <MerchantsTab />}
        {tab === "sales" && <SalesTab />}
      </div>
    </div>
  );
}
