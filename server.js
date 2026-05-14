const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dataFile = (name) => path.join(__dirname, 'data', name);
const read = (name) => JSON.parse(fs.readFileSync(dataFile(name), 'utf8'));
const write = (name, data) => fs.writeFileSync(dataFile(name), JSON.stringify(data, null, 2));

// ── Products ──────────────────────────────────────────────
app.get('/api/products', (req, res) => {
  const products = read('products.json');
  const { category } = req.query;
  res.json(category && category !== '全部' ? products.filter(p => p.category === category) : products);
});

// ── Merchants ─────────────────────────────────────────────
app.get('/api/merchants', (_, res) => res.json(read('merchants.json')));

app.post('/api/merchants', (req, res) => {
  const merchants = read('merchants.json');
  const merchant = { id: Date.now(), ...req.body, createdAt: new Date().toISOString() };
  merchants.push(merchant);
  write('merchants.json', merchants);
  res.json(merchant);
});

app.put('/api/merchants/:id', (req, res) => {
  const merchants = read('merchants.json');
  const i = merchants.findIndex(m => m.id == req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  merchants[i] = { ...merchants[i], ...req.body };
  write('merchants.json', merchants);
  res.json(merchants[i]);
});

app.delete('/api/merchants/:id', (req, res) => {
  const merchants = read('merchants.json').filter(m => m.id != req.params.id);
  write('merchants.json', merchants);
  res.json({ ok: true });
});

// ── Orders ────────────────────────────────────────────────
app.get('/api/orders', (_, res) => res.json(read('orders.json')));

app.post('/api/orders', (req, res) => {
  const orders = read('orders.json');
  const order = { id: Date.now(), ...req.body, createdAt: new Date().toISOString(), status: 'paid' };
  orders.push(order);
  write('orders.json', orders);
  res.json(order);
});

// ── Merchant sales stats ──────────────────────────────────
app.get('/api/stats', (_, res) => {
  const orders = read('orders.json');
  const merchants = read('merchants.json');
  const stats = merchants.map(m => {
    const mo = orders.filter(o => o.merchantId === m.id);
    const totalQuantity = mo.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0);
    const totalRevenue = mo.reduce((s, o) => s + o.total, 0);
    return { id: m.id, name: m.name, status: m.status, orderCount: mo.length, totalQuantity, totalRevenue };
  });
  res.json(stats);
});

// ── Summary stats ─────────────────────────────────────────
app.get('/api/stats/summary', (_, res) => {
  const orders = read('orders.json');
  const merchants = read('merchants.json');
  const today = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === today);
  res.json({
    totalOrders: orders.length,
    totalRevenue: orders.reduce((s, o) => s + o.total, 0),
    merchantCount: merchants.length,
    todayOrders: todayOrders.length
  });
});

app.listen(PORT, () => {
  console.log(`✅ 服务已启动: http://localhost:${PORT}`);
  console.log(`   顾客端: http://localhost:${PORT}/customer/`);
  console.log(`   管理后台: http://localhost:${PORT}/admin/`);
});
