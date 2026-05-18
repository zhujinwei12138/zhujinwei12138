const app = getApp();
const { request } = require('../../utils/request');
const { showError } = require('../../utils/util');

Page({
  data: {
    orderId: null,
    total: 0,
    payMethod: 'wechat',
    payId: null,
    payStatus: 'idle',   // idle | creating | pending | paid | expired | failed
    pollCount: 0,
    isMockMode: true,    // will be confirmed after creating payment
  },

  pollTimer: null,

  onLoad(options) {
    this.setData({
      orderId: options.orderId,
      total: parseFloat(options.total) || 0,
    });
  },

  onUnload() {
    this.stopPolling();
  },

  onHide() {
    this.stopPolling();
  },

  selectMethod(e) {
    this.setData({ payMethod: e.currentTarget.dataset.method });
  },

  async onCreatePayment() {
    const { orderId, payMethod, payStatus } = this.data;
    if (payStatus === 'creating' || payStatus === 'pending') return;

    this.setData({ payStatus: 'creating' });
    wx.showLoading({ title: '创建支付…' });

    try {
      const payment = await request({
        url: '/api/payments/create',
        method: 'POST',
        data: { order_id: orderId, method: payMethod },
      });

      wx.hideLoading();
      this.setData({ payId: payment.id, payStatus: 'pending' });
      this.startPolling(payment.id);
    } catch (e) {
      wx.hideLoading();
      this.setData({ payStatus: 'failed' });
      showError(e.message || '创建支付失败');
    }
  },

  // Mock pay: call backend to simulate payment success
  async onMockPay() {
    const { payId } = this.data;
    if (!payId) return;

    wx.showLoading({ title: '支付中…' });
    try {
      await request({ url: `/api/payments/${payId}/mock-pay`, method: 'POST' });
      wx.hideLoading();
      this.stopPolling();
      this.onPaymentSuccess();
    } catch (e) {
      wx.hideLoading();
      showError(e.message || '支付失败');
    }
  },

  startPolling(payId) {
    this.stopPolling();
    let count = 0;
    const MAX_POLLS = 150; // 5 minutes at 2s intervals

    this.pollTimer = setInterval(async () => {
      count++;
      if (count > MAX_POLLS) {
        this.stopPolling();
        this.setData({ payStatus: 'expired' });
        return;
      }

      try {
        const payment = await request({ url: `/api/payments/${payId}` });
        this.setData({ pollCount: count });

        if (payment.status === 'paid') {
          this.stopPolling();
          this.onPaymentSuccess();
        } else if (payment.status === 'expired' || payment.status === 'refunded') {
          this.stopPolling();
          this.setData({ payStatus: payment.status });
        }
      } catch (e) {
        // Network error during polling — keep trying
      }
    }, 2000);
  },

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },

  onPaymentSuccess() {
    this.setData({ payStatus: 'paid' });
    wx.showToast({ title: '支付成功！', icon: 'success', duration: 1500 });
    setTimeout(() => {
      wx.redirectTo({ url: '/pages/orders/index' });
    }, 1500);
  },

  onRetry() {
    this.setData({ payStatus: 'idle', payId: null });
  },

  onBackHome() {
    wx.switchTab
      ? wx.reLaunch({ url: '/pages/index/index' })
      : wx.navigateBack({ delta: 3 });
  },
});
