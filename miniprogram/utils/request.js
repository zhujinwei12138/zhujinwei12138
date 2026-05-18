const app = getApp();

function request(options) {
  const { url, method = 'GET', data, auth = false, customerAuth = false } = options;
  const baseUrl = app.globalData.baseUrl;

  return new Promise((resolve, reject) => {
    const header = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = wx.getStorageSync('adminToken');
      if (token) header['Authorization'] = `Bearer ${token}`;
    }
    if (customerAuth) {
      const token = wx.getStorageSync('customerToken');
      if (token) header['Authorization'] = `Bearer ${token}`;
    }

    wx.request({
      url: baseUrl + url,
      method,
      data,
      header,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          wx.removeStorageSync('adminToken');
          wx.removeStorageSync('customerToken');
          reject({ code: 401, message: '登录已过期，请重新登录' });
        } else {
          const msg = (res.data && (res.data.detail || res.data.message)) || `请求失败 (${res.statusCode})`;
          reject({ code: res.statusCode, message: msg });
        }
      },
      fail(err) {
        reject({ code: 0, message: '网络错误，请检查网络连接' });
      },
    });
  });
}

module.exports = { request };
