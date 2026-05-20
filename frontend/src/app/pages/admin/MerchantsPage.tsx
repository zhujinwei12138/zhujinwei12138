import { useState, useMemo } from "react";
import {
  Plus, Pencil, Trash2, X, Search, CheckCircle2, XCircle,
  Store, Phone, MapPin, TrendingUp, ShoppingBag, ToggleLeft, ToggleRight,
} from "lucide-react";
import { useData, Merchant } from "../../context/DataContext";

interface MerchantFormData {
  name: string;
  address: string;
  phone: string;
  status: "active" | "inactive";
}

function MerchantModal({ initial, onSave, onClose }: {
  initial?: Merchant | null;
  onSave: (data: MerchantFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<MerchantFormData>({
    name: initial?.name ?? "",
    address: initial?.address ?? "",
    phone: initial?.phone ?? "",
    status: initial?.status ?? "active",
  });
  const [errors, setErrors] = useState<Partial<MerchantFormData>>({});

  const validate = () => {
    const e: Partial<MerchantFormData> = {};
    if (!form.name.trim()) e.name = "请输入商家名称";
    if (!form.address.trim()) e.address = "请输入地址";
    if (!form.phone.trim()) e.phone = "请输入联系电话";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try { await onSave(form); onClose(); } catch { /* parent shows error */ }
  };

  const fields = [
    { key: "name", label: "商家名称", placeholder: "例：老张精酿啤酒馆", icon: Store },
    { key: "address", label: "经营地址", placeholder: "详细地址", icon: MapPin },
    { key: "phone", label: "联系电话", placeholder: "例：010-12345678", icon: Phone },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-gray-900" style={{ fontWeight: 700 }}>
            {initial ? "编辑商家信息" : "添加新商家"}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {fields.map(({ key, label, placeholder, icon: Icon }) => (
            <div key={key}>
              <label className="text-gray-700 text-sm block mb-1.5" style={{ fontWeight: 500 }}>{label}</label>
              <div className="relative">
                <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setErrors((e2) => ({ ...e2, [key]: undefined })); }}
                  className={`w-full bg-gray-50 border rounded-xl pl-10 pr-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:bg-white transition-colors ${errors[key] ? "border-red-400" : "border-gray-200 focus:border-amber-400"}`}
                />
              </div>
              {errors[key] && <p className="text-red-500 text-xs mt-1">{errors[key]}</p>}
            </div>
          ))}

          <div>
            <label className="text-gray-700 text-sm block mb-2" style={{ fontWeight: 500 }}>营业状态</label>
            <div className="flex gap-3">
              {(["active", "inactive"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setForm((f) => ({ ...f, status: s }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm transition-all ${
                    form.status === s
                      ? s === "active" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-300 bg-gray-50 text-gray-500"
                      : "border-gray-200 text-gray-400"
                  }`}
                  style={{ fontWeight: form.status === s ? 600 : 400 }}
                >
                  {s === "active" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                  {s === "active" ? "营业中" : "暂停营业"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors">
              取消
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm hover:bg-amber-600 transition-colors"
              style={{ fontWeight: 600 }}
            >
              {initial ? "保存修改" : "添加商家"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirm({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={24} className="text-red-500" />
        </div>
        <h3 className="text-gray-900 mb-2" style={{ fontWeight: 700 }}>确认删除商家？</h3>
        <p className="text-gray-400 text-sm mb-1">即将删除：<span className="text-gray-700" style={{ fontWeight: 500 }}>「{name}」</span></p>
        <p className="text-gray-400 text-sm mb-6">该商家的所有订单记录将一并清除，此操作无法撤销。</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">取消</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm hover:bg-red-600" style={{ fontWeight: 600 }}>
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MerchantsPage() {
  const { merchants, orders, addMerchant, updateMerchant, deleteMerchant } = useData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [modal, setModal] = useState<{ open: boolean; merchant: Merchant | null }>({ open: false, merchant: null });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const filtered = useMemo(() =>
    merchants.filter((m) => {
      const matchSearch = m.name.includes(search) || m.address.includes(search) || m.phone.includes(search);
      const matchStatus = statusFilter === "all" || m.status === statusFilter;
      return matchSearch && matchStatus;
    }),
    [merchants, search, statusFilter]
  );

  const getMerchantStats = (id: string) => {
    const mOrders = orders.filter((o) => o.merchantId === id);
    return {
      orders: mOrders.length,
      revenue: mOrders.reduce((s, o) => s + o.total, 0),
      pending: mOrders.filter((o) => o.status === "pending" || o.status === "preparing").length,
    };
  };

  const deletingMerchant = merchants.find((m) => m.id === deleteId);

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl text-sm">
          <CheckCircle2 size={16} className="text-green-400" /> {toast}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-gray-900" style={{ fontWeight: 700 }}>商家管理</h1>
          <p className="text-gray-400 text-sm">共 {merchants.length} 家商家，{merchants.filter((m) => m.status === "active").length} 家营业中</p>
        </div>
        <button
          onClick={() => setModal({ open: true, merchant: null })}
          className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-xl hover:bg-amber-600 transition-colors shadow-md shadow-amber-200"
          style={{ fontWeight: 600 }}
        >
          <Plus size={18} />
          <span className="hidden sm:inline">添加商家</span>
          <span className="sm:hidden">添加</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索商家名称、地址或电话…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-amber-400"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-sm transition-all border ${
                statusFilter === s ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
              }`}
              style={{ fontWeight: statusFilter === s ? 600 : 400 }}
            >
              {s === "all" ? "全部" : s === "active" ? "营业中" : "已停业"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Mobile card list */}
        <div className="lg:hidden divide-y divide-gray-50">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-300">
              <Store size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">暂无符合条件的商家</p>
            </div>
          ) : filtered.map((m) => {
            const stats = getMerchantStats(m.id);
            return (
              <div key={m.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Store size={15} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 text-sm truncate" style={{ fontWeight: 600 }}>{m.name}</p>
                      <p className="text-gray-400 text-xs truncate">{m.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setModal({ open: true, merchant: m })}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteId(m.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 pl-12">
                  <button
                    onClick={() => updateMerchant(m.id, { status: m.status === "active" ? "inactive" : "active" }).catch(() => showToast("更新失败，请重试"))}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${m.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    style={{ fontWeight: 500 }}
                  >
                    {m.status === "active" ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                    {m.status === "active" ? "营业中" : "已停业"}
                  </button>
                  <span className="text-gray-400 text-xs">{m.phone}</span>
                  <span className="text-amber-600 text-xs" style={{ fontWeight: 600 }}>¥{stats.revenue.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {["商家信息", "联系方式", "状态", "订单数", "营业额", "待处理", "入驻时间", "操作"].map((h) => (
                <th key={h} className="text-left text-gray-400 text-xs px-5 py-3.5" style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const stats = getMerchantStats(m.id);
              return (
                <tr key={m.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Store size={16} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="text-gray-900 text-sm" style={{ fontWeight: 600 }}>{m.name}</p>
                        <p className="text-gray-400 text-xs truncate max-w-40">{m.address}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-600 text-sm whitespace-nowrap">{m.phone}</td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => updateMerchant(m.id, { status: m.status === "active" ? "inactive" : "active" }).catch(() => showToast("更新失败，请重试"))}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full transition-colors cursor-pointer ${
                        m.status === "active" ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                      style={{ fontWeight: 500 }}
                      title="点击切换状态"
                    >
                      {m.status === "active" ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      {m.status === "active" ? "营业中" : "已停业"}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-gray-700 text-sm">
                      <ShoppingBag size={13} className="text-gray-400" />
                      {stats.orders} 笔
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-amber-600 text-sm" style={{ fontWeight: 600 }}>
                      <TrendingUp size={13} className="text-amber-400" />
                      ¥{stats.revenue.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {stats.pending > 0
                      ? <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full" style={{ fontWeight: 500 }}>{stats.pending} 笔</span>
                      : <span className="text-gray-300 text-sm">—</span>
                    }
                  </td>
                  <td className="px-5 py-4 text-gray-400 text-sm whitespace-nowrap">{m.createdAt}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setModal({ open: true, merchant: m })}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        title="编辑"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(m.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-300">
              <Store size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">暂无符合条件的商家</p>
            </div>
          )}
        </div>
      </div>

      {modal.open && (
        <MerchantModal
          initial={modal.merchant}
          onSave={async (data) => {
            if (modal.merchant) { await updateMerchant(modal.merchant.id, data); showToast("商家已更新"); }
            else { await addMerchant(data); showToast("商家已添加"); }
          }}
          onClose={() => setModal({ open: false, merchant: null })}
        />
      )}
      {deleteId && deletingMerchant && (
        <DeleteConfirm
          name={deletingMerchant.name}
          onConfirm={async () => { try { await deleteMerchant(deleteId); showToast("商家已删除"); } catch { showToast("删除失败，请重试"); } setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
