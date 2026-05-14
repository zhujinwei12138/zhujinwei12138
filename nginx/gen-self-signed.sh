#!/bin/sh
# 生成自签名证书用于本地开发/测试
# 生产环境请使用 Let's Encrypt：
#   certbot certonly --webroot -w /var/www/certbot -d yourdomain.com
mkdir -p certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/server.key \
  -out certs/server.crt \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=BeerShop/CN=localhost"
echo "自签名证书已生成到 nginx/certs/"
