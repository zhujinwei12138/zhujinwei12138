const app = getApp();
const { request } = require('../../utils/request');
const { getCartCount, showError } = require('../../utils/util');

Page({
  data: {
    merchantName: '',
    tableNo: '',
    cartCount: 0,
    phone: '',
    // Login state
    isLoggedIn: false,
    showOtpModal: false,
    otpPhone: '',
    otpCode: '',
    otpCountdown: 0,
    otpSending: false,
    otpVerifying: false,
  },

  otpTimer: null,

  onShow() {
    const cart = app.globalData.cart;
    const token = wx.getStorageSync('customerToken');
    const phone = wx.getStorageSync('customerPhone') || '';
    this.setData({
      cartCount: getCartCount(cart),
      merchantName: app.globalData.merchantName,
      tableNo: app.globalData.tableNo,
      isLoggedIn: !!token,
      phone,
    });
  },

  onUnload() {
    if (this.otpTimer) clearInterval(this.otpTimer);
  },

  onCartTap() {
    wx.navigateTo({ url: '/pages/cart/index' });
  },

  onOrdersTap() {
    wx.navigateTo({ url: '/pages/orders/index' });
  },

  onTabHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  },

  // OTP Login
  onLoginTap() {
    this.setData({ showOtpModal: true, otpPhone: '', otpCode: '' });
  },

  onOtpPhoneInput(e) {
    this.setData({ otpPhone: e.detail.value });
  },

  onOtpCodeInput(e) {
    this.setData({ otpCode: e.detail.value });
  },

  onCloseOtp() {
    this.setData({ showOtpModal: false });
  },

  async onSendOtp() {
    const { otpPhone, otpCountdown } = this.data;
    if (otpCountdown > 0) return;
    if (!/^1[3-9]\d{9}$/.test(otpPhone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    this.setData({ otpSending: true });
    try {
      await request({ url: '/api/customers/send-otp', method: 'POST', data: { phone: otpPhone } });
      wx.showToast({ title: '验证码已发送', icon: 'none' });
      this.startOtpCountdown();
    } catch (e) {
      showError(e.message || '发送失败');
    }
    this.setData({ otpSending: false });
  },

  startOtpCountdown() {
    this.setData({ otpCountdown: 60 });
    this.otpTimer = setInterval(() => {
      const c = this.data.otpCountdown - 1;
      if (c <= 0) {
        clearInterval(this.otpTimer);
        this.setData({ otpCountdown: 0 });
      } else {
        this.setData({ otpCountdown: c });
      }
    }, 1000);
  },

  async onVerifyOtp() {
    const { otpPhone, otpCode } = this.data;
    if (!otpCode) {
      wx.showToast({ title: '请输入验证码', icon: 'none' });
      return;
    }
    this.setData({ otpVerifying: true });
    try {
      const res = await request({
        url: '/api/customers/verify-otp',
        method: 'POST',
        data: { phone: otpPhone, code: otpCode },
      });
      wx.setStorageSync('customerToken', res.token);
      wx.setStorageSync('customerPhone', otpPhone);
      this.setData({ showOtpModal: false, isLoggedIn: true, phone: otpPhone, otpVerifying: false });
      wx.showToast({ title: '登录成功', icon: 'success' });
    } catch (e) {
      this.setData({ otpVerifying: false });
      showError(e.message || '验证失败');
    }
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('customerToken');
          wx.removeStorageSync('customerPhone');
          this.setData({ isLoggedIn: false, phone: '' });
          wx.showToast({ title: '已退出登录', icon: 'none' });
        }
      },
    });
  },

  onAbout() {
    wx.showModal({
      title: '关于我们',
      content: '精酿啤酒点单系统 v2.0\n提供便捷的扫码点单体验',
      showCancel: false,
    });
  },

  onChangeSeat() {
    wx.reLaunch({ url: '/pages/index/index' });
  },
});
