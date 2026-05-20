import { useState } from "react";
import { Database, Beer, Shield, Bell, Globe, CheckCircle2 } from "lucide-react";
import { useData } from "../../context/DataContext";

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h3 className="text-gray-800" style={{ fontWeight: 600 }}>{title}</h3>
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

function SettingRow({ icon: Icon, label, desc, action }: {
  icon: React.ElementType; label: string; desc?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-50">
        <Icon size={17} className="text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800" style={{ fontWeight: 500 }}>{label}</p>
        {desc && <p className="text-gray-400 text-xs mt-0.5">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

const TOGGLE_ITEMS = [
  { label: "新订单桌面通知", desc: "有新订单时发送浏览器通知", icon: Bell },
  { label: "营业额日报", desc: "每天晚上9点汇总当日数据", icon: Globe },
];

export default function SettingsAdminPage() {
  const { merchants, orders } = useData();
  const [toast, setToast] = useState<string | null>(null);
  const [toggles, setToggles] = useState<boolean[]>([true, false]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl text-sm">
          <CheckCircle2 size={16} className="text-green-400" />
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-gray-900" style={{ fontWeight: 700 }}>系统设置</h1>
        <p className="text-gray-400 text-sm">管理系统配置</p>
      </div>

      <SettingSection title="系统信息">
        <SettingRow icon={Beer} label="系统名称" desc="啤酒销售管理系统 v2.0" />
        <SettingRow icon={Database} label="数据存储" desc={`PostgreSQL 数据库 · 商家 ${merchants.length} 家 · 订单 ${orders.length} 笔`} />
        <SettingRow icon={Shield} label="数据安全" desc="数据存储于服务端 PostgreSQL，通过 JWT 鉴权保护" />
      </SettingSection>

      <SettingSection title="通知与提醒">
        {TOGGLE_ITEMS.map((item, idx) => (
          <SettingRow key={item.label} icon={item.icon} label={item.label} desc={item.desc}
            action={
              <button onClick={() => setToggles((prev) => prev.map((v, i) => i === idx ? !v : v))}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${toggles[idx] ? "bg-amber-500" : "bg-gray-200"}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${toggles[idx] ? "right-0.5" : "left-0.5"}`} />
              </button>
            }
          />
        ))}
      </SettingSection>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "商家总数", value: `${merchants.length} 家` },
          { label: "订单总数", value: `${orders.length} 笔` },
          { label: "营业额", value: `¥${orders.reduce((s, o) => s + o.total, 0).toLocaleString()}` },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
            <p className="text-gray-900" style={{ fontWeight: 700, fontSize: "1.3rem" }}>{item.value}</p>
            <p className="text-gray-400 text-xs mt-1">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
