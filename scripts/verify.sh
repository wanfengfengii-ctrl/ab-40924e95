#!/bin/sh
# 一次性验证：代码测试 → 生产构建 → 静态站点 HTTP 冒烟
# 任一步骤失败即以非零退出码终止；全部通过输出 VERIFY PASSED 并以 0 退出。
set -e
cd "$(dirname "$0")/.."

if [ ! -d node_modules ]; then
  echo "==> [0/3] 安装依赖 (npm ci)"
  npm ci --no-audit --no-fund
fi

echo "==> [1/3] 代码测试 (vitest run)"
npm run test

echo "==> [2/3] 生产构建 (tsc --noEmit && vite build)"
npm run build

echo "==> [3/3] 静态站点 HTTP 冒烟"
node scripts/smoke.mjs dist

echo "==> VERIFY PASSED"
