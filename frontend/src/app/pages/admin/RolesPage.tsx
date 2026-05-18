import { useState } from "react";
import { Plus, Edit2, Trash2, X, Shield, ShieldCheck, Check, Store } from "lucide-react";
import { useData, AdminUser } from "../../context/DataContext";

const ROLE_CONFIG = {
  super_admin: { label: "超级管理员", color: "#f59e0b", bg: "#fef3c7", icon: ShieldCheck },
  admin: { label: "管理员", color: "#3b82f6", bg: "#dbeafe", icon: Shield },
};

const AVATAR_COLORS = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

type AdminForm = {
  name: string; email: string; phone: string;
  role: "super_admin" | "admin"; merchantIds: string[];
  status: "active" | "inactive"; avatarColor: string;
};

const EMPTY_FORM: AdminForm = {
  name: "", email: "", phone: "", role: "admin", merchantIds: [], status: "active", avatarColor: AVATAR_COLORS[0],
};

function AdminModal({ user, merchants, onClose, onSave }: {
  user: AdminUser | null;
  merchants: { id: string; name: string }[];
  onClose: () => void;
  onSave: (data: Omit<AdminUser, "id" | "createdAt">) => void;
}) {
  const [form, setForm] = useState<AdminForm>(
    user
      ? { name: user.name, email: user.email, phone: user.phone, role: user.role, merchantIds: [...user.merchantIds], status: user.status, avatarColor: user.avatarColor }
      : { ...EMPTY_FORM }
  );
  const [errors, setErrors] = useState<Partial<Record<keyof AdminForm, string>>>({});

  const set = <K extends keyof AdminForm>(k: K, v: AdminForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Partial<Record<keyof AdminForm, string>> = {};
    if (!form.name.trim()) e.name = "必填";
    if (!form.email.trim()) e.email = "必填";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const toggleMerchant = (id: string) => {
    set("merchantIds", form.merchantIds.includes(id) ? form.merchantIds.filter((x) => x !== id) : [...form.merchantIds, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-gray-900" style={{ fontWeight: 700 }}>{user ? "编辑账号" : "新增账号"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Avatar color picker */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white flex-shrink-0" style={{ background: form.avatarColor, fontSize: "1.3rem", fontWeight: 700 }}>
              {form.name ? form.name[0] : "?"}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">头像颜色</p>
              <div className="flex gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button key={c} onClick={() => set("avatarColor", c)}
                    className="w-6 h-6 rounded-full border-2 transition-all"
                    style={{ background: c, borderColor: form.avatarColor === c ? c : "transparent", outline: form.avatarColor === c ? `2px solid ${c}` : "none", outlineOffset: "2px" }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">姓名 *</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="张三" className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400 ${errors.name ? "border-red-400" : "border-gray-200"}`} />
              {errors.name && <p className="text-red-400 text-xs mt-0.5">{errors.name}</p>}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">手机号</label>
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="138xxxx" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">邮箱 *</label>
            <input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="example@email.com" className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400 ${errors.email ? "border-red-400" : "border-gray-200"}`} />
            {errors.email && <p className="text-red-400 text-xs mt-0.5">{errors.email}</p>}
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-2">角色</label>
            <div className="grid grid-cols-2 gap-2">
              {(["super_admin", "admin"] as const).map((r) => {
                const cfg = ROLE_CONFIG[r];
                const Icon = cfg.icon;
                return (
                  <button key={r} onClick={() => set("role", r)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${form.role === r ? "" : "border-gray-200 hover:border-gray-300"}`}
                    style={form.role === r ? { borderColor: cfg.color, background: cfg.bg } : {}}>
                    <Icon size={18} style={{ color: form.role === r ? cfg.color : "#9ca3af" }} />
                    <span className="text-sm" style={{ fontWeight: 500, color: form.role === r ? cfg.color : "#6b7280" }}>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {form.role === "admin" && (
            <div>
              <label className="text-xs text-gray-500 block mb-2">可管理的商家</label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {merchants.map((m) => (
                  <button key={m.id} onClick={() => toggleMerchant(m.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-sm transition-colors ${form.merchantIds.includes(m.id) ? "border-amber-400 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    <Store size={14} />
                    <span className="flex-1">{m.name}</span>
                    {form.merchantIds.includes(m.id) && <Check size={14} className="text-amber-500" />}
                  </button>
                ))}
                {merchants.length === 0 && <p className="text-gray-400 text-xs text-center py-2">暂无商家</p>}
              </div>
            </div>
          )}

          {form.role === "super_admin" && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-200">
              <ShieldCheck size={16} className="text-amber-500" />
              <p className="text-amber-700 text-xs">超级管理员可管理所有商家及系统配置</p>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 block mb-2">账号状态</label>
            <div className="flex gap-2">
              {(["active", "inactive"] as const).map((s) => (
                <button key={s} onClick={() => set("status", s)}
                  className={`flex-1 py-2 rounded-xl border text-sm transition-colors ${form.status === s ? (s === "active" ? "border-green-400 bg-green-50 text-green-700" : "border-red-300 bg-red-50 text-red-600") : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                  style={{ fontWeight: form.status === s ? 500 : 400 }}>
                  {s === "active" ? "启用" : "禁用"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">取消</button>
          <button onClick={() => { if (validate()) onSave({ ...form }); }} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm hover:bg-amber-600" style={{ fontWeight: 600 }}>保存</button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirm({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <h3 className="text-gray-900 mb-1" style={{ fontWeight: 700 }}>确认删除账号？</h3>
        <p className="text-gray-400 text-sm mb-6">「{name}」的账号将被永久删除。</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">取消</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm hover:bg-red-600" style={{ fontWeight: 600 }}>删除</button>
        </div>
      </div>
    </div>
  );
}

export default function RolesPage() {
  const { adminUsers, merchants, addAdminUser, updateAdminUser, deleteAdminUser } = useData();
  const [editUser, setEditUser] = useState<AdminUser | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<"all" | "super_admin" | "admin">("all");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const filtered = adminUsers.filter((u) => filterRole === "all" || u.role === filterRole);

  const handleSave = (data: Omit<AdminUser, "id" | "createdAt">) => {
    if (editUser === null) { addAdminUser(data); showToast("账号已创建"); }
    else if (editUser) { updateAdminUser(editUser.id, data); showToast("账号已更新"); }
    setEditUser(undefined);
  };

  return (
    <div className="p-6 space-y-5">
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl text-sm">
          <Check size={16} className="text-green-400" /> {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900" style={{ fontWeight: 700 }}>角色管理</h1>
          <p className="text-gray-400 text-sm">共 {adminUsers.length} 个账号，管理后台访问权限</p>
        </div>
        <button onClick={() => setEditUser(null)} className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-amber-600 transition-colors" style={{ fontWeight: 600 }}>
          <Plus size={16} /> 新增账号
        </button>
      </div>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        {(["super_admin", "admin"] as const).map((r) => {
          const cfg = ROLE_CONFIG[r];
          const Icon = cfg.icon;
          const count = adminUsers.filter((u) => u.role === r).length;
          return (
            <div key={r} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg }}>
                <Icon size={22} style={{ color: cfg.color }} />
              </div>
              <div>
                <p className="text-gray-900" style={{ fontWeight: 700, fontSize: "1.2rem" }}>{count}</p>
                <p className="text-gray-400 text-xs">{cfg.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {([["all", "全部"], ["super_admin", "超级管理员"], ["admin", "管理员"]] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilterRole(val)}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${filterRole === val ? "bg-amber-500 text-white" : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"}`}
            style={{ fontWeight: filterRole === val ? 600 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-5 py-3 text-left text-xs text-gray-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>账号</th>
                <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>角色</th>
                <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>可管理商家</th>
                <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>状态</th>
                <th className="px-4 py-3 text-right text-xs text-gray-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400 text-sm">暂无账号</td></tr>
              )}
              {filtered.map((u) => {
                const cfg = ROLE_CONFIG[u.role];
                const Icon = cfg.icon;
                const managedMerchants = u.role === "super_admin"
                  ? merchants
                  : merchants.filter((m) => u.merchantIds.includes(m.id));
                return (
                  <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0 text-sm" style={{ background: u.avatarColor, fontWeight: 700 }}>
                          {u.name[0]}
                        </div>
                        <div>
                          <p className="text-gray-900 text-sm" style={{ fontWeight: 500 }}>{u.name}</p>
                          <p className="text-gray-400 text-xs">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs" style={{ background: cfg.bg, color: cfg.color }}>
                        <Icon size={12} />
                        <span style={{ fontWeight: 600 }}>{cfg.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {u.role === "super_admin" ? (
                        <span className="text-gray-400 text-xs">全部商家（{merchants.length}）</span>
                      ) : managedMerchants.length === 0 ? (
                        <span className="text-gray-300 text-xs">未分配</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {managedMerchants.slice(0, 2).map((m) => (
                            <span key={m.id} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs">{m.name}</span>
                          ))}
                          {managedMerchants.length > 2 && <span className="text-gray-400 text-xs">+{managedMerchants.length - 2}</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs ${u.status === "active" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`} style={{ fontWeight: 500 }}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === "active" ? "bg-green-500" : "bg-red-400"}`} />
                        {u.status === "active" ? "启用" : "禁用"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => setEditUser(u)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-amber-100 hover:text-amber-600 transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(u)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-red-100 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editUser !== undefined && (
        <AdminModal user={editUser} merchants={merchants} onClose={() => setEditUser(undefined)} onSave={handleSave} />
      )}
      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          onConfirm={() => { deleteAdminUser(deleteTarget.id); setDeleteTarget(null); showToast("账号已删除"); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
