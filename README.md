# 授时网络追溯树规划台（Timing Arborescence Planner）

精密试验场升级授时网络时的**纯前端**规划工具：工程师在页面编辑或导入节点、主钟与候选有向链路，
求解每台从钟应接收哪一条上游时源（父链路），使所有设备最终都能追溯到主钟，且总安装代价最小。

- **全局最优**：使用 Edmonds（Chu–Liu/Edmonds）有根最小树形图算法求最小代价有向生成树（spanning arborescence），
  而**不是逐节点贪心**——逐台选最便宜入边可能形成闭环，闭环内设备永远无法追溯到主钟。
- **并列裁决**：存在多个同代价最优树时，取所选链路编号升序数组**字典序最小**者
  （按编号升序逐条做"强制纳入 + 可行性/最优性验算"精确裁决）。
- **完全本地**：所有业务计算在浏览器内完成，无任何后端请求。

## 业务规则

- 节点 2～40 个，id 唯一；恰有一个主钟（根）。
- 候选链路 1～120 条，编号唯一（正整数）；端点必须存在且互不相同；安装代价为正整数。
- 主钟不得有入边；其余每台从钟恰选一条入边，且必须由主钟沿所选边可达。
- 字段错误一次性全部定位反馈（如 `links[3].cost`）。
- 结构合法但无法覆盖全部节点时，明确列出在候选图中从主钟**不可达的节点**。
- 输入一旦变化，旧结果立即标记失效，需重新计算。
- 成功后可点选任一从钟，逐段核对到主钟的完整路径与累计代价。

## 本地开发

```bash
npm install
npm run dev       # 开发服务器
npm test          # Vitest：校验/解析/求解器，含随机图对全枚举的交叉验证
npm run build     # 类型检查 + 生产构建到 dist/
npm run preview   # 本地预览生产产物
```

## 导入格式

支持 JSON：

```json
{
  "nodes": [{ "id": "M", "master": true }, { "id": "A" }],
  "links": [{ "no": 1, "from": "M", "to": "A", "cost": 3 }]
}
```

也接受字段别名 `name / isMaster / source / target / weight`，以及简洁文本：

```
nodes:
  M (master)
  A
links:
  1 | M -> A | 3
```

## Docker

构建并启动静态站点（宿主机端口可通过 `HOST_PORT` 配置，默认 8080）：

```bash
docker compose up -d web
# 自定义端口：
HOST_PORT=9090 docker compose up -d web
# 或 cp .env.example .env 后修改 HOST_PORT
```

站点带 `/health` 健康检查（Dockerfile 与 Compose 均配置了 healthcheck）。

### verify 一次性服务

`verify` 服务完成 **单元测试 → 生产构建 → 对 web 静态站点的 HTTP 冒烟** 后自行退出，
并以退出码报告结果（0 成功 / 非零失败）：

```bash
docker compose run --rm verify
```

它通过 `depends_on: service_healthy` 等待 web 健康后，校验 `/health`、首页以及首页引用的全部
JS/CSS 资源均可达且非空。

## 目录结构

```
src/
  lib/model.ts      领域模型与字段级校验、可达性
  lib/solver.ts     Edmonds 收缩算法 + 强制边收缩的字典序裁决
  lib/io.ts         JSON / 文本导入导出
  components/       节点表、链路表、结果面板、导入弹窗
  App.tsx           编辑、失效控制与结果编排
docker/             nginx 配置与 verify.sh 冒烟脚本
Dockerfile          deps → build（→ verify）→ nginx runtime 多阶段
docker-compose.yml  web（可配置端口 + 健康检查）与 verify 一次性服务
```
