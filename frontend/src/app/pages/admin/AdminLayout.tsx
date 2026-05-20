import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import {
  LayoutDashboard, Store, ReceiptText, Settings, Beer,
  Menu, X, ChevronRight, Package, Users, LogOut,
} from "lucide-react";
import { useData } from "../../context/DataContext";

const NAV_ITEMS = [
  { to: "/admin", label: "数据概览", icon: LayoutDashboard, end: true },
  { to: "/admin/merchants", label: "商家管理", icon: Store, end: false },
  { to: "/admin/products", label: "商品管理", icon: Package, end: false },
  { to: "/admin/orders", label: "订单管理", icon: ReceiptText, end: false },
  { to: "/admin/roles", label: "角色管理", icon: Users, end: false },
  { to: "/admin/settings", label: "系统设置", icon: Settings, end: false },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { reloadOrders, reloadAdminUsers } = useData();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auth gate
  useEffect(() => {
    if (!localStorage.getItem("adminToken")) {
      navigate("/admin/login", { replace: true });
    } else {
      reloadOrders();
      reloadAdminUsers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/admin/login", { replace: true });
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex flex-col h-full ${mobile ? "" : ""}`}>
      {/* Brand */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <Beer size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">啤酒管理系统</p>
            <p className="text-white/40 text-xs">Beer Admin</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                isActive
                  ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={isActive ? "text-white" : ""} />
                <span style={{ fontWeight: isActive ? 600 : 400 }}>{label}</span>
                {isActive && <ChevronRight size={14} className="ml-auto opacity-60" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 pb-5">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-white/30 hover:text-white/70 text-xs transition-colors"
        >
          <LogOut size={13} />
          退出登录
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col w-64 flex-shrink-0"
        style={{ background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)" }}
      >
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside
            className="relative w-64 flex flex-col z-10"
            style={{ background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)" }}
          >
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white/60"
            >
              <X size={16} />
            </button>
            <Sidebar mobile />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-4 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500"
          >
            <Menu size={18} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-gray-900 text-sm" style={{ fontWeight: 600 }}>管理员</p>
              <p className="text-gray-400 text-xs">系统管理</p>
            </div>
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center text-white text-sm" style={{ fontWeight: 700 }}>
              管
            </div>
            <button
              onClick={handleLogout}
              className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
              title="退出登录"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
