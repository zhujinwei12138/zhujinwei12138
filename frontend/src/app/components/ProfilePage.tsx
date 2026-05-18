import { useState } from "react";
import {
  ArrowLeft, ChevronRight, ShoppingCart, User, Shield, Package,
  Clock, Truck, Star, RefreshCw, Plus, Minus, Trash2, X,
  Check, ChevronDown, MapPin,
} from "lucide-react";
import { useData, OrderStatus } from "../context/DataContext";

export type ProfileView = "main" | "orders" | "cart" | "personalinfo" | "security";

// ─── Sub-page header ─────────────────────────────────────────────────────────
function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100 sticky top-0 z-10">
      <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600">
        <ArrowLeft size={18} />
      </button>
      <h2 className="text-gray-900" style={{ fontWeight: 700 }}>{title}</h2>
    </div>
  );
}

// ─── My Orders Page ───────────────────────────────────────────────────────────
type OrderTab = "pending" | "preparing" | "completed" | "cancelled";

const ORDER_TABS: { id: OrderTab; label: string; icon: React.ElementType }[] = [
  { id: "pending", label: "待付款", icon: Clock },
  { id: "preparing", label: "待收货", icon: Truck },
  { id: "completed", label: "评价", icon: Star },
  { id: "cancelled", label: "退款/售后", icon: RefreshCw },
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "待付款", preparing: "待收货", completed: "已完成", cancelled: "退款/售后",
};
const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "text-yellow-600 bg-yellow-50",
  preparing: "text-blue-600 bg-blue-50",
  completed: "text-green-600 bg-green-50",
  cancelled: "text-gray-400 bg-gray-50",
};

function MyOrdersPage({ onBack }: { onBack: () => void }) {
  const { orders, myOrderIds, updateOrderStatus } = useData();
  const [activeTab, setActiveTab] = useState<OrderTab>("pending");
  const [reviewTarget, setReviewTarget] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);

  const myOrders = orders.filter((o) => myOrderIds.includes(o.id));
  const tabOrders = myOrders.filter((o) => o.status === activeTab);

  const submitReview = () => {
    if (reviewTarget) {
      updateOrderStatus(reviewTarget, "completed");
      setReviewTarget(null);
      setReviewText("");
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-gray-50">
      <SubHeader title="我的订单" onBack={onBack} />

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-100 sticky top-[61px] z-10">
        {ORDER_TABS.map(({ id, label }) => {
          const count = myOrders.filter((o) => o.status === id).length;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 py-3 text-sm relative transition-colors ${activeTab === id ? "text-amber-600" : "text-gray-400"}`}
              style={{ fontWeight: activeTab === id ? 600 : 400 }}
            >
              {label}
              {count > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5" style={{ fontSize: 10 }}>{count}</span>
              )}
              {activeTab === id && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-500 rounded-full" />}
            </button>
          );
        })}
      </div>

      {/* Order List */}
      <div className="flex-1 px-4 py-4 space-y-3">
        {tabOrders.length === 0 ? (
          <div className="text-center py-16 text-gray-300">
            <Package size={48} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">暂无{ORDER_TABS.find((t) => t.id === activeTab)?.label}订单</p>
          </div>
        ) : (
          tabOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>{order.merchantName}</p>
                  <p className="text-gray-400 text-xs">桌号 {order.tableNo} · {new Date(order.timestamp).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status]}`} style={{ fontWeight: 500 }}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
              <div className="space-y-1 mb-3">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.beerName} <span className="text-gray-400">×{item.quantity}</span></span>
                    <span className="text-gray-500">¥{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                <span className="text-gray-500 text-sm">合计 <span className="text-amber-600" style={{ fontWeight: 700 }}>¥{order.total.toFixed(2)}</span></span>
                <div className="flex gap-2">
                  {order.status === "pending" && (
                    <>
                      <button onClick={() => updateOrderStatus(order.id, "cancelled")} className="px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 text-xs">取消订单</button>
                      <button onClick={() => updateOrderStatus(order.id, "preparing")} className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs" style={{ fontWeight: 600 }}>去付款</button>
                    </>
                  )}
                  {order.status === "preparing" && (
                    <button onClick={() => updateOrderStatus(order.id, "completed")} className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs" style={{ fontWeight: 600 }}>确认收货</button>
                  )}
                  {order.status === "completed" && (
                    <button onClick={() => setReviewTarget(order.id)} className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs" style={{ fontWeight: 600 }}>去评价</button>
                  )}
                  {order.status === "cancelled" && (
                    <button className="px-3 py-1.5 rounded-xl border border-amber-400 text-amber-600 text-xs" style={{ fontWeight: 500 }}>申请退款</button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Review Modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900" style={{ fontWeight: 700 }}>写评价</h3>
              <button onClick={() => setReviewTarget(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500"><X size={16} /></button>
            </div>
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setReviewRating(s)}>
                  <Star size={28} className={s <= reviewRating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"} />
                </button>
              ))}
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="分享你的用餐体验…"
              rows={4}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-700 focus:outline-none focus:border-amber-400 resize-none"
            />
            <button onClick={submitReview} className="w-full bg-amber-500 text-white py-3 rounded-2xl mt-3" style={{ fontWeight: 600 }}>提交评价</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cart Page ────────────────────────────────────────────────────────────────
interface CartPageProps {
  onBack: () => void;
  onOrderSuccess: (orderId: string) => void;
  merchantId: string;
  merchantName: string;
  tableNo: string;
}

function CartPage({ onBack, onOrderSuccess, merchantId, merchantName, tableNo }: CartPageProps) {
  const { cart, removeFromCart, updateCartQuantity, clearCart, addOrder, addMyOrderId } = useData();
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const [successAnim, setSuccessAnim] = useState(false);

  const handleCheckout = async () => {
    if (cart.length === 0 || !merchantId) return;
    try {
      const orderId = await addOrder({
        merchantId,
        merchantName,
        tableNo,
        items: cart.map((i) => ({ beerId: i.id, beerName: i.name, category: i.category, quantity: i.quantity, price: i.price })),
        total,
      });
      addMyOrderId(orderId);
      clearCart();
      setSuccessAnim(true);
      setTimeout(() => { setSuccessAnim(false); onOrderSuccess(orderId); }, 1200);
    } catch (e) {
      console.error("Checkout failed", e);
      alert("下单失败，请重试");
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-gray-50">
      <SubHeader title="购物车" onBack={onBack} />

      {successAnim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check size={32} className="text-green-500" />
            </div>
            <p className="text-gray-900" style={{ fontWeight: 700 }}>下单成功！</p>
            <p className="text-gray-400 text-sm mt-1">请稍候，商家正在处理</p>
          </div>
        </div>
      )}

      {cart.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
          <ShoppingCart size={56} className="mb-4 opacity-40" />
          <p>购物车是空的</p>
          <p className="text-xs mt-1">去首页添加想喝的啤酒吧</p>
        </div>
      ) : (
        <>
          <div className="flex-1 px-4 py-4 space-y-3 pb-36">
            <div className="flex items-center justify-between">
              <p className="text-gray-500 text-sm">共 {cart.reduce((s, i) => s + i.quantity, 0)} 件</p>
              <button onClick={clearCart} className="text-gray-400 text-sm flex items-center gap-1">
                <Trash2 size={13} />清空
              </button>
            </div>
            {cart.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-amber-50 flex-shrink-0">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 text-sm" style={{ fontWeight: 600 }}>{item.name}</p>
                  <p className="text-gray-400 text-xs">{item.volume}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-amber-600" style={{ fontWeight: 700 }}>¥{item.price}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateCartQuantity(item.id, item.quantity - 1)} className="w-7 h-7 rounded-full border border-amber-400 flex items-center justify-center text-amber-500">
                        <Minus size={12} />
                      </button>
                      <span className="text-gray-900 text-sm min-w-[20px] text-center" style={{ fontWeight: 600 }}>{item.quantity}</span>
                      <button onClick={() => updateCartQuantity(item.id, item.quantity + 1)} className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white">
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 px-4 py-4 pb-6">
            {!merchantId && (
              <p className="text-red-500 text-xs text-center mb-2">请先在首页选择商家和桌号</p>
            )}
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-500">合计</span>
              <span className="text-amber-600" style={{ fontWeight: 700, fontSize: "1.3rem" }}>¥{total.toFixed(2)}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={!merchantId || !tableNo}
              className="w-full bg-amber-500 text-white py-3.5 rounded-2xl disabled:opacity-40 active:scale-95 transition-transform"
              style={{ fontWeight: 600 }}
            >
              提交订单
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Personal Info Page ───────────────────────────────────────────────────────
function PersonalInfoPage({ onBack }: { onBack: () => void }) {
  const { userProfile, updateUserProfile } = useData();
  const [form, setForm] = useState({ ...userProfile });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateUserProfile(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col flex-1 bg-gray-50">
      <SubHeader title="个人信息" onBack={onBack} />
      <div className="px-4 py-6 space-y-4">
        {/* Avatar */}
        <div className="flex justify-center mb-2">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center text-white text-2xl" style={{ fontWeight: 700 }}>
              {form.name[0] ?? "酒"}
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full border-2 border-gray-100 flex items-center justify-center">
              <span className="text-sm">✏️</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden shadow-sm border border-gray-100">
          {[
            { label: "昵称", key: "name", type: "text", placeholder: "请输入昵称" },
            { label: "手机号", key: "phone", type: "tel", placeholder: "请输入手机号" },
            { label: "邮箱", key: "email", type: "email", placeholder: "请输入邮箱" },
            { label: "生日", key: "birthday", type: "date", placeholder: "" },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key} className="flex items-center px-4 py-3.5">
              <span className="text-gray-500 text-sm w-20 flex-shrink-0">{label}</span>
              <input
                type={type}
                placeholder={placeholder}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="flex-1 text-gray-800 text-sm bg-transparent focus:outline-none text-right"
              />
            </div>
          ))}
          <div className="flex items-center px-4 py-3.5">
            <span className="text-gray-500 text-sm w-20 flex-shrink-0">性别</span>
            <div className="flex-1 flex justify-end gap-3">
              {(["male", "female", "private"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setForm((f) => ({ ...f, gender: g }))}
                  className={`px-3 py-1 rounded-full text-xs border transition-all ${form.gender === g ? "bg-amber-500 text-white border-amber-500" : "border-gray-200 text-gray-400"}`}
                >
                  {g === "male" ? "男" : g === "female" ? "女" : "保密"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          className={`w-full py-3.5 rounded-2xl text-white transition-colors ${saved ? "bg-green-500" : "bg-amber-500"}`}
          style={{ fontWeight: 600 }}
        >
          {saved ? "✓ 保存成功" : "保存修改"}
        </button>
      </div>
    </div>
  );
}

// ─── Account Security Page ────────────────────────────────────────────────────
function AccountSecurityPage({ onBack }: { onBack: () => void }) {
  const [phoneModal, setPhoneModal] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [toast, setToast] = useState("");

  const sendCode = () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) { setToast("请输入正确的手机号"); return; }
    setCountdown(60);
    const t = setInterval(() => setCountdown((c) => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
    setToast("验证码已发送");
    setTimeout(() => setToast(""), 2000);
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2000); };

  const items = [
    { label: "登录密码", desc: "已设置", action: () => setPwModal(true) },
    { label: "绑定手机", desc: "138****8888", action: () => setPhoneModal(true) },
    { label: "账号注销", desc: "注销后数据无法恢复", action: () => showToast("该功能暂不支持"), danger: true },
  ];

  return (
    <div className="flex flex-col flex-1 bg-gray-50">
      <SubHeader title="账号与安全" onBack={onBack} />

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <div className="px-4 py-4 space-y-3">
        <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden shadow-sm border border-gray-100">
          {items.map(({ label, desc, action, danger }) => (
            <button key={label} onClick={action} className="flex items-center w-full px-4 py-4 text-left">
              <div className="flex-1">
                <p className={`text-sm ${danger ? "text-red-500" : "text-gray-800"}`} style={{ fontWeight: 500 }}>{label}</p>
                <p className="text-gray-400 text-xs mt-0.5">{desc}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden shadow-sm border border-gray-100">
          <button className="flex items-center w-full px-4 py-4" onClick={() => showToast("已退出登录")}>
            <span className="flex-1 text-red-500 text-sm text-center" style={{ fontWeight: 600 }}>退出登录</span>
          </button>
        </div>
      </div>

      {/* Phone Modal */}
      {phoneModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900" style={{ fontWeight: 700 }}>更换手机号</h3>
              <button onClick={() => setPhoneModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <input type="tel" placeholder="请输入新手机号" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400" />
              <div className="flex gap-2">
                <input type="text" placeholder="验证码" value={code} onChange={(e) => setCode(e.target.value)}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400" />
                <button onClick={sendCode} disabled={countdown > 0}
                  className="flex-shrink-0 bg-amber-50 text-amber-600 px-4 py-3 rounded-xl text-sm disabled:opacity-50" style={{ fontWeight: 500 }}>
                  {countdown > 0 ? `${countdown}s` : "获取验证码"}
                </button>
              </div>
              <button onClick={() => { showToast("手机号更换成功"); setPhoneModal(false); }}
                className="w-full bg-amber-500 text-white py-3 rounded-2xl" style={{ fontWeight: 600 }}>
                确认更换
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {pwModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900" style={{ fontWeight: 700 }}>修改密码</h3>
              <button onClick={() => setPwModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              {["旧密码", "新密码", "确认新密码"].map((p) => (
                <input key={p} type="password" placeholder={p}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400" />
              ))}
              <button onClick={() => { showToast("密码修改成功"); setPwModal(false); }}
                className="w-full bg-amber-500 text-white py-3 rounded-2xl" style={{ fontWeight: 600 }}>
                确认修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Profile Main Page ────────────────────────────────────────────────────────
interface ProfilePageProps {
  view: ProfileView;
  onNavigate: (v: ProfileView) => void;
  merchantId: string;
  merchantName: string;
  tableNo: string;
  onOrderSuccess: (id: string) => void;
}

export function ProfilePage({ view, onNavigate, merchantId, merchantName, tableNo, onOrderSuccess }: ProfilePageProps) {
  const { userProfile, orders, myOrderIds, cart } = useData();
  const myOrders = orders.filter((o) => myOrderIds.includes(o.id));
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const orderQuickStats = {
    pending: myOrders.filter((o) => o.status === "pending").length,
    preparing: myOrders.filter((o) => o.status === "preparing").length,
    completed: myOrders.filter((o) => o.status === "completed").length,
    cancelled: myOrders.filter((o) => o.status === "cancelled").length,
  };

  if (view === "orders") return <MyOrdersPage onBack={() => onNavigate("main")} />;
  if (view === "cart") return <CartPage onBack={() => onNavigate("main")} onOrderSuccess={onOrderSuccess} merchantId={merchantId} merchantName={merchantName} tableNo={tableNo} />;
  if (view === "personalinfo") return <PersonalInfoPage onBack={() => onNavigate("main")} />;
  if (view === "security") return <AccountSecurityPage onBack={() => onNavigate("main")} />;

  // Main profile view
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {/* Profile Header */}
      <div className="px-4 pt-6 pb-8 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-8 w-32 h-32 bg-amber-500 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-4 w-24 h-24 bg-amber-400 rounded-full blur-2xl" />
        </div>
        <div className="relative flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center text-white text-2xl flex-shrink-0" style={{ fontWeight: 700 }}>
            {userProfile.name[0] ?? "酒"}
          </div>
          <div className="flex-1">
            <p className="text-white" style={{ fontWeight: 700, fontSize: "1.1rem" }}>{userProfile.name}</p>
            <p className="text-white/50 text-sm">{userProfile.phone}</p>
            <span className="inline-block mt-1 bg-amber-500/30 text-amber-300 text-xs px-2.5 py-0.5 rounded-full border border-amber-500/40">
              🍺 精酿达人
            </span>
          </div>
          <button onClick={() => onNavigate("personalinfo")} className="text-white/40">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-3 pb-24">
        {/* My Orders Quick Access */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="text-gray-800" style={{ fontWeight: 600 }}>我的订单</span>
            <button onClick={() => onNavigate("orders")} className="text-gray-400 text-sm flex items-center gap-0.5">
              全部订单 <ChevronRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-4">
            {ORDER_TABS.map(({ id, label, icon: Icon }) => {
              const count = orderQuickStats[id];
              return (
                <button key={id} onClick={() => onNavigate("orders")} className="flex flex-col items-center gap-2 py-4 hover:bg-gray-50 transition-colors">
                  <div className="relative">
                    <Icon size={24} className="text-gray-600" strokeWidth={1.5} />
                    {count > 0 && (
                      <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-red-500 rounded-full text-white flex items-center justify-center" style={{ fontSize: 10, fontWeight: 700 }}>
                        {count}
                      </span>
                    )}
                  </div>
                  <span className="text-gray-500 text-xs">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Functions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
          {[
            {
              icon: ShoppingCart, label: "购物车", desc: cartCount > 0 ? `${cartCount} 件商品待结算` : "去选购你喜欢的啤酒",
              badge: cartCount, action: () => onNavigate("cart"),
            },
            { icon: User, label: "个人信息", desc: "昵称、手机号、生日", action: () => onNavigate("personalinfo") },
            { icon: Shield, label: "账号与安全", desc: "密码、手机绑定、账号注销", action: () => onNavigate("security") },
          ].map(({ icon: Icon, label, desc, badge, action }) => (
            <button key={label} onClick={action} className="flex items-center gap-3 w-full px-4 py-4 text-left hover:bg-gray-50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Icon size={20} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-800 text-sm" style={{ fontWeight: 500 }}>{label}</p>
                <p className="text-gray-400 text-xs">{desc}</p>
              </div>
              {badge !== undefined && badge > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5" style={{ fontWeight: 600 }}>{badge}</span>
              )}
              <ChevronRight size={16} className="text-gray-300" />
            </button>
          ))}
        </div>

        {/* Other */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
          {[
            { label: "关于我们", desc: "啤酒点单系统 v2.0" },
            { label: "联系客服", desc: "在线时间 9:00–22:00" },
          ].map(({ label, desc }) => (
            <button key={label} className="flex items-center w-full px-4 py-3.5 text-left">
              <div className="flex-1">
                <p className="text-gray-700 text-sm" style={{ fontWeight: 500 }}>{label}</p>
                <p className="text-gray-400 text-xs">{desc}</p>
              </div>
              <ChevronRight size={15} className="text-gray-300" />
            </button>
          ))}
        </div>

        {/* Current session info */}
        {merchantName && (
          <div className="bg-amber-50 rounded-2xl px-4 py-3 border border-amber-100 flex items-center gap-2">
            <MapPin size={14} className="text-amber-500 flex-shrink-0" />
            <p className="text-amber-700 text-sm">当前：{merchantName} · 桌号 {tableNo || "--"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
