import { useState } from "react";
import {
  Plus, Search, Edit2, Trash2, Package, Tag, X, Check, ToggleLeft, ToggleRight, ChevronDown,
} from "lucide-react";
import { useData, Product } from "../../context/DataContext";

const COLOR_PRESETS = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

function TagBadge({ label, color = "#f59e0b", onRemove }: { label: string; color?: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: color + "22", color }}>
      {label}
      {onRemove && <button onClick={onRemove} className="hover:opacity-70"><X size={10} /></button>}
    </span>
  );
}

function AvailabilityToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex items-center gap-1.5 text-sm">
      {value
        ? <ToggleRight size={22} className="text-amber-500" />
        : <ToggleLeft size={22} className="text-gray-300" />}
      <span className={value ? "text-amber-600" : "text-gray-400"}>{value ? "上架" : "下架"}</span>
    </button>
  );
}

type ProductForm = {
  name: string; category: string; price: string; volume: string;
  description: string; image: string; tags: string[]; isAvailable: boolean;
};

const EMPTY_FORM: ProductForm = {
  name: "", category: "", price: "", volume: "",
  description: "", image: "", tags: [], isAvailable: true,
};

function ProductModal({ product, categories, allTags, onClose, onSave }: {
  product: Product | null;
  categories: string[];
  allTags: string[];
  onClose: () => void;
  onSave: (data: Omit<Product, "id" | "createdAt">) => void;
}) {
  const [form, setForm] = useState<ProductForm>(
    product
      ? { name: product.name, category: product.category, price: String(product.price), volume: product.volume, description: product.description, image: product.image, tags: [...product.tags], isAvailable: product.isAvailable }
      : { ...EMPTY_FORM, category: categories[0] ?? "" }
  );
  const [errors, setErrors] = useState<Partial<ProductForm>>({});
  const [tagInput, setTagInput] = useState("");

  const set = (k: keyof ProductForm, v: string | boolean | string[]) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Partial<ProductForm> = {};
    if (!form.name.trim()) e.name = "必填";
    if (!form.category.trim()) e.category = "必填";
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) e.price = "请输入有效价格";
    if (!form.volume.trim()) e.volume = "必填";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({ name: form.name.trim(), category: form.category, price: Number(form.price), volume: form.volume.trim(), description: form.description.trim(), image: form.image.trim(), tags: form.tags, isAvailable: form.isAvailable });
  };

  const toggleTag = (t: string) => {
    set("tags", form.tags.includes(t) ? form.tags.filter((x) => x !== t) : [...form.tags, t]);
  };

  const addCustomTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) { set("tags", [...form.tags, t]); setTagInput(""); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-gray-900" style={{ fontWeight: 700 }}>{product ? "编辑商品" : "新增商品"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">商品名称 *</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="例：精酿 IPA" className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400 ${errors.name ? "border-red-400" : "border-gray-200"}`} />
              {errors.name && <p className="text-red-400 text-xs mt-0.5">{errors.name}</p>}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">分类 *</label>
              <div className="relative">
                <select value={form.category} onChange={(e) => set("category", e.target.value)} className={`w-full border rounded-xl px-3 py-2 text-sm appearance-none focus:outline-none focus:border-amber-400 pr-8 ${errors.category ? "border-red-400" : "border-gray-200"}`}>
                  <option value="">请选择</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">价格（元）*</label>
              <input type="number" min="0" step="0.5" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="38" className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400 ${errors.price ? "border-red-400" : "border-gray-200"}`} />
              {errors.price && <p className="text-red-400 text-xs mt-0.5">{errors.price}</p>}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">规格 *</label>
              <input value={form.volume} onChange={(e) => set("volume", e.target.value)} placeholder="500ml · 6.5%" className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400 ${errors.volume ? "border-red-400" : "border-gray-200"}`} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">描述</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="简短的商品描述…" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400 resize-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">图片链接</label>
            <input value={form.image} onChange={(e) => set("image", e.target.value)} placeholder="https://…" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">标签</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {allTags.map((t) => (
                <button key={t} onClick={() => toggleTag(t)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${form.tags.includes(t) ? "bg-amber-500 text-white border-amber-500" : "border-gray-200 text-gray-500 hover:border-amber-300"}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustomTag()} placeholder="自定义标签，回车添加" className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
              <button onClick={addCustomTag} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200">添加</button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.tags.map((t) => <TagBadge key={t} label={t} onRemove={() => set("tags", form.tags.filter((x) => x !== t))} />)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500">上架状态</label>
            <AvailabilityToggle value={form.isAvailable} onChange={(v) => set("isAvailable", v)} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">取消</button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm hover:bg-amber-600" style={{ fontWeight: 600 }}>保存</button>
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
        <h3 className="text-gray-900 mb-1" style={{ fontWeight: 700 }}>确认删除商品？</h3>
        <p className="text-gray-400 text-sm mb-6">「{name}」将被永久删除，无法恢复。</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">取消</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm hover:bg-red-600" style={{ fontWeight: 600 }}>删除</button>
        </div>
      </div>
    </div>
  );
}

function CategoryTagManager() {
  const { productCategories, productTags, addProductCategory, removeProductCategory, addProductTag, removeProductTag } = useData();
  const [catInput, setCatInput] = useState("");
  const [tagInput, setTagInput] = useState("");

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
      <h3 className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>分类与标签管理</h3>
      <div>
        <p className="text-xs text-gray-500 mb-2">商品分类</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {productCategories.map((c) => (
            <span key={c} className="flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs border border-amber-200">
              {c}
              <button onClick={() => removeProductCategory(c)} className="text-amber-400 hover:text-amber-600"><X size={10} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={catInput} onChange={(e) => setCatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && catInput.trim()) { addProductCategory(catInput.trim()); setCatInput(""); }}} placeholder="添加分类" className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
          <button onClick={() => { if (catInput.trim()) { addProductCategory(catInput.trim()); setCatInput(""); }}} className="px-3 py-1.5 bg-amber-500 text-white rounded-xl text-sm hover:bg-amber-600"><Plus size={14} /></button>
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-2">商品标签</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {productTags.map((t) => (
            <span key={t} className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
              {t}
              <button onClick={() => removeProductTag(t)} className="text-gray-400 hover:text-gray-600"><X size={10} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && tagInput.trim()) { addProductTag(tagInput.trim()); setTagInput(""); }}} placeholder="添加标签" className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
          <button onClick={() => { if (tagInput.trim()) { addProductTag(tagInput.trim()); setTagInput(""); }}} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200"><Plus size={14} /></button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const { products, productCategories, productTags, addProduct, updateProduct, deleteProduct } = useData();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("全部");
  const [filterAvail, setFilterAvail] = useState("全部");
  const [editProduct, setEditProduct] = useState<Product | null | undefined>(undefined); // undefined = closed, null = new
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "全部" || p.category === filterCat;
    const matchAvail = filterAvail === "全部" || (filterAvail === "上架" ? p.isAvailable : !p.isAvailable);
    return matchSearch && matchCat && matchAvail;
  });

  const handleSave = (data: Omit<Product, "id" | "createdAt">) => {
    if (editProduct === null) {
      addProduct(data);
      showToast("商品已添加");
    } else if (editProduct) {
      updateProduct(editProduct.id, data);
      showToast("商品已更新");
    }
    setEditProduct(undefined);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl text-sm">
          <Check size={16} className="text-green-400" /> {toast}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-gray-900" style={{ fontWeight: 700 }}>商品管理</h1>
          <p className="text-gray-400 text-sm">共 {products.length} 件商品，{products.filter((p) => p.isAvailable).length} 件上架中</p>
        </div>
        <button onClick={() => setEditProduct(null)} className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-amber-600 transition-colors flex-shrink-0" style={{ fontWeight: 600 }}>
          <Plus size={16} /> 新增商品
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索商品名称或描述…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400" />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400">
          <option value="全部">全部分类</option>
          {productCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterAvail} onChange={(e) => setFilterAvail(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400">
          <option value="全部">全部状态</option>
          <option value="上架">上架</option>
          <option value="下架">下架</option>
        </select>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-5 py-3 text-left text-xs text-gray-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>商品</th>
                <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>分类</th>
                <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>价格</th>
                <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>规格</th>
                <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>标签</th>
                <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>状态</th>
                <th className="px-4 py-3 text-right text-xs text-gray-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400 text-sm">暂无商品</td></tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0 bg-gray-100" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                          <Package size={18} className="text-amber-400" />
                        </div>
                      )}
                      <div>
                        <p className="text-gray-900 text-sm" style={{ fontWeight: 500 }}>{p.name}</p>
                        {p.description && <p className="text-gray-400 text-xs truncate max-w-40">{p.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-lg text-xs">{p.category}</span>
                  </td>
                  <td className="px-4 py-3.5 text-gray-900 text-sm" style={{ fontWeight: 600 }}>¥{p.price}</td>
                  <td className="px-4 py-3.5 text-gray-500 text-xs">{p.volume}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {p.tags.slice(0, 2).map((t) => <TagBadge key={t} label={t} />)}
                      {p.tags.length > 2 && <span className="text-gray-400 text-xs">+{p.tags.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <AvailabilityToggle value={p.isAvailable} onChange={(v) => updateProduct(p.id, { isAvailable: v })} />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setEditProduct(p)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-amber-100 hover:text-amber-600 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(p)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-red-100 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category & Tag Manager */}
      <CategoryTagManager />

      {/* Modals */}
      {editProduct !== undefined && (
        <ProductModal
          product={editProduct}
          categories={productCategories}
          allTags={productTags}
          onClose={() => setEditProduct(undefined)}
          onSave={handleSave}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          onConfirm={() => { deleteProduct(deleteTarget.id); setDeleteTarget(null); showToast("商品已删除"); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
