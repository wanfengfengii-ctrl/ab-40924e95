import { describe, expect, it } from 'vitest';
import { solveTimingNetwork, unreachableFromMaster } from '../src/core/solve';
import { SAMPLE_MODEL } from '../src/core/sample';
import type { Model } from '../src/core/types';

/* ---------- 暴力枚举对拍器 ---------- */

function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return a.length < b.length;
}

/** 枚举所有 |V|-1 条链路的子集，返回 (最小代价, 同代价编号升序字典序最小) */
function bruteForce(model: Model): { cost: bigint; ids: number[] } | null {
  const idx = new Map(model.nodes.map((n, i) => [n, i] as const));
  const root = idx.get(model.master) as number;
  const n = model.nodes.length;
  const edges = model.links.map((l) => ({
    u: idx.get(l.from) as number,
    v: idx.get(l.to) as number,
    cost: BigInt(l.cost),
    id: l.id,
  }));
  const m = edges.length;
  let best: { cost: bigint; ids: number[] } | null = null;
  const chosen: number[] = [];

  const visit = (start: number) => {
    const need = n - 1 - chosen.length;
    if (need === 0) {
      const inDeg = new Array<number>(n).fill(0);
      const parent = new Array<number>(n).fill(-1);
      let cost = 0n;
      const ids: number[] = [];
      for (const i of chosen) {
        const ed = edges[i];
        if (ed.v === root) return; // 主钟不得有入边
        inDeg[ed.v]++;
        parent[ed.v] = ed.u;
        cost += ed.cost;
        ids.push(ed.id);
      }
      for (let v = 0; v < n; v++) {
        if (v !== root && inDeg[v] !== 1) return; // 每个从钟恰一条入边
      }
      for (let v = 0; v < n; v++) {
        if (v === root) continue;
        let cur = v;
        const seen = new Set<number>();
        for (;;) {
          if (cur === root) break;
          if (cur === -1 || seen.has(cur)) return; // 成环：无法追溯主钟
          seen.add(cur);
          cur = parent[cur];
        }
      }
      ids.sort((a, b) => a - b);
      const b = best;
      if (!b || cost < b.cost || (cost === b.cost && lexLess(ids, b.ids))) {
        best = { cost, ids };
      }
      return;
    }
    for (let i = start; i + need <= m; i++) {
      chosen.push(i);
      visit(i + 1);
      chosen.pop();
    }
  };
  visit(0);
  return best;
}

/* ---------- 确定性随机模型生成 ---------- */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomModel(rnd: () => number): Model {
  const n = 2 + Math.floor(rnd() * 5); // 2..6 个节点
  const nodes = Array.from({ length: n }, (_, i) => `N${i}`);
  const m = Math.min(9, n - 1 + Math.floor(rnd() * 6)); // 边数控制在可枚举范围
  const idPool = new Set<number>();
  while (idPool.size < m) idPool.add(1 + Math.floor(rnd() * 60));
  const ids = [...idPool];
  const links = [];
  for (let i = 0; i < m; i++) {
    const u = Math.floor(rnd() * n);
    let v = Math.floor(rnd() * n);
    while (v === u) v = Math.floor(rnd() * n);
    links.push({ id: ids[i], from: nodes[u], to: nodes[v], cost: 1 + Math.floor(rnd() * 12) });
  }
  return { nodes, master: nodes[0], links };
}

/* ---------- 测试 ---------- */

describe('solveTimingNetwork：内置示例', () => {
  it('示例模型：贪心成环场景的全局最优与字典序裁决', () => {
    const sol = solveTimingNetwork(SAMPLE_MODEL);
    expect(sol).not.toBeNull();
    expect(sol!.totalCost).toBe('18');
    expect(sol!.selectedIds).toEqual([2, 4, 5, 7, 9]);
    // 每台从钟的父链路
    expect(sol!.parentOf['从钟A']).toEqual({ linkId: 4, from: '从钟B', cost: 4 });
    expect(sol!.parentOf['从钟B']).toEqual({ linkId: 2, from: '主钟GPS', cost: 8 });
    expect(sol!.parentOf['从钟C']).toEqual({ linkId: 5, from: '从钟B', cost: 2 });
    expect(sol!.parentOf['从钟D']).toEqual({ linkId: 7, from: '从钟C', cost: 2 });
    expect(sol!.parentOf['从钟E']).toEqual({ linkId: 9, from: '从钟D', cost: 2 });
    // 从钟E 到主钟的逐段路径与累计代价
    const pe = sol!.paths['从钟E'];
    expect(pe.total).toBe('14');
    expect(pe.hops.map((h) => h.linkId)).toEqual([9, 7, 5, 2]);
    expect(pe.hops.map((h) => h.cumulative)).toEqual(['2', '4', '6', '14']);
    expect(pe.hops[3].from).toBe('主钟GPS');
  });
});

describe('solveTimingNetwork：编号字典序裁决', () => {
  it('同代价时选编号升序数组字典序最小者', () => {
    // 可行解 {10,11} 与 {10,12} 同代价 10 → 选 {10,11}
    const model: Model = {
      nodes: ['R', 'X', 'Y'],
      master: 'R',
      links: [
        { id: 10, from: 'R', to: 'X', cost: 5 },
        { id: 11, from: 'R', to: 'Y', cost: 5 },
        { id: 12, from: 'X', to: 'Y', cost: 5 },
      ],
    };
    const sol = solveTimingNetwork(model);
    expect(sol!.totalCost).toBe('10');
    expect(sol!.selectedIds).toEqual([10, 11]);
  });

  it('字典序比较看「最小不同编号」而非编号总和', () => {
    // 可行解 {3,7}（和10）与 {4,7}（和11）同代价 → 选含小编号 3 的 {3,7}
    const model: Model = {
      nodes: ['R', 'X', 'Y'],
      master: 'R',
      links: [
        { id: 7, from: 'R', to: 'X', cost: 1 },
        { id: 3, from: 'R', to: 'Y', cost: 1 },
        { id: 4, from: 'X', to: 'Y', cost: 1 },
      ],
    };
    const sol = solveTimingNetwork(model);
    expect(sol!.selectedIds).toEqual([3, 7]);
  });

  it('平行边同代价取小编号', () => {
    const model: Model = {
      nodes: ['R', 'X'],
      master: 'R',
      links: [
        { id: 9, from: 'R', to: 'X', cost: 4 },
        { id: 2, from: 'R', to: 'X', cost: 4 },
      ],
    };
    expect(solveTimingNetwork(model)!.selectedIds).toEqual([2]);
  });
});

describe('solveTimingNetwork：大整数与边界', () => {
  it('代价接近安全整数上限时总和仍精确', () => {
    const big = Number.MAX_SAFE_INTEGER; // 2^53 - 1
    const model: Model = {
      nodes: ['R', 'A', 'B'],
      master: 'R',
      links: [
        { id: 1, from: 'R', to: 'A', cost: big },
        { id: 2, from: 'R', to: 'B', cost: big },
      ],
    };
    const sol = solveTimingNetwork(model);
    expect(sol!.totalCost).toBe((2n * BigInt(big)).toString());
  });

  it('规模上限：40 节点 120 链路可求解', () => {
    const rnd = mulberry32(40);
    const nodes = Array.from({ length: 40 }, (_, i) => `N${i}`);
    const links = [];
    for (let i = 0; i < 81; i++) {
      const u = Math.floor(rnd() * 40);
      let v = Math.floor(rnd() * 40);
      while (v === u) v = Math.floor(rnd() * 40);
      links.push({ id: i + 1, from: nodes[u], to: nodes[v], cost: 1 + Math.floor(rnd() * 1000) });
    }
    // 保证可行：补一条主钟出发的链（合计恰好 120 条）
    for (let i = 1; i < 40; i++) {
      links.push({ id: 81 + i, from: 'N0', to: nodes[i], cost: 5000 });
    }
    expect(links).toHaveLength(120);
    const model: Model = { nodes, master: 'N0', links };
    const sol = solveTimingNetwork(model);
    expect(sol).not.toBeNull();
    expect(sol!.selectedIds).toHaveLength(39);
    // 结构自检：每个非主钟节点恰一条入边，且全部可追溯主钟
    const parent = new Map<string, string>();
    for (const id of sol!.selectedIds) {
      const l = links.find((x) => x.id === id)!;
      expect(parent.has(l.to)).toBe(false);
      parent.set(l.to, l.from);
    }
    for (const n of nodes.slice(1)) {
      let cur = n;
      const seen = new Set<string>();
      while (cur !== 'N0') {
        expect(seen.has(cur)).toBe(false);
        seen.add(cur);
        cur = parent.get(cur)!;
      }
    }
  });
});

describe('随机模型对拍（暴力枚举 vs Edmonds 全局裁决）', () => {
  it('600 组随机小规模模型：代价与编号字典序完全一致', () => {
    const rnd = mulberry32(20260923);
    let feasible = 0;
    let infeasible = 0;
    for (let iter = 0; iter < 600; iter++) {
      const model = randomModel(rnd);
      const brute = bruteForce(model);
      const unreachable = unreachableFromMaster(model);
      if (brute === null) {
        infeasible++;
        // 不可行 ⟺ 存在主钟不可达节点
        expect(unreachable.length, JSON.stringify(model)).toBeGreaterThan(0);
        continue;
      }
      feasible++;
      expect(unreachable, JSON.stringify(model)).toHaveLength(0);
      const sol = solveTimingNetwork(model);
      expect(sol, JSON.stringify(model)).not.toBeNull();
      expect(sol!.totalCost, JSON.stringify(model)).toBe(brute.cost.toString());
      expect(sol!.selectedIds, JSON.stringify(model)).toEqual(brute.ids);
    }
    // 两类样本都应覆盖到
    expect(feasible).toBeGreaterThan(150);
    expect(infeasible).toBeGreaterThan(100);
  });
});

describe('unreachableFromMaster', () => {
  it('列出主钟沿有向链路不可达的节点', () => {
    const model: Model = {
      nodes: ['M', 'A', 'B', 'C'],
      master: 'M',
      links: [
        { id: 1, from: 'M', to: 'A', cost: 1 },
        { id: 2, from: 'B', to: 'A', cost: 1 },
      ],
    };
    expect(unreachableFromMaster(model)).toEqual(['B', 'C']);
  });

  it('全部可达时返回空数组', () => {
    expect(unreachableFromMaster(SAMPLE_MODEL)).toEqual([]);
  });
});
