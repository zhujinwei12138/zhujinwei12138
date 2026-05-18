import { useState, useEffect, useMemo } from "react";
import { ShoppingCart, MapPin, ChevronDown, Home, User } from "lucide-react";
import { BeerCard, Beer } from "../components/BeerCard";
import { ProductDetail } from "../components/ProductDetail";
import { ProfilePage, ProfileView } from "../components/ProfilePage";
import { useData } from "../context/DataContext";

type MainTab = "home" | "profile";
type AppView = "home" | "detail" | "profile";

function SetupOverlay({ merchants, onConfirm }: {
  merchants: { id: string; name: string; status: string }[];
  onConfirm: (merchantId: string, tableNo: string) => void;
}) {
  const active = merchants.filter((m) => m.status === "active");
  const [merchantId, setMerchantId] = useState(active[0]?.id ?? "");
  const [tableNo, setTableNo] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-gray-900/90 backdrop-blur-sm flex items-center justify-center px-6">
      <div className="bg-white rounded-3xl p-7 w-full max-w-xs shadow-2xl">
        <div className="text-center mb-6">
          <span className="text-4xl">🍺</span>
          <h2 className="text-gray-900 mt-2">欢迎扫码点单</h2>
          <p className="text-gray-400 text-sm mt-1">请选择商家并输入桌号</p>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-gray-600 text-sm block mb-1.5">选择商家</label>
            <div className="relative">
              <select value={merchantId} onChange={(e) => setMerchantId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-9 text-gray-900 appearance-none focus:outline-none focus:border-amber-400">
                {active.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-gray-600 text-sm block mb-1.5">桌号</label>
            <input type="text" placeholder="例如：A08" value={tableNo}
              onChange={(e) => setTableNo(e.target.value.toUpperCase())}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-400" />
          </div>
          <button onClick={() => merchantId && tableNo.trim() && onConfirm(merchantId, tableNo.trim())}
            disabled={!merchantId || !tableNo.trim()}
            className="w-full bg-amber-500 text-white py-3.5 rounded-2xl disabled:opacity-40 active:scale-95 transition-transform"
            style={{ fontWeight: 600 }}>
            确认入座，开始点单
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrderPage() {
  const { merchants, products, productCategories, cart, addToCart, removeFromCart, updateCartQuantity } = useData();

  // Convert products from API to Beer shape expected by BeerCard
  const beers: Beer[] = useMemo(() =>
    products
      .filter((p) => p.isAvailable)
      .map((p) => ({
        id: Number(p.id),
        name: p.name,
        nameEn: p.name,
        category: p.category,
        price: p.price,
        volume: p.volume,
        desc: p.description,
        image: p.image,
        tag: p.tags[0],
      })),
  [products]);

  const CATEGORIES = useMemo(() => ["全部", ...productCategories], [productCategories]);

  const [mainTab, setMainTab] = useState<MainTab>("home");
  const [appView, setAppView] = useState<AppView>("home");
  const [profileView, setProfileView] = useState<ProfileView>("main");
  const [selectedBeer, setSelectedBeer] = useState<Beer | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [merchantId, setMerchantId] = useState<string>(() => localStorage.getItem("order_merchantId") ?? "");
  const [tableNo, setTableNo] = useState<string>(() => localStorage.getItem("order_tableNo") ?? "");
  const [showSetup, setShowSetup] = useState(false);

  const activeMerchants = merchants.filter((m) => m.status === "active");
  const currentMerchant = merchants.find((m) => m.id === merchantId);

  useEffect(() => {
    if (!merchantId || !tableNo || !currentMerchant) setShowSetup(true);
  }, []);

  const handleSetupConfirm = (mid: string, tno: string) => {
    setMerchantId(mid);
    setTableNo(tno);
    localStorage.setItem("order_merchantId", mid);
    localStorage.setItem("order_tableNo", tno);
    setShowSetup(false);
  };

  const handleBeerCardClick = (beer: Beer) => {
    setSelectedBeer(beer);
    setAppView("detail");
  };

  const handleBackFromDetail = () => {
    setAppView("home");
    setSelectedBeer(null);
  };

  const handleTabChange = (tab: MainTab) => {
    setMainTab(tab);
    setAppView(tab === "home" ? "home" : "profile");
    setProfileView("main");
  };

  const handleNavigateProfile = (view: ProfileView) => {
    setProfileView(view);
  };

  const handleOrderSuccess = () => {
    setProfileView("orders");
  };

  // Cart computed
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const getQty = (id: number) => cart.find((i) => i.id === id)?.quantity ?? 0;

  const handleAdd = (beer: Beer) => {
    addToCart({ id: beer.id, name: beer.name, category: beer.category, price: beer.price, volume: beer.volume, image: beer.image, tag: beer.tag });
  };
  const handleRemove = (beerId: number) => {
    const item = cart.find((i) => i.id === beerId);
    if (item) updateCartQuantity(beerId, item.quantity - 1);
  };

  const filteredBeers = selectedCategory === "全部" ? beers : beers.filter((b) => b.category === selectedCategory);
  const isSubPage = appView === "detail" || (appView === "profile" && profileView !== "main");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative overflow-hidden">
      {showSetup && <SetupOverlay merchants={activeMerchants} onConfirm={handleSetupConfirm} />}

      {/* Header — hidden on sub-pages */}
      {!isSubPage && (
        <div className="sticky top-0 z-30 px-4 pt-5 pb-3 flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-white truncate" style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                {currentMerchant?.name ?? "请选择商家"}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <MapPin size={11} className="text-amber-400" />
                <span className="text-amber-400 text-xs">营业中</span>
              </div>
            </div>
            <div className="bg-amber-500/20 border border-amber-500/40 rounded-xl px-3 py-1.5 text-center ml-2">
              <p className="text-amber-300 text-xs leading-none">桌号</p>
              <p className="text-white leading-tight" style={{ fontWeight: 700, fontSize: "1rem" }}>{tableNo || "--"}</p>
            </div>
          </div>

          {mainTab === "home" && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm transition-all ${selectedCategory === cat ? "bg-amber-500 text-white" : "bg-white/10 text-white/70"}`}
                  style={{ fontWeight: selectedCategory === cat ? 600 : 400 }}>
                  {cat}
                </button>
              ))}
            </div>
          )}
          {mainTab === "profile" && (
            <p className="text-white/50 text-sm pb-1">个人中心</p>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Home / Beer list */}
        {appView === "home" && (
          <div className="flex-1 px-4 py-4 pb-32">
            <div className="grid grid-cols-2 gap-3">
              {filteredBeers.map((beer) => (
                <BeerCard
                  key={beer.id}
                  beer={beer}
                  quantity={getQty(beer.id)}
                  onAdd={handleAdd}
                  onRemove={handleRemove}
                  onCardClick={handleBeerCardClick}
                />
              ))}
            </div>
          </div>
        )}

        {/* Product Detail */}
        {appView === "detail" && selectedBeer && (
          <ProductDetail beer={selectedBeer} onBack={handleBackFromDetail} />
        )}

        {/* Profile */}
        {appView === "profile" && (
          <ProfilePage
            view={profileView}
            onNavigate={handleNavigateProfile}
            merchantId={merchantId}
            merchantName={currentMerchant?.name ?? ""}
            tableNo={tableNo}
            onOrderSuccess={handleOrderSuccess}
          />
        )}
      </div>

      {/* Floating Cart Bar — only on home tab, not on detail */}
      {mainTab === "home" && appView === "home" && cartCount > 0 && (
        <div className="fixed bottom-16 left-0 right-0 max-w-md mx-auto z-20 px-4 pb-2 pt-1">
          <button
            onClick={() => { handleTabChange("profile"); setProfileView("cart"); }}
            className="w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl shadow-xl text-white active:scale-98 transition-transform"
            style={{ background: "linear-gradient(90deg, #1a1a2e 0%, #16213e 80%)" }}>
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
                <ShoppingCart size={17} />
              </div>
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center" style={{ fontWeight: 700 }}>
                {cartCount}
              </span>
            </div>
            <div className="flex-1 text-left">
              <p className="text-white/60 text-xs">已选 {cartCount} 件</p>
              <p className="text-amber-400" style={{ fontWeight: 700 }}>¥{cartTotal.toFixed(2)}</p>
            </div>
            <div className="bg-amber-500 px-4 py-2 rounded-xl text-sm" style={{ fontWeight: 600 }}>去结算</div>
          </button>
        </div>
      )}

      {/* Bottom Tab Bar */}
      {!isSubPage && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-30 bg-white border-t border-gray-100 flex">
          {[
            { id: "home" as MainTab, label: "首页", icon: Home },
            { id: "profile" as MainTab, label: "我的", icon: User, badge: cartCount },
          ].map(({ id, label, icon: Icon, badge }) => (
            <button key={id} onClick={() => handleTabChange(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 relative transition-colors ${mainTab === id ? "text-amber-500" : "text-gray-400"}`}>
              <div className="relative">
                <Icon size={22} strokeWidth={mainTab === id ? 2.2 : 1.7} />
                {badge !== undefined && badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-red-500 rounded-full text-white flex items-center justify-center px-1" style={{ fontSize: 10, fontWeight: 700 }}>
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              <span className="text-xs" style={{ fontWeight: mainTab === id ? 600 : 400 }}>{label}</span>
              {mainTab === id && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-500 rounded-full" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
