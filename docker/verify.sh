#!/bin/sh
# verify 一次性服务入口：
#   1) 运行全部单元测试（含全枚举交叉验证）
#   2) 类型检查 + 生产构建
#   3) 对已健康运行的静态站点（web 服务）做 HTTP 冒烟
# 任一步失败即以非零退出码自行退出。
set -eu

echo "== [1/3] 运行单元测试 =="
npm test

echo "== [2/3] 类型检查与生产构建 =="
npm run build

echo "== [3/3] 静态站点 HTTP 冒烟（http://web/） =="
BASE_URL="${SMOKE_BASE_URL:-http://web}"

# 轮询等待 web 健康（depends_on 已保证 healthy，这里再做应用层确认）
i=0
until wget -q -O - "${BASE_URL}/health" | grep -q '^ok$'; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "健康检查在 30 次尝试后仍未通过" >&2
    exit 1
  fi
  sleep 2
done
echo "  /health -> ok"

# 首页可达且包含 React 挂载点
INDEX="$(wget -q -O - "${BASE_URL}/")"
echo "$INDEX" | grep -q '<div id="root"></div>'
echo "  / 包含 #root 挂载点"

# 首页引用的 JS/CSS 资源必须全部能取到（HTTP 200 且非空）
echo "$INDEX" | grep -oE '(src|href)="[^"]+"' | sed -E 's/^(src|href)="//; s/"$//' |
  while read -r asset; do
    case "$asset" in
      http*) url="$asset" ;;
      /*) url="${BASE_URL}${asset}" ;;
      *) url="${BASE_URL}/${asset}" ;;
    esac
    body="$(wget -q -O - "$url")"
    [ -n "$body" ] || { echo "资源为空或不可达: $url" >&2; exit 1; }
    echo "  $asset -> 200 ($(printf '%s' "$body" | wc -c) bytes)"
  done

echo ""
echo "VERIFY_OK：测试、生产构建与静态站点冒烟全部通过"
