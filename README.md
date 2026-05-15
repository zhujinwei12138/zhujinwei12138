# 啤酒小程序 🍺

一套面向实体啤酒吧/精酿店的**商用点单 SaaS 系统**，支持多商家、在线支付、实时备餐追踪、顾客账号体系与管理后台全流程。

---

## 目录

1. [功能概览](#功能概览)
2. [技术架构](#技术架构)
3. [快速启动（本地开发）](#快速启动本地开发)
4. [生产环境部署](#生产环境部署)
5. [环境变量说明](#环境变量说明)
6. [顾客端使用教程](#顾客端使用教程)
7. [管理后台使用教程](#管理后台使用教程)
8. [真实支付接入指南](#真实支付接入指南)
9. [API 接口参考](#api-接口参考)
10. [运维与监控](#运维与监控)
11. [上线前检查清单](#上线前检查清单)

---

## 功能概览

### 顾客端
- 扫桌贴二维码 → 无需下载 App，浏览器直接点单
- 按品类（精酿 / 瓶装 / 罐装）浏览商品，支持图片展示
- 桌号自主设置，购物车实时汇总
- 微信支付 / 支付宝 扫码付款
- 手机号 OTP 登录，查看历史订单
- 支付后实时追踪订单状态（备餐中 → 已完成）

### 管理后台
- 商家管理：新增 / 编辑 / 停用商家，复制顾客点单链接
- 商品管理：增删改查，上传商品图片，库存管理
- 订单管理：实时列表，一键标记备餐 / 完成 / 取消
- 支付管理：查看支付记录，在线退款
- 多管理员：超级管理员 + 商家管理员两级权限
- 操作审计：所有写操作留痕，防止内部纠纷

---

## 技术架构

```
┌──────────────┐   HTTPS    ┌─────────────────────────────────────┐
│  顾客手机浏览器 │ ─────────► │  Nginx (TLS 终端 + 反向代理)          │
│  管理员浏览器  │           │  ↓                                  │
└──────────────┘           │  FastAPI (uvicorn, 4 workers)        │
                           │  ↓              ↓                    │
                           │  PostgreSQL 16  Redis 7              │
                           └─────────────────────────────────────┘
```

| 层级 | 技术 |
|------|------|
| 后端框架 | FastAPI (Python 3.12, 异步) |
| 数据库 | PostgreSQL 16 + SQLAlchemy 2.0 async |
| 缓存/队列 | Redis 7 (缓存 + 限流 + SSE pub/sub) |
| 认证 | JWT HS256（管理员 8h / 顾客 72h）+ bcrypt |
| 前端 | 原生 HTML/CSS/JS（无构建工具，即开即用）|
| 容器 | Docker + Docker Compose |
| 反向代理 | Nginx 1.27（TLS 1.2/1.3, HSTS）|

---

## 快速启动（本地开发）

### 前置要求

- Docker Desktop（或 Docker Engine + Docker Compose V2）
- Git

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/zhujinwei12138/zhujinwei12138.git
cd zhujinwei12138

# 2. 复制配置文件（开发模式默认值即可直接运行）
cp .env.example .env

# 3. 启动服务（首次启动会拉取镜像并构建，约 2-3 分钟）
docker compose up -d

# 4. 查看启动日志，等待 "Application startup complete"
docker compose logs -f app
```

启动成功后访问：

| 地址 | 说明 |
|------|------|
| http://localhost:3000/admin/ | 管理后台 |
| http://localhost:3000/customer/?mid=1 | 顾客点单页（商家 ID=1：海湾精酿吧）|
| http://localhost:3000/health | 健康检查 |
| http://localhost:3000/docs | Swagger API 文档 |

> **默认管理员账号**  
> 用户名：`admin`  密码：`admin2024`  
> 首次使用请立即在管理后台 → 管理员账号 → 修改密码。

### 停止服务

```bash
docker compose down          # 停止容器，保留数据库数据
docker compose down -v       # 停止并清除所有数据（慎用）
```

---

## 生产环境部署

### 1. 服务器准备

推荐配置：2 核 CPU / 2GB 内存 / 40GB SSD，Ubuntu 22.04 LTS。

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
```

### 2. 配置环境变量

```bash
cp .env.example .env
nano .env
```

**生产环境必须修改的变量**（见 [环境变量说明](#环境变量说明)）：

- `DB_PASSWORD` — 数据库密码
- `REDIS_PASSWORD` — Redis 密码
- `ADMIN_SECRET_KEY` — JWT 签名密钥
- `ADMIN_PASS_HASH` — 管理员密码哈希（或 `ADMIN_PASS`）
- `PAYMENT_WEBHOOK_SECRET` — 支付回调验签密钥
- `ALLOWED_ORIGINS` — 允许的前端域名

### 3. 生成 TLS 证书

**方式 A：Let's Encrypt（推荐，需要域名）**

```bash
# 安装 certbot
sudo apt install certbot

# 申请证书（请替换为实际域名）
sudo certbot certonly --standalone -d your-domain.com

# 将证书路径写入 nginx/nginx.conf
# ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

# 证书会每 90 天自动续期，无需手动操作
```

**方式 B：自签名证书（内网 / 测试）**

```bash
bash nginx/gen-self-signed.sh
# 生成 nginx/certs/server.crt 和 nginx/certs/server.key
```

### 4. 启动生产服务（含 Nginx）

```bash
# --profile prod 额外启动 nginx 服务
docker compose --profile prod up -d

# 查看所有服务状态
docker compose --profile prod ps
```

### 5. 设置开机自启

```bash
sudo systemctl enable docker
# docker compose 本身已配置 restart: unless-stopped，系统重启后容器自动恢复
```

### 6. 数据备份

```bash
# 导出数据库（建议每天定时执行）
docker compose exec db pg_dump -U beer beerdb > backup_$(date +%Y%m%d).sql

# 恢复
docker compose exec -T db psql -U beer beerdb < backup_20260101.sql
```

---

## 环境变量说明

编辑项目根目录的 `.env` 文件：

```dotenv
# ── 数据库 ─────────────────────────────────────────────────────
DB_USER=beer
DB_PASSWORD=【生产必改】强密码，例如：openssl rand -base64 24
DB_NAME=beerdb

# ── Redis ──────────────────────────────────────────────────────
# 生成命令：python -c "import secrets; print(secrets.token_hex(24))"
REDIS_PASSWORD=【生产必改】

# ── 管理员认证 ─────────────────────────────────────────────────
# 生成命令：python -c "import secrets; print(secrets.token_hex(32))"
ADMIN_SECRET_KEY=【生产必改】

ADMIN_USER=admin

# 推荐用哈希（不在配置文件存明文）：
# 生成命令：python -c "import bcrypt; print(bcrypt.hashpw(b'YOUR_PASS', bcrypt.gensalt(12)).decode())"
ADMIN_PASS_HASH=$2b$12$...

# 开发时也可直接填明文（首次启动自动 hash）：
ADMIN_PASS=admin2024

ADMIN_TOKEN_TTL_HOURS=8   # 管理员 token 有效时长（小时）

# ── 支付 ───────────────────────────────────────────────────────
# 生成命令：python -c "import secrets; print(secrets.token_hex(32))"
PAYMENT_WEBHOOK_SECRET=【生产必改，否则回调接口返回 500】

# mock = 演示模式（启用 mock-pay 端点，无需真实网关）
# live = 生产模式（调用微信/支付宝，mock-pay 返回 404）
PAYMENT_MODE=mock

# ── 微信支付 v3（PAYMENT_MODE=live 时填写）─────────────────────
WECHAT_MCH_ID=          # 商户号
WECHAT_APP_ID=          # 小程序/公众号 AppID
WECHAT_API_V3_KEY=      # APIv3 密钥
WECHAT_CERT_SERIAL_NO=  # 证书序列号
WECHAT_PRIVATE_KEY_PATH=/app/certs/wechat_private_key.pem
WECHAT_NOTIFY_URL=https://your-domain.com/api/payments/callback/wechat

# ── 支付宝（PAYMENT_MODE=live 时填写）─────────────────────────
ALIPAY_APP_ID=
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_PRIVATE_KEY=     # 应用私钥（PKCS1）
ALIPAY_PUBLIC_KEY=      # 支付宝公钥
ALIPAY_NOTIFY_URL=https://your-domain.com/api/payments/callback/alipay

# ── 顾客 OTP ───────────────────────────────────────────────────
# true = 接口响应中返回验证码（方便调试）；生产必须设 false
DEMO_MODE=false

# ── CORS ───────────────────────────────────────────────────────
# 生产填写实际域名，逗号分隔：https://your-domain.com
ALLOWED_ORIGINS=*
```

---

## 顾客端使用教程

### 1. 获取点单链接

顾客点单地址格式：`https://your-domain.com/customer/?mid={商家ID}`

在管理后台 → **商家管理** → 对应商家行点击"复制链接"，即可获得带商家 ID 的完整 URL。

### 2. 生成桌贴二维码

推荐使用任意二维码生成工具，将以下 URL 生成二维码后打印贴到桌面：

```
https://your-domain.com/customer/?mid=1
```

> 提示：不同桌号共用同一个商家二维码即可。顾客扫码后系统会提示输入桌号，桌号信息会保存在本地浏览器，下次无需重新输入。

### 3. 顾客下单流程

```
扫码进入页面
    ↓
首次使用：弹出桌号输入框，填写桌号（如：A3、8号桌）后确认
    ↓
浏览商品，点击"＋"加入购物车
    ↓
购物车图标显示商品数量和总价，点击展开查看
    ↓
点击"去结算" → 确认订单
    ↓
选择支付方式（微信 / 支付宝）→ 弹出付款码
    ↓
演示模式（PAYMENT_MODE=mock）：页面显示"模拟支付"按钮，点击即视为付款成功
真实模式：扫描二维码完成支付
    ↓
支付成功 → 实时显示订单状态（备餐中 / 已完成）
```

### 4. 顾客账号（可选）

手机号登录后可查看历史订单：

1. 点击页面右上角的账号图标
2. 输入手机号 → 点击"获取验证码"
3. 输入收到的 6 位短信验证码
4. 登录后可在"我的订单"查看所有历史消费记录

> **演示模式**（`DEMO_MODE=true`）：验证码直接显示在接口响应中，方便测试，生产环境务必设为 `false`。

---

## 管理后台使用教程

访问 `https://your-domain.com/admin/`，使用管理员账号登录。

### 商家管理

**适用角色：超级管理员**

| 操作 | 步骤 |
|------|------|
| 新增商家 | 点击"新增商家" → 填写名称、电话、地址、桌数 → 保存 |
| 编辑商家 | 商家列表行点击"编辑" → 修改信息 → 保存 |
| 停用商家 | 编辑商家 → 状态改为"inactive" → 保存（顾客端仍可访问，但无新订单推送）|
| 复制点单链接 | 商家行点击"复制链接"，将链接发给商家老板用于生成二维码 |
| 删除商家 | 商家行点击"删除"（有订单的商家无法删除，需先处理订单）|

### 商品管理

**适用角色：超级管理员 / 商家管理员（仅本商家）**

| 操作 | 步骤 |
|------|------|
| 新增商品 | 点击"新增商品" → 填写名称、描述、规格、酒精度、价格、品类（精酿/瓶装/罐装）、库存 → 保存 |
| 上传图片 | 商品行点击"上传图片" → 选择图片（JPG/PNG/WebP/GIF，≤5MB）→ 自动上传 |
| 修改价格/库存 | 商品行点击"编辑" → 修改对应字段 → 保存 |
| 库存为空 | 将库存设为 0，顾客端该商品显示为售罄，无法加入购物车 |
| 不限库存 | 库存字段留空（`null`），系统不做扣减，适合不需要精细管控的商品 |
| 删除商品 | 商品行点击"删除" |

### 订单管理

**实时刷新：每 30 秒自动更新一次**

| 订单状态 | 含义 | 可执行操作 |
|---------|------|----------|
| `paid` 已支付 | 顾客已付款，等待备餐 | → 标记为"备餐中" |
| `preparing` 备餐中 | 正在制作 | → 标记为"已完成" / "取消" |
| `completed` 已完成 | 已出餐 | — |
| `cancelled` 已取消 | 已取消 | — |

操作步骤：订单列表行点击对应状态按钮，系统通过 SSE 实时推送状态变更给顾客手机。

**筛选订单**：列表顶部可按"状态"和"商家"下拉筛选。

### 支付管理

| 操作 | 步骤 |
|------|------|
| 查看支付详情 | 支付列表行点击"查看" |
| 退款 | 支付行点击"退款" → 填写退款原因 → 确认（退款后库存自动恢复）|

> 退款会同步调用支付网关（真实模式），退款结果以支付网关返回为准。

### 管理员账号管理

**适用角色：超级管理员**

| 操作 | 步骤 |
|------|------|
| 新增管理员 | 管理员账号 → 新增 → 填写用户名、密码、角色（超级管理员/商家管理员）|
| 商家管理员 | 创建时选择角色"商家管理员"并绑定对应商家，该账号只能管理绑定商家的商品和订单 |
| 修改密码 | 账号列表行点击"改密" → 输入新密码 |
| 停用账号 | 账号列表行点击"停用"（停用后该账号无法登录）|

### 操作审计

所有写操作（创建、修改、删除、退款等）均自动记录：

- 操作时间、操作人、操作类型
- 操作对象和 ID
- 操作详情（变更内容）
- 请求 IP

审计日志**只读**，无法删除，用于内部存档和纠纷追溯。

---

## 真实支付接入指南

> 当前默认为 `PAYMENT_MODE=mock` 演示模式。接入真实支付前请完成商户资质申请。

### 微信支付 v3 接入

1. 登录 [微信支付商户平台](https://pay.weixin.qq.com)，完成商户号申请
2. 开通"Native 支付"（扫码支付）
3. 下载商户 API 证书，将私钥文件放置到服务器 `/app/certs/wechat_private_key.pem`
4. 在 `.env` 中填写：
   ```
   PAYMENT_MODE=live
   WECHAT_MCH_ID=1234567890
   WECHAT_APP_ID=wx1234567890abcdef
   WECHAT_API_V3_KEY=32位APIv3密钥
   WECHAT_CERT_SERIAL_NO=证书序列号
   WECHAT_PRIVATE_KEY_PATH=/app/certs/wechat_private_key.pem
   WECHAT_NOTIFY_URL=https://your-domain.com/api/payments/callback/wechat
   ```
5. 在微信支付商户平台配置回调通知地址：`https://your-domain.com/api/payments/callback/wechat`

### 支付宝接入

1. 登录 [支付宝开放平台](https://open.alipay.com)，创建应用
2. 开通"当面付"能力
3. 配置应用公钥，下载支付宝公钥
4. 在 `.env` 中填写：
   ```
   PAYMENT_MODE=live
   ALIPAY_APP_ID=2021000000000000
   ALIPAY_PRIVATE_KEY=MIIEow...（应用私钥）
   ALIPAY_PUBLIC_KEY=MIIBIj...（支付宝公钥）
   ALIPAY_NOTIFY_URL=https://your-domain.com/api/payments/callback/alipay
   ```
5. 在支付宝开放平台配置异步通知地址

> **安全提示**：私钥文件权限设为 `chmod 600`，不要提交到代码仓库。

---

## API 接口参考

完整交互式文档访问：`https://your-domain.com/docs`

### 公开接口（无需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/products` | 获取商品列表，支持 `?category=精酿` 筛选 |
| GET | `/api/merchants/{id}` | 获取商家信息 |
| POST | `/api/orders` | 创建订单 |
| GET | `/api/orders/{id}` | 查询订单详情 |
| GET | `/api/orders/{id}/stream` | SSE 订单状态实时推送 |
| POST | `/api/payments/create` | 创建支付 |
| GET | `/api/payments/{id}` | 查询支付详情 |
| POST | `/api/payments/{id}/mock-pay` | 模拟支付（仅 `PAYMENT_MODE=mock`）|
| POST | `/api/customers/send-otp` | 发送 OTP 验证码 |
| POST | `/api/customers/verify-otp` | 验证 OTP，返回 JWT |

### 顾客认证接口

在请求头中携带顾客 JWT：`Authorization: Bearer {token}`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/customers/me/orders` | 查询本人历史订单 |

### 管理员接口（需要管理员 JWT）

先调用登录接口获取 token，后续请求在头部携带：`Authorization: Bearer {admin_token}`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/admin/login` | 管理员登录 | 公开 |
| GET | `/api/merchants` | 获取商家列表 | 管理员 |
| POST | `/api/merchants` | 创建商家 | 超级管理员 |
| PUT | `/api/merchants/{id}` | 更新商家 | 超级管理员 |
| DELETE | `/api/merchants/{id}` | 删除商家 | 超级管理员 |
| POST | `/api/products` | 创建商品 | 管理员 |
| PUT | `/api/products/{id}` | 更新商品 | 管理员 |
| DELETE | `/api/products/{id}` | 删除商品 | 管理员 |
| POST | `/api/products/{id}/image` | 上传商品图片 | 管理员 |
| GET | `/api/orders` | 获取订单列表 | 管理员 |
| PATCH | `/api/orders/{id}/status` | 更新订单状态 | 管理员 |
| GET | `/api/payments` | 获取支付列表 | 管理员 |
| POST | `/api/payments/{id}/refund` | 退款 | 管理员 |
| GET | `/api/admin/users` | 获取管理员列表 | 超级管理员 |
| POST | `/api/admin/users` | 创建管理员 | 超级管理员 |
| PUT | `/api/admin/users/{id}/password` | 修改密码 | 超级管理员 |
| DELETE | `/api/admin/users/{id}` | 删除管理员 | 超级管理员 |
| GET | `/api/admin/audit-logs` | 查看审计日志 | 管理员 |
| GET | `/api/admin/stats` | 数据统计 | 管理员 |

---

## 运维与监控

### 健康检查

```bash
curl https://your-domain.com/health
# 正常响应：{"status":"ok","db":"ok","redis":"ok"}
```

Docker 容器内置健康检查，每 30 秒自动探测一次。

### 查看日志

```bash
# 所有服务日志
docker compose logs -f

# 仅应用日志（JSON 格式，包含请求耗时）
docker compose logs -f app

# 过滤 ERROR 级别
docker compose logs app | grep '"level":"error"'
```

### 更新部署

```bash
git pull origin main
docker compose build app
docker compose --profile prod up -d app
```

> 数据库迁移在应用启动时自动执行，无需手动操作。

### 扩容

如需处理更高并发，调整 Dockerfile 的 uvicorn 启动参数：

```dockerfile
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000", "--workers", "8"]
```

---

## 上线前检查清单

在真实商用前，请逐项确认：

**安全配置**
- [ ] `ADMIN_SECRET_KEY` 已改为随机 64 字符字符串
- [ ] `DB_PASSWORD` 已改为强密码
- [ ] `REDIS_PASSWORD` 已改为强密码
- [ ] `PAYMENT_WEBHOOK_SECRET` 已设置并与支付网关配置一致
- [ ] `ADMIN_PASS` 已删除，改用 `ADMIN_PASS_HASH`
- [ ] `DEMO_MODE=false`（生产环境不返回验证码明文）
- [ ] `ALLOWED_ORIGINS` 已改为实际域名

**支付配置**
- [ ] `PAYMENT_MODE` 已改为 `live`
- [ ] 微信支付 / 支付宝配置已填写并测试
- [ ] 回调地址已在支付网关后台配置
- [ ] 私钥文件权限为 `600`

**TLS 证书**
- [ ] 使用有效 TLS 证书（Let's Encrypt 或商业证书）
- [ ] HTTP → HTTPS 强制跳转已生效
- [ ] 证书自动续期已配置

**数据**
- [ ] 管理后台已创建商家信息
- [ ] 商品信息已录入，图片已上传
- [ ] 已为每个商家配置专属管理员账号
- [ ] 已生成各商家桌贴二维码并打印

**运维**
- [ ] 数据库定时备份已配置
- [ ] 服务器防火墙仅开放 80、443 端口
- [ ] 已测试完整下单 → 支付 → 备餐 → 完成流程
