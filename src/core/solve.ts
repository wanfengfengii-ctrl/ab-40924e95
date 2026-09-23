import { minArborescence } from './edmonds';
import type { Model } from './types';

/** 某台从钟选中的父链路 */
export interface ParentInfo {
  linkId: number;
  from: string;
  cost: number;
}

/** 到主钟路径上的一段 */
export interface Hop {
  linkId: number;
  from: string;
  to: string;
  cost: string;
  /** 从从钟出发累计到本段末尾的代价（精确整数字符串） */
  cumulative: string;
}

export interface PathInfo {
  /** 从从钟自身逐级上行至主钟的有序分段 */
  hops: Hop[];
  total: string;
}

export interface Solution {
  /** 全部选中链路的代价总和（精确整数字符串） */
  totalCost: string;
  /** 选中链路编号，升序 */
  selectedIds: number[];
  /** 每台从钟的父链路 */
  parentOf: Record<string, ParentInfo>;
  /** 每台从钟到主钟的完整路径 */
  paths: Record<string, PathInfo>;
}

/** 从主钟出发沿候选有向链路做遍历，返回不可达节点（保持节点列表顺序） */
export function unreachableFromMaster(model: Model): string[] {
  const adj = new Map<string, string[]>();
  for (const l of model.links) {
    const arr = adj.get(l.from) ?? [];
    arr.push(l.to);
    adj.set(l.from, arr);
  }
  const seen = new Set<string>([model.master]);
  const stack = [model.master];
  while (stack.length > 0) {
    const cur = stack.pop() as string;
    for (const nxt of adj.get(cur) ?? []) {
      if (!seen.has(nxt)) {
        seen.add(nxt);
        stack.push(nxt);
      }
    }
  }
  return model.nodes.filter((n) => !seen.has(n));
}

/**
 * 全局裁决：总代价最小的有向生成树；同代价时，
 * 选中链路编号的升序数组字典序最小。
 *
 * 实现：将每条链路的权重编码为复合 bigint
 *     W = cost * 2^(m+8) - 2^(m - rank(id))
 * 其中 rank(id) 为编号升序名次（1..m）。前半段保证总代价优先；
 * 后半段是「小编号权重更大」的超递增扰动：最小化 ΣW 等价于在最小代价解中
 * 取 Σ2^(m-rank) 最大者，而等大小的集合并列比较该和式时，
 * 对称差中最小编号所在的一方恒胜 —— 即编号升序数组字典序最小。
 * 这保证结果来自一次全局最优计算，而非逐节点贪心。
 */
export function solveTimingNetwork(model: Model): Solution | null {
  const index = new Map(model.nodes.map((n, i) => [n, i] as const));
  const root = index.get(model.master) as number;
  const m = model.links.length;

  const rank = new Map<number, number>();
  [...model.links]
    .map((l) => l.id)
    .sort((a, b) => a - b)
    .forEach((id, i) => rank.set(id, i + 1));

  const COST_SHIFT = BigInt(m + 8);
  const edges = model.links.map((l) => ({
    u: index.get(l.from) as number,
    v: index.get(l.to) as number,
    w: (BigInt(l.cost) << COST_SHIFT) - (1n << BigInt(m - (rank.get(l.id) as number))),
    id: l.id,
  }));

  const res = minArborescence(root, model.nodes.length, edges);
  if (res === null) return null;

  const byId = new Map(model.links.map((l) => [l.id, l] as const));
  const parentOf: Record<string, ParentInfo> = {};
  let total = 0n;
  for (const id of res.ids) {
    const l = byId.get(id) as (typeof model.links)[number];
    parentOf[l.to] = { linkId: l.id, from: l.from, cost: l.cost };
    total += BigInt(l.cost);
  }

  const paths: Record<string, PathInfo> = {};
  for (const node of model.nodes) {
    if (node === model.master) continue;
    const hops: Hop[] = [];
    let cur = node;
    let cumulative = 0n;
    while (cur !== model.master) {
      const p = parentOf[cur];
      cumulative += BigInt(p.cost);
      hops.push({
        linkId: p.linkId,
        from: p.from,
        to: cur,
        cost: String(p.cost),
        cumulative: cumulative.toString(),
      });
      cur = p.from;
    }
    paths[node] = { hops, total: cumulative.toString() };
  }

  return {
    totalCost: total.toString(),
    selectedIds: [...res.ids].sort((a, b) => a - b),
    parentOf,
    paths,
  };
}
