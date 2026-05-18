const app = getApp();
const { request } = require('../../utils/request');
const { getCartCount, getCartTotal, showError } = require('../../utils/util');

Page({
  data: {
    product: null,
    loading: true,
    qty: 0,
    cart: [],
    cartCount: 0,
    cartTotal: 0,
  },

  onLoad(options) {
    const id = options.id;
    this.productId = id;
    const cart = app.globalData.cart;
    const item = cart.find(i => String(i.id) === String(id));
    this.setData({
      cart,
      qty: item ? item.quantity : 0,
      cartCount: getCartCount(cart),
      cartTotal: getCartTotal(cart),
    });
    this.loadProduct(id);
  },

  async loadProduct(id) {
    try {
      const merchantId = app.globalData.merchantId;
      const products = await request({ url: `/api/products?merchant_id=${merchantId}` });
      const product = products.find(p => String(p.id) === String(id));
      if (product) {
        wx.setNavigationBarTitle({ title: product.name });
        this.setData({ product, loading: false });
      } else {
        this.setData({ loading: false });
        showError('商品不存在');
      }
    } catch (e) {
      this.setData({ loading: false });
      showError('加载失败');
    }
  },

  onAdd() {
    const { product } = this.data;
    const cart = app.addToCart(product);
    const item = cart.find(i => i.id === product.id);
    this.setData({ cart, qty: item ? item.quantity : 0, cartCount: getCartCount(cart), cartTotal: getCartTotal(cart) });
  },

  onReduce() {
    const { product, qty } = this.data;
    if (qty <= 0) return;
    const cart = app.updateCartQuantity(product.id, qty - 1);
    this.setData({ cart, qty: qty - 1, cartCount: getCartCount(cart), cartTotal: getCartTotal(cart) });
  },

  onCartTap() {
    wx.navigateTo({ url: '/pages/cart/index' });
  },

  onBack() {
    wx.navigateBack();
  },
});
