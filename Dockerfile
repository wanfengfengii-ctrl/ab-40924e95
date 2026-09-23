# syntax=docker/dockerfile:1

########## 构建阶段：安装依赖并产出静态文件 ##########
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

########## 一次性验证阶段：代码测试 + 生产构建 + 静态站点 HTTP 冒烟 ##########
# 用法：docker compose run --rm verify
# 容器执行完毕自行退出，退出码即验证结果（0 通过，非 0 失败）。
FROM node:20-alpine AS verify
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
CMD ["sh", "scripts/verify.sh"]

########## 运行阶段：nginx 静态站点（默认构建目标） ##########
FROM nginx:1.27-alpine AS app
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
