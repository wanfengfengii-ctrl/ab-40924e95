/**
 * 求解器：以主钟为根的最小代价有向生成树（minimum-cost spanning arborescence）。
 *
 * 全局裁决使用 Edmonds（Chu–Liu）收缩算法，而非逐节点贪心：
 * 逐节点独立挑选最便宜入边可能形成闭环，闭环内设备永远无法追溯到主钟；
 * Edmonds 通过检测环、收缩环、改写边权后递归求解，再展开环，保证全局最优。
 *
 * 同代价裁决：要求所选链路编号的升序数组字典序最小。
 * 做法是按编号从小到大逐条尝试“强制纳入”——把强制边预先收缩为一个分量
 * （强制边构成的部分森林若出现入度冲突或环即不可行），再用 Edmonds 求
 * 包含这些强制边的最优树；若其总代价仍等于全局最优，则该编号可纳入。
 * 依次裁决得到的恰为字典序最小的最优解。
 */

import {
  PlannedPath,
  ParentChoice,
  SolveResult,
  ValidModel,
  reachableFromMaster,
} from './model';

interface E {
  no: number;
  u: number;
  v: number;
  w: number;
}

/** 并查集（强制边收缩用） */
class DSU {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
}

/**
 * 朴素 Edmonds：在 n 个节点、根为 root 的图上求最小入边树。
 * edges 中每条边带原始编号 no；同权时按 no 升序选取（唯一编号，无并列歧义）。
 * 返回入选边的原始编号集合；不可行（存在非根节点无入边）返回 null。
 *
 * 入参图假定已不含自环。
 */
function edmonds(edges: E[], root: number, n: number): Set<number> | null {
  if (n === 1) return new Set<number>();

  // 1. 每个非根节点选当前最便宜入边
  const chosen: (E | null)[] = new Array(n).fill(null);
  for (const e of edges) {
    if (e.v === root) continue;
    const cur = chosen[e.v];
    if (!cur || e.w < cur.w || (e.w === cur.w && e.no < cur.no)) {
      chosen[e.v] = e;
    }
  }
  for (let v = 0; v < n; v++) {
    if (v !== root && chosen[v] === null) return null;
  }

  // 2. 在所选边中找环（沿父指针上行）
  let cycle: number[] | null = null;
  const globalVisited = new Array(n).fill(false);
  for (let start = 0; start < n && !cycle; start++) {
    if (globalVisited[start]) continue;
    const pos = new Map<number, number>();
    const path: number[] = [];
    let cur: number = start;
    while (true) {
      if (globalVisited[cur]) break;
      if (pos.has(cur)) {
        cycle = path.slice(pos.get(cur)!);
        break;
      }
      pos.set(cur, path.length);
      path.push(cur);
      const pe = chosen[cur];
      if (!pe) break; // 到达根
      cur = pe.u;
    }
    for (const x of path) globalVisited[x] = true;
  }

  if (!cycle) {
    const result = new Set<number>();
    for (let v = 0; v < n; v++) {
      if (v !== root && chosen[v]) result.add(chosen[v]!.no);
    }
    return result;
  }

  // 3. 收缩环为一个超级节点
  const inCycle = new Array(n).fill(false);
  for (const v of cycle) inCycle[v] = true;
  const cycleId = n - cycle.length;
  const newId = new Array<number>(n);
  let k = 0;
  for (let v = 0; v < n; v++) {
    if (!inCycle[v]) newId[v] = k++;
  }
  for (const v of cycle) newId[v] = cycleId;
  const nn = cycleId + 1;

  const chosenCost = new Array<number>(n).fill(0);
  for (const v of cycle) chosenCost[v] = chosen[v]!.w;

  // 收缩后边；entryTarget[no] 记录“进入超级节点”的边在本层所进入的环节点 v，
  // 供展开时决定环上断开哪条已选边。
  const contracted: E[] = [];
  const entryTarget = new Map<number, number>();
  for (const e of edges) {
    const uIn = inCycle[e.u];
    const vIn = inCycle[e.v];
    if (uIn && vIn) continue; // 环内边消失
    if (vIn) {
      contracted.push({ no: e.no, u: newId[e.u], v: cycleId, w: e.w - chosenCost[e.v] });
      entryTarget.set(e.no, e.v);
    } else {
      contracted.push({ no: e.no, u: newId[e.u], v: newId[e.v], w: e.w });
    }
  }

  const sub = edmonds(contracted, newId[root], nn);
  if (sub === null) return null;

  // 4. 展开：找到被选入环的那条边，在环上断开其目标节点原选边
  let breakAt = -1;
  for (const no of sub) {
    if (entryTarget.has(no)) {
      breakAt = entryTarget.get(no)!;
      break;
    }
  }
  const result = new Set<number>(sub);
  for (const v of cycle) {
    if (v === breakAt) continue;
    result.add(chosen[v]!.no);
  }
  return result;
}

/**
 * 在包含全部 forced 编号链路的前提下求最优树；不存在这样的树时返回 null。
 *
 * 强制边必须构成以“未来根方向”为根的有向无环森林（每节点至多一条强制入边、
 * 不得成环、不得进入主钟）。用并查集逐条收缩，再在分量图上跑普通 Edmonds。
 */
function solveWithForced(
  edges: E[],
  root: number,
  n: number,
  forced: Set<number>,
): { selected: Set<number>; cost: number } | null {
  const byNo = new Map<number, E>();
  for (const e of edges) byNo.set(e.no, e);

  const dsu = new DSU(n);
  const forcedIncoming = new Array<number>(n).fill(-1); // 节点 -> 强制入边 no
  const heads = new Set<number>(); // 收缩后分量的“头”（分量内尚无强制入边的节点）
  for (let i = 0; i < n; i++) heads.add(i);

  for (const no of forced) {
    const e = byNo.get(no);
    if (!e) return null;
    if (e.v === root) return null; // 主钟不得有入边
    if (forcedIncoming[e.v] !== -1) return null; // 同一从钟两条强制入边
    forcedIncoming[e.v] = no;

    const cu = dsu.find(e.u);
    const cv = dsu.find(e.v);
    if (cu === cv) return null; // 强制边自身成环
    // e.v 一定是其分量的头（其入边此前未被强制），合并后头为 cu 的头
    dsu.parent[cv] = cu;
    heads.delete(e.v);
  }

  // 分量 id 压缩重排
  const compMap = new Map<number, number>();
  const compHead = new Map<number, number>(); // 分量 id -> 头节点（唯一外部入口）
  for (let i = 0; i < n; i++) {
    const r = dsu.find(i);
    if (!compMap.has(r)) compMap.set(r, compMap.size);
  }
  for (const h of heads) compHead.set(compMap.get(dsu.find(h))!, h);

  const newRoot = compMap.get(dsu.find(root))!;

  // 构造分量图：
  //  - 同一分量内部的边消失；
  //  - 进入分量时，只有进入“头节点”的边可被选择（进入其他节点会与强制入边冲突）；
  //  - 从分量出发的边源头平移到分量。
  const contracted: E[] = [];
  for (const e of edges) {
    if (forced.has(e.no)) continue;
    const cu = compMap.get(dsu.find(e.u))!;
    const cv = compMap.get(dsu.find(e.v))!;
    if (cu === cv) continue;
    if (e.v !== compHead.get(cv)!) continue;
    contracted.push({ no: e.no, u: cu, v: cv, w: e.w });
  }

  const sub = edmonds(contracted, newRoot, compMap.size);
  if (sub === null) return null;

  const selected = new Set<number>(sub);
  for (const no of forced) selected.add(no);

  let cost = 0;
  for (const no of selected) cost += byNo.get(no)!.w;
  return { selected, cost };
}

/** 主求解入口：先做可达性裁决，再全局寻优并按编号字典序打破并列 */
export function solvePlan(model: ValidModel): SolveResult {
  const reachable = reachableFromMaster(model);
  if (reachable.size !== model.nodeIds.length) {
    return {
      ok: false,
      reason: 'unreachable',
      model,
      unreachableNodeIds: model.nodeIds.filter((id) => !reachable.has(id)),
    };
  }

  const idIndex = new Map<string, number>();
  model.nodeIds.forEach((id, i) => idIndex.set(id, i));
  const root = idIndex.get(model.masterId)!;

  const edges: E[] = model.links.map((l) => ({
    no: l.no,
    u: idIndex.get(l.from)!,
    v: idIndex.get(l.to)!,
    w: l.cost,
  }));

  // 全局最优（无强制）
  const base = solveWithForced(edges, root, model.nodeIds.length, new Set());
  if (!base) {
    // 理论上不可达已排除；防御性处理保持结果类型完整
    return {
      ok: false,
      reason: 'unreachable',
      model,
      unreachableNodeIds: model.nodeIds.filter((id) => id !== model.masterId),
    };
  }
  const optimum = base.cost;

  // 字典序裁决：编号升序逐条试纳入；纳入后仍能取得最优代价则保留
  let forced = new Set<number>();
  for (const l of [...model.links].sort((a, b) => a.no - b.no)) {
    const trial = new Set(forced);
    trial.add(l.no);
    const sol = solveWithForced(edges, root, model.nodeIds.length, trial);
    if (sol && sol.cost === optimum) {
      forced = trial;
    }
  }

  const finalSol = solveWithForced(edges, root, model.nodeIds.length, forced)!;
  const selectedLinkNos = [...finalSol.selected].sort((a, b) => a - b);

  const linkByNo = new Map(model.links.map((l) => [l.no, l]));
  const parentOf = new Map<string, (typeof model.links)[number]>();
  for (const no of selectedLinkNos) {
    const l = linkByNo.get(no)!;
    parentOf.set(l.to, l);
  }

  const choices: ParentChoice[] = [];
  const paths: PlannedPath[] = [];
  for (const nodeId of model.nodeIds) {
    if (nodeId === model.masterId) continue;
    const pl = parentOf.get(nodeId)!;
    choices.push({ nodeId, linkNo: pl.no, parentId: pl.from, linkCost: pl.cost });

    const linkNos: number[] = [];
    const nodeIds: string[] = [];
    const segmentCosts: number[] = [];
    let cur = nodeId;
    let guard = 0;
    while (cur !== model.masterId && guard++ <= model.nodeIds.length) {
      const e = parentOf.get(cur)!;
      linkNos.unshift(e.no);
      nodeIds.unshift(cur);
      segmentCosts.unshift(e.cost);
      cur = e.from;
    }
    nodeIds.unshift(model.masterId);
    const totalCost = segmentCosts.reduce((s, c) => s + c, 0);
    paths.push({ nodeId, linkNos, nodeIds, segmentCosts, totalCost });
  }

  return {
    ok: true,
    model,
    selectedLinkNos,
    totalCost: finalSol.cost,
    choices,
    paths,
  };
}
