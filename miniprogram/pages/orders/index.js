const app = getApp();
const { request } = require('../../utils/request');
const { ORDER_STATUS_LABELS, formatDate, showError } = require('../../utils/util');

const TABS = [
  { id: 'pending_payment', label: '待付款' },
  { id: 'preparing', label: '备货中' },
  { id: 'completed', label: '已完成' },
  { id: 'cancelled', label: '已取消' },
];

Page({
  data: {
    tabs: TABS,
    activeTab: 'pending_payment',
    allOrders: [],
    filteredOrders: [],
    loading: true,
    statusLabels: ORDER_STATUS_LABELS,
  },

  onLoad() {
    this.loadOrders();
  },

  onShow() {
    this.loadOrders();
  },

  async loadOrders() {
    const { merchantId, tableNo } = app.globalData;
    this.setData({ loading: true });

    try {
      let orders = [];
      if (merchantId && tableNo) {
        orders = await request({
          url: `/api/orders/by-table?merchant_id=${merchantId}&table_no=${encodeURIComponent(tableNo)}&limit=20`,
        });
      }
      // Also try customer token orders
      const token = wx.getStorageSync('customerToken');
      if (token) {
        try {
          const myOrders = await request({ url: '/api/customers/me/orders', customerAuth: true });
          // Merge, deduplicate by id
          const ids = new Set(orders.map(o => o.id));
          myOrders.forEach(o => { if (!ids.has(o.id)) orders.push(o); });
        } catch (_) {}
      }

      orders.sort((a, b) => b.id - a.id);
      this.setData({ allOrders: orders, loading: false });
      this.filterOrders(this.data.activeTab);
    } catch (e) {
      this.setData({ loading: false });
      showError('加载订单失败');
    }
  },

  filterOrders(status) {
    const filtered = this.data.allOrders.filter(o => {
      if (status === 'pending_payment') return o.status === 'pending_payment';
      if (status === 'preparing') return o.status === 'paid' || o.status === 'preparing';
      if (status === 'completed') return o.status === 'completed';
      if (status === 'cancelled') return o.status === 'cancelled' || o.status === 'refunded';
      return false;
    }).map(o => ({
      ...o,
      statusLabel: ORDER_STATUS_LABELS[o.status] || o.status,
      formattedTime: formatDate(o.created_at),
      itemsSummary: (o.items || []).map(i => `${i.name}×${i.quantity}`).join('、'),
    }));
    this.setData({ filteredOrders: filtered });
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.filterOrders(tab);
  },

  getTabCount(tabId) {
    const { allOrders } = this.data;
    if (tabId === 'pending_payment') return allOrders.filter(o => o.status === 'pending_payment').length;
    if (tabId === 'preparing') return allOrders.filter(o => o.status === 'paid' || o.status === 'preparing').length;
    if (tabId === 'completed') return allOrders.filter(o => o.status === 'completed').length;
    if (tabId === 'cancelled') return allOrders.filter(o => o.status === 'cancelled' || o.status === 'refunded').length;
    return 0;
  },

  onPayOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    const total = e.currentTarget.dataset.total;
    wx.navigateTo({ url: `/pages/payment/index?orderId=${orderId}&total=${total}` });
  },

  onPullDownRefresh() {
    this.loadOrders().then(() => wx.stopPullDownRefresh());
  },
});
