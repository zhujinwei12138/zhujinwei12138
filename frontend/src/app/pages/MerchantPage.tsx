import { useState, useEffect, useRef, useCallback } from "react";
import {
  Beer, Bell, BellOff, CheckCircle2, ChefHat, Clock, XCircle,
  Store, LogOut, RefreshCcw, ChevronDown, Volume2, VolumeX,
} from "lucide-react";
import { useData, SalesOrder, OrderStatus } from "../context/DataContext";

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: "待处理", color: "#d97706", bg: "#fef3c7" },
  preparing: { label: "制作中", color: "#2563eb", bg: "#dbeafe" },
  completed: { label: "已完成", color: "#16a34a", bg: "#dcfce7" },
  cancelled: { label: "已取消", color: "#9ca3af", bg: "#f3f4f6" },
  refunding: { label: "退款中", color: "#ea580c", bg: "#ffedd5" },
  refunded:  { label: "已退款", color: "#7c3aed", bg: "#ede9fe" },
};

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch (_) {}
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function sendBrowserNotification(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "" });
  }
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs" style={{ background: cfg.bg, color: cfg.color, fontWeight: 600 }}>
      {cfg.label}
    </span>
  );
}

function OrderCard({ order, onAction }: {
  order: SalesOrder;
  onAction: (id: string, status: OrderStatus) => void;
}) {
  const isNew = order.status === "pending";
  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isNew ? "border-amber-300 shadow-amber-100" : "border-gray-100"}`}>
      {isNew && (
        <div className="bg-amber-500 px-4 py-1.5 flex items-center gap-2">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-white text-xs" style={{ fontWeight: 600 }}>新订单</span>
          <span className="text-amber-100 text-xs ml-auto">{new Date(order.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-gray-900 text-sm" style={{ fontWeight: 700 }}>
              {order.tableNo}号桌
            </p>
            <p className="text-gray-400 text-xs">
              {!isNew && new Date(order.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <div className="space-y-1.5 mb-4">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{item.beerName} <span className="text-gray-400">×{item.quantity}</span></span>
              <span className="text-gray-500">¥{item.price * item.quantity}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4 pt-2 border-t border-gray-50">
          <span className="text-gray-400 text-xs">合计</span>
          <span className="text-amber-600" style={{ fontWeight: 700 }}>¥{order.total.toFixed(2)}</span>
        </div>

        {order.status === "pending" && (
          <div className="flex gap-2">
            <button onClick={() => onAction(order.id, "preparing")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500 text-white text-sm hover:bg-amber-600 active:scale-95 transition-all" style={{ fontWeight: 600 }}>
              <ChefHat size={15} /> 接单
            </button>
            <button onClick={() => onAction(order.id, "cancelled")}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-400 text-sm hover:bg-gray-50 active:scale-95 transition-all">
              拒绝
            </button>
          </div>
        )}
        {order.status === "preparing" && (
          <button onClick={() => onAction(order.id, "completed")}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-500 text-white text-sm hover:bg-green-600 active:scale-95 transition-all" style={{ fontWeight: 600 }}>
            <CheckCircle2 size={15} /> 完成出餐
          </button>
        )}
      </div>
    </div>
  );
}

type FilterTab = "active" | "pending" | "preparing" | "completed" | "all";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "active", label: "待处理" },
  { key: "preparing", label: "制作中" },
  { key: "completed", label: "已完成" },
  { key: "all", label: "全部" },
];

function LoginScreen({ merchants, onLogin }: {
  merchants: { id: string; name: string; status: string }[];
  onLogin: (merchantId: string) => void;
}) {
  const active = merchants.filter((m) => m.status === "active");
  const [selected, setSelected] = useState(active[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleLogin = () => {
    if (password !== "1234") { setError(true); return; }
    if (!selected) return;
    onLogin(selected);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-6">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Beer size={32} className="text-white" />
          </div>
          <h1 className="text-white" style={{ fontWeight: 700, fontSize: "1.3rem" }}>商家管理</h1>
          <p className="text-gray-400 text-sm mt-1">啤酒销售管理小程序</p>
        </div>

        <div className="bg-white rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-gray-500 text-xs block mb-1.5">选择商家</label>
            <div className="relative">
              <select value={selected} onChange={(e) => setSelected(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-9 text-gray-900 text-sm appearance-none focus:outline-none focus:border-amber-400">
                {active.length === 0 && <option value="">暂无活跃商家</option>}
                {active.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-gray-500 text-xs block mb-1.5">密码</label>
            <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(false); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="输入登录密码" className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 ${error ? "border-red-400" : "border-gray-200"}`} />
            {error && <p className="text-red-400 text-xs mt-1">密码错误，默认密码：1234</p>}
          </div>
          <button onClick={handleLogin} disabled={!selected}
            className="w-full bg-amber-500 text-white py-3 rounded-xl text-sm hover:bg-amber-600 disabled:opacity-40 transition-colors" style={{ fontWeight: 600 }}>
            进入商家后台
          </button>
          <p className="text-gray-300 text-xs text-center">默认密码：1234</p>
        </div>
      </div>
    </div>
  );
}

export default function MerchantPage() {
  const { merchants, orders, updateOrderStatus } = useData();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>("active");
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastOrderCountRef = useRef<number>(0);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());

  const merchant = merchants.find((m) => m.id === merchantId);
  const myOrders = orders.filter((o) => o.merchantId === merchantId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const pendingCount = myOrders.filter((o) => o.status === "pending").length;
  const preparingCount = myOrders.filter((o) => o.status === "preparing").length;

  const filteredOrders = myOrders.filter((o) => {
    if (tab === "active") return o.status === "pending";
    if (tab === "preparing") return o.status === "preparing";
    if (tab === "completed") return o.status === "completed" || o.status === "refunded";
    return true;
  });

  const checkNewOrders = useCallback(() => {
    if (!merchantId) return;
    const currentIds = new Set(myOrders.map((o) => o.id));
    const newOrders = myOrders.filter((o) => !knownOrderIdsRef.current.has(o.id) && o.status === "pending");
    if (newOrders.length > 0 && knownOrderIdsRef.current.size > 0) {
      if (soundEnabled) playBeep();
      if (notifEnabled) {
        newOrders.forEach((o) => {
          sendBrowserNotification(`${merchant?.name ?? "商家"} - 新订单！`, `${o.tableNo}号桌下单 ¥${o.total}`);
        });
      }
    }
    knownOrderIdsRef.current = currentIds;
  }, [merchantId, myOrders, soundEnabled, notifEnabled, merchant]);

  useEffect(() => {
    checkNewOrders();
  }, [checkNewOrders]);

  useEffect(() => {
    const handleStorage = () => checkNewOrders();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [checkNewOrders]);

  useEffect(() => {
    if (!merchantId) return;
    const interval = setInterval(checkNewOrders, 3000);
    return () => clearInterval(interval);
  }, [checkNewOrders, merchantId]);

  const handleLogin = (mid: string) => {
    setMerchantId(mid);
    knownOrderIdsRef.current = new Set(orders.filter((o) => o.merchantId === mid).map((o) => o.id));
    requestNotificationPermission();
  };

  const handleAction = (orderId: string, status: OrderStatus) => {
    updateOrderStatus(orderId, status);
  };

  if (!merchantId || !merchant) {
    return <LoginScreen merchants={merchants} onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 flex-shrink-0" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center">
              <Store size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-white" style={{ fontWeight: 700, fontSize: "1rem" }}>{merchant.name}</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                <span className="text-green-400 text-xs">营业中</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSoundEnabled((v) => !v)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button onClick={() => setNotifEnabled((v) => !v)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
              {notifEnabled ? <Bell size={16} /> : <BellOff size={16} />}
            </button>
            <button onClick={() => setMerchantId(null)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: "待处理", value: pendingCount, color: "#f59e0b" },
            { label: "制作中", value: preparingCount, color: "#3b82f6" },
            { label: "今日完成", value: myOrders.filter((o) => o.status === "completed" && new Date(o.timestamp).toDateString() === new Date().toDateString()).length, color: "#10b981" },
          ].map((s) => (
            <div key={s.label} className="bg-white/10 rounded-xl px-3 py-2 text-center">
              <p className="text-white" style={{ fontWeight: 700, fontSize: "1.2rem", color: s.color }}>{s.value}</p>
              <p className="text-white/50 text-xs">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-100 px-2 flex-shrink-0">
        {TABS.map((t) => {
          const badge = t.key === "active" ? pendingCount : t.key === "preparing" ? preparingCount : 0;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-sm relative transition-colors ${tab === t.key ? "text-amber-600" : "text-gray-400"}`}
              style={{ fontWeight: tab === t.key ? 600 : 400 }}>
              {t.label}
              {badge > 0 && (
                <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center" style={{ fontSize: 10, fontWeight: 700 }}>{badge}</span>
              )}
              {tab === t.key && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-500 rounded-full" />}
            </button>
          );
        })}
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-6">
        {filteredOrders.length === 0 && (
          <div className="text-center py-16">
            {tab === "active" ? (
              <>
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={28} className="text-green-400" />
                </div>
                <p className="text-gray-400 text-sm">暂无待处理订单</p>
                <p className="text-gray-300 text-xs mt-1">有新订单时会立即通知</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Clock size={28} className="text-gray-300" />
                </div>
                <p className="text-gray-400 text-sm">暂无订单</p>
              </>
            )}
          </div>
        )}
        {filteredOrders.map((order) => (
          <OrderCard key={order.id} order={order} onAction={handleAction} />
        ))}
      </div>

      {/* Notification permission hint */}
      {"Notification" in window && Notification.permission === "denied" && (
        <div className="mx-4 mb-4 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <BellOff size={15} className="text-orange-400 flex-shrink-0" />
          <p className="text-orange-600 text-xs">浏览器通知已被禁用，新订单将不会发送桌面通知</p>
        </div>
      )}
    </div>
  );
}
