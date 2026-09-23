# syntax=docker/dockerfile:1

# ---- 依赖层 ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---- 生产构建层（同时供 verify 与静态站点使用） ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- verify 一次性服务：代码测试 -> 生产构建 -> 静态站点 HTTP 冒烟 ----
FROM build AS verify
# BusyBox 自带 wget；冒烟脚本对 web 服务与本地资源做断言
COPY docker/verify.sh /usr/local/bin/verify.sh
RUN chmod +x /usr/local/bin/verify.sh
CMD ["/usr/local/bin/verify.sh"]

# ---- 静态站点运行层 ----
FROM nginx:1.27-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
