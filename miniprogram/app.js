App({
  globalData: {
    // Change to your deployed backend URL
    baseUrl: 'http://localhost:8000',
    cart: [],
    merchantId: null,
    merchantName: '',
    tableNo: '',
  },

  onLaunch() {
    this.globalData.cart = wx.getStorageSync('cart') || [];
    this.globalData.merchantId = wx.getStorageSync('merchantId') || null;
    this.globalData.merchantName = wx.getStorageSync('merchantName') || '';
    this.globalData.tableNo = wx.getStorageSync('tableNo') || '';
  },

  saveCart(cart) {
    this.globalData.cart = cart;
    wx.setStorageSync('cart', cart);
  },

  getCartCount() {
    return this.globalData.cart.reduce((s, i) => s + i.quantity, 0);
  },

  getCartTotal() {
    return this.globalData.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  },

  addToCart(product) {
    const cart = [...this.globalData.cart];
    const idx = cart.findIndex(i => i.id === product.id);
    if (idx >= 0) {
      cart[idx] = { ...cart[idx], quantity: cart[idx].quantity + 1 };
    } else {
      cart.push({ ...product, quantity: 1 });
    }
    this.saveCart(cart);
    return cart;
  },

  updateCartQuantity(productId, quantity) {
    let cart = [...this.globalData.cart];
    if (quantity <= 0) {
      cart = cart.filter(i => i.id !== productId);
    } else {
      cart = cart.map(i => i.id === productId ? { ...i, quantity } : i);
    }
    this.saveCart(cart);
    return cart;
  },

  clearCart() {
    this.saveCart([]);
  },
});
