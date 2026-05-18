const app = getApp();
const { request } = require('../../utils/request');
const { getCartCount, getCartTotal, showError } = require('../../utils/util');

const CATEGORIES = ['全部', '精酿', '瓶装', '罐装'];

Page({
  data: {
    categories: CATEGORIES,
    selectedCategory: '全部',
    products: [],
    loading: true,
    merchants: [],
    merchantId: null,
    merchantName: '',
    tableNo: '',
    showSetup: false,
    setupMerchantIdx: 0,
    setupTableNo: '',
    cart: [],
    cartCount: 0,
    cartTotal: 0,
    activeTab: 'home',
  },

  onLoad() {
    const { merchantId, merchantName, tableNo, cart } = app.globalData;
    const cartCount = getCartCount(cart);
    const cartTotal = getCartTotal(cart);
    this.setData({ merchantId, merchantName, tableNo, cart, cartCount, cartTotal });

    this.loadMerchants();
  },

  onShow() {
    const cart = app.globalData.cart;
    this.setData({
      cart,
      cartCount: getCartCount(cart),
      cartTotal: getCartTotal(cart),
      merchantId: app.globalData.merchantId,
      merchantName: app.globalData.merchantName,
      tableNo: app.globalData.tableNo,
      products: this.mergeQty(this.data.products),
    });
  },

  async loadMerchants() {
    try {
      const merchants = await request({ url: '/api/merchants' });
      const active = merchants.filter(m => m.status === 'active');
      this.setData({ merchants: active });

      if (!this.data.merchantId || !this.data.tableNo) {
        this.setData({ showSetup: true });
      } else {
        this.loadProducts();
      }
    } catch (e) {
      showError('加载商家失败：' + e.message);
      this.setData({ loading: false });
    }
  },

  async loadProducts() {
    const { merchantId, selectedCategory } = this.data;
    if (!merchantId) return;

    this.setData({ loading: true });
    try {
      const params = `merchant_id=${merchantId}` + (selectedCategory !== '全部' ? `&category=${encodeURIComponent(selectedCategory)}` : '');
      const rawProducts = await request({ url: `/api/products?${params}` });
      const products = this.mergeQty(rawProducts);
      this.setData({ products, loading: false });
    } catch (e) {
      showError('加载商品失败');
      this.setData({ loading: false });
    }
  },

  mergeQty(products) {
    const cart = app.globalData.cart;
    return products.map(p => {
      const item = cart.find(c => c.id === p.id);
      return { ...p, _qty: item ? item.quantity : 0 };
    });
  },

  onCategoryTap(e) {
    const cat = e.currentTarget.dataset.category;
    this.setData({ selectedCategory: cat });
    this.loadProducts();
  },

  // Setup overlay
  onSetupMerchantChange(e) {
    this.setData({ setupMerchantIdx: Number(e.detail.value) });
  },

  onSetupTableInput(e) {
    this.setData({ setupTableNo: e.detail.value.toUpperCase() });
  },

  onSetupConfirm() {
    const { merchants, setupMerchantIdx, setupTableNo } = this.data;
    if (!setupTableNo.trim()) {
      wx.showToast({ title: '请输入桌号', icon: 'none' });
      return;
    }
    const merchant = merchants[setupMerchantIdx];
    if (!merchant) return;

    const merchantId = merchant.id;
    const merchantName = merchant.name;
    const tableNo = setupTableNo.trim();

    app.globalData.merchantId = merchantId;
    app.globalData.merchantName = merchantName;
    app.globalData.tableNo = tableNo;
    wx.setStorageSync('merchantId', merchantId);
    wx.setStorageSync('merchantName', merchantName);
    wx.setStorageSync('tableNo', tableNo);

    this.setData({ merchantId, merchantName, tableNo, showSetup: false });
    this.loadProducts();
  },

  onChangeSeat() {
    this.setData({ showSetup: true, setupTableNo: this.data.tableNo });
  },

  // Product card
  onProductTap(e) {
    const product = e.currentTarget.dataset.product;
    wx.navigateTo({
      url: `/pages/detail/index?id=${product.id}`,
    });
  },

  onAddToCart(e) {
    const product = e.currentTarget.dataset.product;
    const cart = app.addToCart(product);
    this.setData({
      cart,
      cartCount: getCartCount(cart),
      cartTotal: getCartTotal(cart),
      products: this.mergeQty(this.data.products),
    });
  },

  onReduceFromCart(e) {
    const productId = e.currentTarget.dataset.id;
    const item = app.globalData.cart.find(i => i.id === productId);
    if (!item) return;
    const cart = app.updateCartQuantity(productId, item.quantity - 1);
    this.setData({
      cart,
      cartCount: getCartCount(cart),
      cartTotal: getCartTotal(cart),
      products: this.mergeQty(this.data.products),
    });
  },

  getQty(productId) {
    const item = this.data.cart.find(i => i.id === productId);
    return item ? item.quantity : 0;
  },

  onCartBarTap() {
    wx.navigateTo({ url: '/pages/cart/index' });
  },

  onTabProfile() {
    wx.navigateTo({ url: '/pages/profile/index' });
  },

  onPullDownRefresh() {
    this.loadProducts().then(() => wx.stopPullDownRefresh());
  },
});
