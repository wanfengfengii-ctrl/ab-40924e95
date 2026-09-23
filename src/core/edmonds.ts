/**
 * Chu-Liu / Edmonds 最小有向生成树（最小树形图）算法。
 *
 * 语义：给定根 root 与有向边集，选出恰好 |V|-1 条边，使根以外每个节点
 * 恰有一条入边、且全部节点可由根到达，总权重最小。
 *
 * 实现要点：
 *  - 权重为 bigint，比较与加减全程精确，可承载「代价 + 字典序扰动」的复合权重；
 *  - 递归收缩环：每轮为每个非根节点取最小入边，无环则收敛；
 *    有环则将环收缩为超节点，入环边权重减去环内目标点的最小入边权，递归求解后展开；
 *  - 展开时，环上被外部边「替换」的节点放弃其最小入边，其余环内最小入边保留。
 */

export interface WeightedEdge {
  /** 边的尾端（上游一侧）节点下标 */
  u: number;
  /** 边的头端（下游一侧）节点下标 */
  v: number;
  /** 精确权重 */
  w: bigint;
}

/** 收缩层内部使用的边：src 记录它在上一层边数组中的下标，用于展开时回溯 */
interface ContractedEdge extends WeightedEdge {
  src: number;
}

interface LevelResult {
  total: bigint;
  /** 选中的边在本层 edges 数组中的下标 */
  pick: number[];
}

function solveLevel(root: number, n: number, edges: WeightedEdge[]): LevelResult | null {
  // 1. 每个非根节点取最小入边
  const inW: (bigint | null)[] = new Array<bigint | null>(n).fill(null);
  const pre: number[] = new Array<number>(n).fill(-1);
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    if (e.v === root || e.u === e.v) continue;
    const cur = inW[e.v];
    if (cur === null || e.w < cur) {
      inW[e.v] = e.w;
      pre[e.v] = i;
    }
  }
  for (let v = 0; v < n; v++) {
    if (v !== root && inW[v] === null) return null; // 存在无入边节点：不可行
  }

  // 2. 在最小入边构成的函数图中找环
  const comp = new Array<number>(n).fill(-1);
  const inCycle = new Array<boolean>(n).fill(false);
  const seenFrom = new Array<number>(n).fill(-1);
  let cycles = 0;
  for (let s = 0; s < n; s++) {
    if (s === root) continue;
    let u = s;
    while (u !== root && comp[u] === -1 && seenFrom[u] !== s) {
      seenFrom[u] = s;
      u = edges[pre[u]].u;
    }
    if (u !== root && comp[u] === -1) {
      let x = u;
      do {
        comp[x] = cycles;
        inCycle[x] = true;
        x = edges[pre[x]].u;
      } while (x !== u);
      cycles++;
    }
  }

  // 3. 无环：最小入边即最优解
  if (cycles === 0) {
    let total = 0n;
    const pick: number[] = [];
    for (let v = 0; v < n; v++) {
      if (v === root) continue;
      total += inW[v] as bigint;
      pick.push(pre[v]);
    }
    return { total, pick };
  }

  // 4. 收缩：环内节点的最小入边权已在 cycleSum 中支付，入环边补差价
  let cycleSum = 0n;
  for (let v = 0; v < n; v++) {
    if (inCycle[v]) cycleSum += inW[v] as bigint;
  }
  for (let v = 0; v < n; v++) {
    if (comp[v] === -1) comp[v] = cycles++;
  }
  const contracted: ContractedEdge[] = [];
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const cu = comp[e.u];
    const cv = comp[e.v];
    if (cu === cv) continue;
    contracted.push({
      u: cu,
      v: cv,
      w: inCycle[e.v] ? e.w - (inW[e.v] as bigint) : e.w,
      src: i,
    });
  }

  const sub = solveLevel(comp[root], cycles, contracted);
  if (sub === null) return null;

  // 5. 展开：外部选中的边直接保留；环上被替换节点的最小入边放弃，其余保留
  const pick: number[] = [];
  const replaced = new Array<boolean>(n).fill(false);
  for (const j of sub.pick) {
    const src = contracted[j].src;
    pick.push(src);
    const head = edges[src].v;
    if (inCycle[head]) replaced[head] = true;
  }
  for (let v = 0; v < n; v++) {
    if (inCycle[v] && !replaced[v]) pick.push(pre[v]);
  }
  return { total: cycleSum + sub.total, pick };
}

export interface ArborescenceEdge extends WeightedEdge {
  /** 业务链路编号，随边穿越各层收缩保持不变 */
  id: number;
}

export interface ArborescenceResult {
  /** 选中边的复合权重总和（含扰动，仅供校验与调试） */
  total: bigint;
  /** 选中业务链路的编号 */
  ids: number[];
}

/**
 * 求以 root 为根的最小有向生成树；不存在（有节点不可达）时返回 null。
 * 节点用 0..nodeCount-1 的下标表示。
 */
export function minArborescence(
  root: number,
  nodeCount: number,
  edges: ArborescenceEdge[],
): ArborescenceResult | null {
  const res = solveLevel(root, nodeCount, edges);
  if (res === null) return null;
  return { total: res.total, ids: res.pick.map((i) => edges[i].id) };
}
