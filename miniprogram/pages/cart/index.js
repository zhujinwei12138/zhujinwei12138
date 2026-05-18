const app = getApp();
const { request } = require('../../utils/request');
const { getCartCount, getCartTotal, showError } = require('../../utils/util');

Page({
  data: {
    cart: [],
    cartTotal: 0,
    cartTotalStr: '0.00',
    merchantId: null,
    merchantName: '',
    tableNo: '',
    submitting: false,
  },

  onLoad() {
    this.refreshCart();
  },

  onShow() {
    this.refreshCart();
  },

  refreshCart() {
    const cart = app.globalData.cart;
    const cartTotal = getCartTotal(cart);
    this.setData({
      cart,
      cartTotal,
      cartTotalStr: cartTotal.toFixed(2),
      merchantId: app.globalData.merchantId,
      merchantName: app.globalData.merchantName,
      tableNo: app.globalData.tableNo,
    });
  },

  onIncrease(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.cart.find(i => i.id === id);
    if (!item) return;
    const cart = app.updateCartQuantity(id, item.quantity + 1);
    const cartTotal = getCartTotal(cart);
    this.setData({ cart, cartTotal, cartTotalStr: cartTotal.toFixed(2) });
  },

  onDecrease(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.cart.find(i => i.id === id);
    if (!item) return;
    const cart = app.updateCartQuantity(id, item.quantity - 1);
    const cartTotal = getCartTotal(cart);
    this.setData({ cart, cartTotal, cartTotalStr: cartTotal.toFixed(2) });
  },

  onClearCart() {
    wx.showModal({
      title: '清空购物车',
      content: '确定要清空购物车吗？',
      success: (res) => {
        if (res.confirm) {
          app.clearCart();
          this.setData({ cart: [], cartTotal: 0 });
        }
      },
    });
  },

  async onSubmitOrder() {
    const { cart, merchantId, merchantName, tableNo, submitting } = this.data;
    if (submitting) return;
    if (cart.length === 0) return;
    if (!merchantId) {
      showError('请先选择商家和桌号');
      return;
    }
    if (!tableNo) {
      showError('请先设置桌号');
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中…' });

    try {
      // Validate stock first by re-fetching products
      const items = cart.map(i => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        category: i.category || '',
      }));
      const total = getCartTotal(cart);

      const order = await request({
        url: '/api/orders',
        method: 'POST',
        data: {
          merchant_id: merchantId,
          table_no: tableNo,
          items,
          total,
        },
      });

      app.clearCart();
      wx.hideLoading();
      this.setData({ cart: [], cartTotal: 0, submitting: false });

      // Navigate to payment
      wx.redirectTo({
        url: `/pages/payment/index?orderId=${order.id}&total=${total}&merchantId=${merchantId}`,
      });
    } catch (e) {
      wx.hideLoading();
      this.setData({ submitting: false });
      showError(e.message || '下单失败，请重试');
    }
  },
});
