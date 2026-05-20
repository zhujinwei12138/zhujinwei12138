// Typed API client — all paths are relative so Vite proxy handles dev, same-origin in prod.

const BASE = "";

function getToken(): string | null {
  return localStorage.getItem("adminToken");
}

// auth=true: add token and redirect to login on 401
// auth=false: add token if present (for public endpoints that return richer data when authenticated)
async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(BASE + path, { ...options, headers });
  if (res.status === 401 && auth) {
    localStorage.removeItem("adminToken");
    window.location.href = "/admin/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function adminLogin(username: string, password: string): Promise<{ token: string }> {
  return request("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

// ── Merchants ─────────────────────────────────────────────────────────────────

export interface APIMerchant {
  id: number; name: string; address: string; phone: string;
  status: string; created_at: string;
}

export async function getMerchants(): Promise<APIMerchant[]> {
  return request("/api/merchants", {}, false); // public endpoint; auth header added automatically if token present
}
export async function createMerchant(data: Omit<APIMerchant, "id" | "created_at">): Promise<APIMerchant> {
  return request("/api/merchants", { method: "POST", body: JSON.stringify(data) }, true);
}
export async function updateMerchant(id: number, data: Partial<Omit<APIMerchant, "id" | "created_at">>): Promise<APIMerchant> {
  return request(`/api/merchants/${id}`, { method: "PUT", body: JSON.stringify(data) }, true);
}
export async function deleteMerchant(id: number): Promise<void> {
  return request(`/api/merchants/${id}`, { method: "DELETE" }, true);
}

// ── Products ──────────────────────────────────────────────────────────────────

export interface APIProduct {
  id: number; merchant_id: number | null; name: string; description: string;
  volume: string; alcohol: string; price: number; category: string;
  badge: string | null; gradient: string; stock: number | null;
  image_url: string | null; created_at?: string;
}

export async function getProducts(merchantId?: number): Promise<APIProduct[]> {
  const q = merchantId ? `?merchant_id=${merchantId}` : "";
  return request(`/api/products${q}`);
}
export async function createProduct(data: Omit<APIProduct, "id" | "created_at">): Promise<APIProduct> {
  return request("/api/products", { method: "POST", body: JSON.stringify(data) }, true);
}
export async function updateProduct(id: number, data: Partial<Omit<APIProduct, "id" | "created_at">>): Promise<APIProduct> {
  return request(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(data) }, true);
}
export async function deleteProduct(id: number): Promise<void> {
  return request(`/api/products/${id}`, { method: "DELETE" }, true);
}

// ── Orders ────────────────────────────────────────────────────────────────────

export interface APIOrderItem { id: number; name: string; price: number; quantity: number; }
export interface APIOrder {
  id: number; merchant_id: number; table_no: string;
  items: APIOrderItem[]; total: number | string; status: string;
  created_at: string; refund_reason?: string;
}
export interface CreateOrderBody {
  merchant_id: number; table_no: string;
  items: { id: number; name: string; price: number; quantity: number }[];
  total: number;
}

export async function getOrders(): Promise<APIOrder[]> {
  return request("/api/orders", {}, true);
}
export async function createOrder(body: CreateOrderBody): Promise<{ id: number }> {
  return request("/api/orders", { method: "POST", body: JSON.stringify(body) });
}
export async function updateOrderStatus(id: number, status: string): Promise<void> {
  return request(`/api/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }, true);
}

// ── Payments ──────────────────────────────────────────────────────────────────

export interface APIPayment {
  id: string; order_id: number; method: string; status: string;
  amount: number | string; created_at: string;
}

export async function createPayment(orderId: number, method: string): Promise<APIPayment> {
  return request("/api/payments/create", { method: "POST", body: JSON.stringify({ order_id: orderId, method }) });
}
export async function getPayment(payId: string): Promise<{ status: string }> {
  return request(`/api/payments/${payId}`);
}
export async function mockPay(payId: string): Promise<void> {
  return request(`/api/payments/${payId}/mock-pay`, { method: "POST" });
}
export async function refundPayment(payId: string, reason: string): Promise<void> {
  return request(`/api/payments/${payId}/refund`, { method: "POST", body: JSON.stringify({ reason }) }, true);
}
export async function getPayments(): Promise<APIPayment[]> {
  return request("/api/payments", {}, true);
}

// ── Admin users ───────────────────────────────────────────────────────────────

export interface APIAdminUser {
  id: number; username: string; role: string;
  merchant_id: number | null; is_active: boolean; created_at: string;
}
export interface CreateAdminUserBody {
  username: string; password: string; role: string; merchant_id: number | null;
}
export interface PatchAdminUserBody {
  username?: string; role?: string; merchant_id?: number | null; is_active?: boolean;
}

export async function getAdminUsers(): Promise<APIAdminUser[]> {
  return request("/api/admin/users", {}, true);
}
export async function createAdminUser(body: CreateAdminUserBody): Promise<APIAdminUser> {
  return request("/api/admin/users", { method: "POST", body: JSON.stringify(body) }, true);
}
export async function patchAdminUser(id: number, body: PatchAdminUserBody): Promise<APIAdminUser> {
  return request(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true);
}
export async function deleteAdminUser(id: number): Promise<void> {
  return request(`/api/admin/users/${id}`, { method: "DELETE" }, true);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface APIStatsSummary {
  total_revenue: number; total_orders: number; active_merchants: number;
  total_products: number;
}
export async function getStatsSummary(): Promise<APIStatsSummary> {
  return request("/api/stats/summary", {}, true);
}
export async function getMerchantStats(): Promise<unknown[]> {
  return request("/api/stats", {}, true);
}
