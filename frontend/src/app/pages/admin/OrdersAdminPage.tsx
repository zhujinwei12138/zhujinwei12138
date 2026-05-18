import { useState, useMemo } from "react";
import {
  Search, ChevronDown, X, Eye, CheckCircle2, XCircle, Clock, ChefHat,
  ReceiptText, Filter, RefreshCcw, User, MapPin, AlertTriangle,
} from "lucide-react";
import { useData, SalesOrder, OrderStatus } from "../../context/DataContext";

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: "待处理", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  preparing: { label: "制作中", color: "bg-blue-100 text-blue-600", icon: ChefHat },
  completed: { label: "已完成", color: "bg-green-100 text-green-600", icon: CheckCircle2 },
  cancelled: { label: "已取消", color: "bg-gray-100 text-gray-400", icon: XCircle },
  refunding: { label: "退款中", color: "bg-orange-100 text-orange-600", icon: RefreshCcw },
  refunded:  { label: "已退款", color: "bg-purple-100 text-purple-500", icon: CheckCircle2 },
};

const REFUND_REASONS = ["商品质量问题", "下单信息有误", "商家无法制作", "等待时间过长", "其他原因"];

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${cfg.color}`} style={{ fontWeight: 500 }}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function RefundModal({ order, onClose, onConfirm }: {
  order: SalesOrder; onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState(REFUND_REASONS[0]);
  const [custom, setCustom] = useState("");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-900" style={{ fontWeight: 700 }}>申请退款</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400"><X size={15} /></button>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 mb-4 flex gap-2">
          <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-amber-700 text-xs">退款后订单状态将变为「退款中」，请确认后处理。</p>
        </div>
        <p className="text-xs text-gray-500 mb-2">退款原因</p>
        <div className="space-y-2 mb-3">
          {REFUND_REASONS.map((r) => (
            <button key={r} onClick={() => setReason(r)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm border transition-colors ${reason === r ? "border-orange-400 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
              style={{ fontWeight: reason === r ? 500 : 400 }}>
              {r}
            </button>
          ))}
        </div>
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="补充说明（选填）" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400 mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">取消</button>
          <button onClick={() => onConfirm(custom.trim() ? `${reason}：${custom.trim()}` : reason)} className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm hover:bg-orange-600" style={{ fontWeight: 600 }}>确认退款</button>
        </div>
      </div>
    </div>
  );
}

function OrderDetailModal({ order, onClose, onStatusChange }: {
  order: SalesOrder;
  onClose: () => void;
  onStatusChange: (status: OrderStatus, refundReason?: string) => void;
}) {
  const [showRefund, setShowRefund] = useState(false);
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
          <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between flex-shrink-0">
            <div>
              <h3 className="text-gray-900" style={{ fontWeight: 700 }}>订单详情</h3>
              <p className="text-gray-400 text-xs mt-0.5">#{order.id.slice(-8).toUpperCase()}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">
              <X size={16} />
            </button>
          </div>

          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
            {/* User / Location Info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
                <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User size={14} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">用户</p>
                  <p className="text-gray-800 text-xs" style={{ fontWeight: 500 }}>桌{order.tableNo}客户</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin size={14} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">位置</p>
                  <p className="text-gray-800 text-xs" style={{ fontWeight: 500 }}>{order.merchantName} · {order.tableNo}号桌</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-1">下单时间</p>
                <p className="text-gray-800 text-xs" style={{ fontWeight: 500 }}>
                  {new Date(order.timestamp).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-1">当前状态</p>
                <StatusBadge status={order.status} />
              </div>
            </div>

            {/* Refund reason if exists */}
            {order.refundReason && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex gap-2">
                <RefreshCcw size={14} className="text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-orange-700 text-xs" style={{ fontWeight: 500 }}>退款原因</p>
                  <p className="text-orange-600 text-xs mt-0.5">{order.refundReason}</p>
                </div>
              </div>
            )}

            <div>
              <p className="text-gray-700 text-sm mb-2" style={{ fontWeight: 600 }}>商品明细</p>
              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-gray-800 text-sm" style={{ fontWeight: 500 }}>{item.beerName}</p>
                      <p className="text-gray-400 text-xs">{item.category} · ¥{item.price}/杯</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 text-sm">×{item.quantity}</p>
                      <p className="text-amber-600 text-sm" style={{ fontWeight: 600 }}>¥{(item.price * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-gray-100">
              <span className="text-gray-500 text-sm">合计</span>
              <span className="text-amber-600" style={{ fontWeight: 700, fontSize: "1.2rem" }}>¥{order.total.toFixed(2)}</span>
            </div>

            {/* Action Buttons */}
            {(order.status === "pending" || order.status === "preparing") && (
              <div className="space-y-2 pt-1">
                <div className="flex gap-3">
                  {order.status === "pending" && (
                    <button onClick={() => { onStatusChange("preparing"); onClose(); }}
                      className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm hover:bg-blue-600" style={{ fontWeight: 600 }}>
                      开始制作
                    </button>
                  )}
                  <button onClick={() => { onStatusChange("completed"); onClose(); }}
                    className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm hover:bg-green-600" style={{ fontWeight: 600 }}>
                    标记完成
                  </button>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowRefund(true)}
                    className="flex-1 py-2.5 rounded-xl bg-orange-50 text-orange-600 text-sm border border-orange-200 hover:bg-orange-100" style={{ fontWeight: 500 }}>
                    申请退款
                  </button>
                  <button onClick={() => { onStatusChange("cancelled"); onClose(); }}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">
                    取消订单
                  </button>
                </div>
              </div>
            )}
            {order.status === "refunding" && (
              <div className="flex gap-3 pt-1">
                <button onClick={() => { onStatusChange("refunded"); onClose(); }}
                  className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white text-sm hover:bg-purple-600" style={{ fontWeight: 600 }}>
                  确认退款完成
                </button>
                <button onClick={() => { onStatusChange("cancelled"); onClose(); }}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">
                  撤销退款
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {showRefund && (
        <RefundModal order={order} onClose={() => setShowRefund(false)}
          onConfirm={(reason) => { onStatusChange("refunding", reason); setShowRefund(false); onClose(); }} />
      )}
    </>
  );
}

type DateFilter = "all" | "today" | "week" | "month";

export default function OrdersAdminPage() {
  const { merchants, orders, updateOrderStatus } = useData();
  const [search, setSearch] = useState("");
  const [merchantFilter, setMerchantFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const filtered = useMemo(() => {
    const now = Date.now();
    return orders.filter((o) => {
      if (merchantFilter !== "all" && o.merchantId !== merchantFilter) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (search && !o.merchantName.includes(search) && !o.tableNo.includes(search) &&
        !o.items.some((i) => i.beerName.includes(search))) return false;
      if (dateFilter === "today") return new Date(o.timestamp).toDateString() === new Date().toDateString();
      if (dateFilter === "week") return now - new Date(o.timestamp).getTime() < 7 * 86400000;
      if (dateFilter === "month") return now - new Date(o.timestamp).getTime() < 30 * 86400000;
      return true;
    });
  }, [orders, merchantFilter, statusFilter, search, dateFilter]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const totalRevenue = filtered.reduce((s, o) => s + o.total, 0);

  const ALL_STATUSES: ("all" | OrderStatus)[] = ["all", "pending", "preparing", "completed", "cancelled", "refunding", "refunded"];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-gray-900" style={{ fontWeight: 700 }}>订单管理</h1>
          <p className="text-gray-400 text-sm">共 {filtered.length} 笔订单 · 合计 ¥{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Filter size={14} />
          <span>筛选后显示 {filtered.length} / {orders.length} 条</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索商家、桌号或商品…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-amber-400"
            />
          </div>
          <div className="relative">
            <select value={merchantFilter} onChange={(e) => { setMerchantFilter(e.target.value); setPage(1); }}
              className="bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-9 py-2.5 text-sm text-gray-700 appearance-none focus:outline-none focus:border-amber-400">
              <option value="all">全部商家</option>
              {merchants.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", "today", "week", "month"] as DateFilter[]).map((d) => (
            <button key={d} onClick={() => { setDateFilter(d); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${dateFilter === d ? "bg-amber-500 text-white border-amber-500" : "border-gray-200 text-gray-400 hover:border-gray-300"}`}
              style={{ fontWeight: dateFilter === d ? 600 : 400 }}>
              {d === "all" ? "全部时间" : d === "today" ? "今天" : d === "week" ? "近7天" : "近30天"}
            </button>
          ))}
          <div className="w-px bg-gray-200 mx-1" />
          {ALL_STATUSES.map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${statusFilter === s ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-400 hover:border-gray-300"}`}
              style={{ fontWeight: statusFilter === s ? 600 : 400 }}>
              {s === "all" ? "全部状态" : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["订单号", "时间", "商家", "桌号", "商品", "金额", "状态", "操作"].map((h) => (
                  <th key={h} className="text-left text-gray-400 text-xs px-5 py-3.5 whitespace-nowrap" style={{ fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((order) => (
                <tr key={order.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-gray-400 text-xs font-mono">
                    #{order.id.slice(-8).toUpperCase()}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-sm whitespace-nowrap">
                    {new Date(order.timestamp).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-5 py-3.5 text-gray-800 text-sm whitespace-nowrap" style={{ fontWeight: 500 }}>
                    {order.merchantName}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">{order.tableNo}</span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-sm max-w-52 truncate">
                    {order.items.map((i) => `${i.beerName}×${i.quantity}`).join("、")}
                  </td>
                  <td className="px-5 py-3.5 text-amber-600 text-sm whitespace-nowrap" style={{ fontWeight: 600 }}>
                    ¥{order.total}
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={order.status} /></td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelectedOrder(order)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="查看详情">
                        <Eye size={14} />
                      </button>
                      {order.status === "pending" && (
                        <button onClick={() => updateOrderStatus(order.id, "preparing")}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors" title="开始制作">
                          <ChefHat size={14} />
                        </button>
                      )}
                      {(order.status === "pending" || order.status === "preparing") && (
                        <button onClick={() => updateOrderStatus(order.id, "completed")}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-50 text-green-500 hover:bg-green-100 transition-colors" title="标记完成">
                          <CheckCircle2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paginated.length === 0 && (
          <div className="text-center py-16 text-gray-300">
            <ReceiptText size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">暂无符合条件的订单</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-50">
            <span className="text-gray-400 text-sm">第 {page} / {totalPages} 页，共 {filtered.length} 条</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-sm disabled:opacity-40 hover:bg-gray-50">
                上一页
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-sm disabled:opacity-40 hover:bg-gray-50">
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={(status, refundReason) => updateOrderStatus(selectedOrder.id, status, refundReason)}
        />
      )}
    </div>
  );
}
