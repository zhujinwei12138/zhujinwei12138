function formatPrice(price) {
  return '¥' + Number(price).toFixed(2);
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${min}`;
}

const ORDER_STATUS_LABELS = {
  pending_payment: '待付款',
  paid: '已付款',
  preparing: '备货中',
  completed: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
};

const ORDER_STATUS_COLORS = {
  pending_payment: '#d97706',
  paid: '#2563eb',
  preparing: '#7c3aed',
  completed: '#16a34a',
  cancelled: '#6b7280',
  refunded: '#6b7280',
};

function getCartCount(cart) {
  return cart.reduce((s, i) => s + i.quantity, 0);
}

function getCartTotal(cart) {
  return cart.reduce((s, i) => s + i.price * i.quantity, 0);
}

function showToast(title, icon = 'none', duration = 2000) {
  wx.showToast({ title, icon, duration });
}

function showError(msg) {
  wx.showToast({ title: msg || '操作失败', icon: 'none', duration: 2500 });
}

module.exports = {
  formatPrice,
  formatDate,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  getCartCount,
  getCartTotal,
  showToast,
  showError,
};
