import {
  createContext, useContext, useState, useCallback,
  useEffect, ReactNode,
} from "react";
import * as API from "../api";

// ── Exported types (same shape as before — UI does NOT change) ────────────────

export interface Merchant {
  id: string; name: string; address: string; phone: string;
  status: "active" | "inactive"; createdAt: string;
}

export interface OrderItem {
  beerId: number; beerName: string; category: string; quantity: number; price: number;
}

export type OrderStatus =
  | "pending" | "preparing" | "completed" | "cancelled"
  | "refunding" | "refunded";

export interface SalesOrder {
  id: string; merchantId: string; merchantName: string; tableNo: string;
  items: OrderItem[]; total: number; timestamp: string; status: OrderStatus;
  refundReason?: string;
  payId?: number;
}

export interface CartItem {
  id: number; name: string; category: string; price: number;
  volume: string; image: string; tag?: string; quantity: number;
}

export interface UserProfile {
  name: string; phone: string; email: string;
  gender: "male" | "female" | "private"; birthday: string;
}

export interface Product {
  id: string; name: string; category: string; price: number;
  volume: string; description: string; image: string;
  tags: string[]; isAvailable: boolean; createdAt: string;
}

export interface AdminUser {
  id: string; name: string; email: string; phone: string;
  role: "super_admin" | "admin";
  merchantIds: string[];
  status: "active" | "inactive";
  avatarColor: string; createdAt: string;
}

// ── Type adapters ─────────────────────────────────────────────────────────────

const AVATAR_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

function adaptMerchant(m: API.APIMerchant): Merchant {
  return {
    id: String(m.id),
    name: m.name,
    address: m.address ?? "",
    phone: m.phone ?? "",
    status: m.status === "active" ? "active" : "inactive",
    createdAt: m.created_at?.split("T")[0] ?? "",
  };
}

function adaptProduct(p: API.APIProduct): Product {
  return {
    id: String(p.id),
    name: p.name,
    category: p.category ?? "",
    price: Number(p.price),
    volume: p.volume ?? "",
    description: p.description ?? "",
    image: p.image_url ?? "",
    tags: p.badge ? [p.badge] : [],
    isAvailable: p.stock == null || p.stock > 0,
    createdAt: (p as { created_at?: string }).created_at?.split("T")[0] ?? "",
  };
}

function adaptOrder(o: API.APIOrder, map: Map<number, string>): SalesOrder {
  const s = o.status;
  let status: OrderStatus;
  if (s === "pending_payment" || s === "paid") status = "pending";
  else if (s === "preparing") status = "preparing";
  else if (s === "completed") status = "completed";
  else if (s === "refunded") status = "refunded";
  else if (s === "cancelled") status = "cancelled";
  else status = "pending";

  return {
    id: String(o.id),
    merchantId: String(o.merchant_id),
    merchantName: map.get(Number(o.merchant_id)) ?? "",
    tableNo: o.table_no,
    items: (o.items ?? []).map((i) => ({
      beerId: i.id, beerName: i.name, category: "", quantity: i.quantity, price: Number(i.price),
    })),
    total: Number(o.total),
    timestamp: o.created_at,
    status,
    refundReason: o.refund_reason,
  };
}

function adaptAdminUser(u: API.APIAdminUser): AdminUser {
  return {
    id: String(u.id),
    name: u.username,
    email: "",
    phone: "",
    role: u.role === "super_admin" ? "super_admin" : "admin",
    merchantIds: u.merchant_id ? [String(u.merchant_id)] : [],
    status: u.is_active ? "active" : "inactive",
    avatarColor: AVATAR_COLORS[u.id % AVATAR_COLORS.length],
    createdAt: u.created_at?.split("T")[0] ?? "",
  };
}

// ── Context interface ─────────────────────────────────────────────────────────

interface DataContextType {
  merchants: Merchant[];
  orders: SalesOrder[];
  cart: CartItem[];
  userProfile: UserProfile;
  myOrderIds: string[];
  products: Product[];
  adminUsers: AdminUser[];
  productCategories: string[];
  productTags: string[];
  loadingMerchants: boolean;
  loadingOrders: boolean;
  loadingProducts: boolean;
  loadingAdminUsers: boolean;
  addMerchant: (data: Omit<Merchant, "id" | "createdAt">) => Promise<void>;
  updateMerchant: (id: string, data: Partial<Omit<Merchant, "id" | "createdAt">>) => Promise<void>;
  deleteMerchant: (id: string) => Promise<void>;
  addOrder: (order: Omit<SalesOrder, "id" | "timestamp" | "status" | "payId">) => Promise<string>;
  updateOrderStatus: (id: string, status: OrderStatus, refundReason?: string) => Promise<void>;
  clearAllOrders: () => void;
  addToCart: (item: Omit<CartItem, "quantity">) => void;
  removeFromCart: (id: number) => void;
  updateCartQuantity: (id: number, quantity: number) => void;
  clearCart: () => void;
  updateUserProfile: (data: Partial<UserProfile>) => void;
  addMyOrderId: (id: string) => void;
  addProduct: (data: Omit<Product, "id" | "createdAt">) => Promise<void>;
  updateProduct: (id: string, data: Partial<Omit<Product, "id" | "createdAt">>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addAdminUser: (data: Omit<AdminUser, "id" | "createdAt">) => Promise<void>;
  updateAdminUser: (id: string, data: Partial<Omit<AdminUser, "id" | "createdAt">>) => Promise<void>;
  deleteAdminUser: (id: string) => Promise<void>;
  addProductCategory: (cat: string) => void;
  removeProductCategory: (cat: string) => void;
  addProductTag: (tag: string) => void;
  removeProductTag: (tag: string) => void;
  reloadMerchants: () => Promise<void>;
  reloadOrders: () => Promise<void>;
  reloadProducts: (merchantId?: number) => Promise<void>;
  reloadAdminUsers: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_USER: UserProfile = { name: "酒友用户", phone: "", email: "", gender: "private", birthday: "" };
const DEFAULT_CATEGORIES = ["精酿", "瓶装", "罐装"];
const DEFAULT_TAGS = ["热销", "新品", "推荐", "限时特惠", "季节限定"];

function load<T>(key: string, def: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
}
function save<T>(key: string, v: T) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }

// ── Provider ──────────────────────────────────────────────────────────────────

export function DataProvider({ children }: { children: ReactNode }) {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);

  const [loadingMerchants, setLoadingMerchants] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);

  const [cart, setCart] = useState<CartItem[]>(() => load("cart_v1", []));
  const [userProfile, setUserProfile] = useState<UserProfile>(() => load("user_profile_v1", DEFAULT_USER));
  const [myOrderIds, setMyOrderIds] = useState<string[]>(() => load("my_order_ids_v1", []));
  const [productCategories, setProductCategories] = useState<string[]>(() => load("product_categories_v1", DEFAULT_CATEGORIES));
  const [productTags, setProductTags] = useState<string[]>(() => load("product_tags_v1", DEFAULT_TAGS));

  // ── Data loaders ───────────────────────────────────────────────────────────

  const reloadMerchants = useCallback(async () => {
    setLoadingMerchants(true);
    try {
      // Endpoint is public (no-auth returns active only, auth returns all/scoped)
      const raw = await API.getMerchants();
      setMerchants(raw.map(adaptMerchant));
    } catch (e) {
      console.error("Failed to load merchants", e);
    } finally {
      setLoadingMerchants(false);
    }
  }, []);

  const reloadProducts = useCallback(async (merchantId?: number) => {
    setLoadingProducts(true);
    try {
      const raw = await API.getProducts(merchantId);
      setProducts(raw.map(adaptProduct));
      const cats = Array.from(new Set(raw.map((p) => p.category).filter(Boolean)));
      if (cats.length > 0) {
        setProductCategories((prev) => {
          const merged = Array.from(new Set([...prev, ...cats]));
          save("product_categories_v1", merged);
          return merged;
        });
      }
    } catch (e) {
      console.error("Failed to load products", e);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const reloadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const [rawOrders, rawMerchants] = await Promise.all([
        API.getOrders(),
        API.getMerchants().catch(() => [] as API.APIMerchant[]),
      ]);
      const map = new Map<number, string>(rawMerchants.map((m) => [m.id, m.name]));
      setOrders(rawOrders.map((o) => adaptOrder(o, map)));
    } catch (e) {
      console.error("Failed to load orders", e);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const reloadAdminUsers = useCallback(async () => {
    setLoadingAdminUsers(true);
    try {
      const raw = await API.getAdminUsers();
      setAdminUsers(raw.map(adaptAdminUser));
    } catch (e) {
      console.error("Failed to load admin users", e);
    } finally {
      setLoadingAdminUsers(false);
    }
  }, []);

  useEffect(() => {
    reloadMerchants();
    reloadProducts();
    if (localStorage.getItem("adminToken")) {
      reloadOrders();
      reloadAdminUsers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Merchant CRUD ──────────────────────────────────────────────────────────

  const addMerchant = useCallback(async (data: Omit<Merchant, "id" | "createdAt">) => {
    await API.createMerchant({ name: data.name, address: data.address, phone: data.phone, status: data.status });
    await reloadMerchants();
  }, [reloadMerchants]);

  const updateMerchant = useCallback(async (id: string, data: Partial<Omit<Merchant, "id" | "createdAt">>) => {
    await API.updateMerchant(Number(id), {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.status !== undefined && { status: data.status }),
    });
    await reloadMerchants();
  }, [reloadMerchants]);

  const deleteMerchant = useCallback(async (id: string) => {
    await API.deleteMerchant(Number(id));
    await reloadMerchants();
  }, [reloadMerchants]);

  // ── Order CRUD ─────────────────────────────────────────────────────────────

  const addOrder = useCallback(async (order: Omit<SalesOrder, "id" | "timestamp" | "status" | "payId">): Promise<string> => {
    const res = await API.createOrder({
      merchant_id: Number(order.merchantId),
      table_no: order.tableNo,
      items: order.items.map((i) => ({ id: i.beerId, name: i.beerName, price: i.price, quantity: i.quantity })),
      total: order.total,
    });
    const newOrder: SalesOrder = {
      id: String(res.id),
      merchantId: order.merchantId,
      merchantName: order.merchantName,
      tableNo: order.tableNo,
      items: order.items,
      total: order.total,
      timestamp: new Date().toISOString(),
      status: "pending",
    };
    setOrders((prev) => [newOrder, ...prev]);
    return String(res.id);
  }, []);

  const updateOrderStatus = useCallback(async (id: string, status: OrderStatus, refundReason?: string) => {
    if (status === "refunded" || status === "refunding") {
      // Refund path: call the refund endpoint which handles order+payment status server-side.
      // Do NOT also call updateOrderStatus — the backend would reject "refunded → cancelled".
      if (refundReason) {
        const payments = await API.getPayments();
        const pay = payments.find((p) => String(p.order_id) === id);
        if (pay) await API.refundPayment(pay.id, refundReason);
      }
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: "refunded", ...(refundReason ? { refundReason } : {}) } : o));
      return;
    }

    const backendStatusMap: Partial<Record<OrderStatus, string>> = {
      preparing: "preparing",
      completed: "completed",
      cancelled: "cancelled",
    };
    const backendStatus = backendStatusMap[status] ?? "cancelled";
    await API.updateOrderStatus(Number(id), backendStatus);
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
  }, []);

  const clearAllOrders = useCallback(() => setOrders([]), []);

  // ── Product CRUD ───────────────────────────────────────────────────────────

  const addProduct = useCallback(async (data: Omit<Product, "id" | "createdAt">) => {
    await API.createProduct({
      merchant_id: null, name: data.name, description: data.description,
      volume: data.volume, alcohol: "", price: data.price, category: data.category,
      badge: data.tags[0] ?? null, gradient: "from-amber-400 to-orange-500",
      stock: null, image_url: data.image || null,
    });
    await reloadProducts();
  }, [reloadProducts]);

  const updateProduct = useCallback(async (id: string, data: Partial<Omit<Product, "id" | "createdAt">>) => {
    await API.updateProduct(Number(id), {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.volume !== undefined && { volume: data.volume }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.tags !== undefined && { badge: data.tags[0] ?? null }),
      ...(data.image !== undefined && { image_url: data.image || null }),
      ...(data.isAvailable !== undefined && { stock: data.isAvailable ? null : 0 }),
    });
    await reloadProducts();
  }, [reloadProducts]);

  const deleteProduct = useCallback(async (id: string) => {
    await API.deleteProduct(Number(id));
    await reloadProducts();
  }, [reloadProducts]);

  // ── Admin user CRUD ────────────────────────────────────────────────────────

  const addAdminUser = useCallback(async (data: Omit<AdminUser, "id" | "createdAt">) => {
    await API.createAdminUser({
      username: data.name, password: "Beer@123",
      role: data.role === "super_admin" ? "super_admin" : "merchant_admin",
      merchant_id: data.merchantIds[0] ? Number(data.merchantIds[0]) : null,
    });
    await reloadAdminUsers();
  }, [reloadAdminUsers]);

  const updateAdminUser = useCallback(async (id: string, data: Partial<Omit<AdminUser, "id" | "createdAt">>) => {
    await API.patchAdminUser(Number(id), {
      ...(data.name !== undefined && { username: data.name }),
      ...(data.role !== undefined && { role: data.role === "super_admin" ? "super_admin" : "merchant_admin" }),
      ...(data.merchantIds !== undefined && { merchant_id: data.merchantIds[0] ? Number(data.merchantIds[0]) : null }),
      ...(data.status !== undefined && { is_active: data.status === "active" }),
    });
    await reloadAdminUsers();
  }, [reloadAdminUsers]);

  const deleteAdminUser = useCallback(async (id: string) => {
    await API.deleteAdminUser(Number(id));
    await reloadAdminUsers();
  }, [reloadAdminUsers]);

  // ── Cart (local) ──────────────────────────────────────────────────────────

  const addToCart = useCallback((item: Omit<CartItem, "quantity">) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === item.id);
      const next = ex ? prev.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { ...item, quantity: 1 }];
      save("cart_v1", next); return next;
    });
  }, []);

  const removeFromCart = useCallback((id: number) => {
    setCart((prev) => { const next = prev.filter((i) => i.id !== id); save("cart_v1", next); return next; });
  }, []);

  const updateCartQuantity = useCallback((id: number, quantity: number) => {
    setCart((prev) => {
      const next = quantity <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => i.id === id ? { ...i, quantity } : i);
      save("cart_v1", next); return next;
    });
  }, []);

  const clearCart = useCallback(() => { setCart([]); save("cart_v1", []); }, []);

  const updateUserProfile = useCallback((data: Partial<UserProfile>) => {
    setUserProfile((prev) => { const next = { ...prev, ...data }; save("user_profile_v1", next); return next; });
  }, []);

  const addMyOrderId = useCallback((id: string) => {
    setMyOrderIds((prev) => { const next = [id, ...prev]; save("my_order_ids_v1", next); return next; });
  }, []);

  const addProductCategory = useCallback((cat: string) => {
    setProductCategories((prev) => { if (prev.includes(cat)) return prev; const next = [...prev, cat]; save("product_categories_v1", next); return next; });
  }, []);
  const removeProductCategory = useCallback((cat: string) => {
    setProductCategories((prev) => { const next = prev.filter((c) => c !== cat); save("product_categories_v1", next); return next; });
  }, []);
  const addProductTag = useCallback((tag: string) => {
    setProductTags((prev) => { if (prev.includes(tag)) return prev; const next = [...prev, tag]; save("product_tags_v1", next); return next; });
  }, []);
  const removeProductTag = useCallback((tag: string) => {
    setProductTags((prev) => { const next = prev.filter((t) => t !== tag); save("product_tags_v1", next); return next; });
  }, []);

  return (
    <DataContext.Provider value={{
      merchants, orders, cart, userProfile, myOrderIds, products, adminUsers,
      productCategories, productTags,
      loadingMerchants, loadingOrders, loadingProducts, loadingAdminUsers,
      addMerchant, updateMerchant, deleteMerchant,
      addOrder, updateOrderStatus, clearAllOrders,
      addToCart, removeFromCart, updateCartQuantity, clearCart,
      updateUserProfile, addMyOrderId,
      addProduct, updateProduct, deleteProduct,
      addAdminUser, updateAdminUser, deleteAdminUser,
      addProductCategory, removeProductCategory,
      addProductTag, removeProductTag,
      reloadMerchants, reloadOrders, reloadProducts, reloadAdminUsers,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
