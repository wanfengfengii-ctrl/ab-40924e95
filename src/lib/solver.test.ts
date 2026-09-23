import { describe, expect, it } from 'vitest';
import { PlanInput, TLink, TNode, validateInput } from './model';
import { solvePlan } from './solver';

function build(
  nodes: Array<[string, boolean?]>,
  links: Array<[number, string, string, number]>,
) {
  const input: PlanInput = {
    nodes: nodes.map(([id, master]) => ({ id, master: master ?? false }) as TNode),
    links: links.map(([no, from, to, cost]) => ({ no, from, to, cost }) as TLink),
  };
  const v = validateInput(input);
  if ('errors' in v) throw new Error(v.errors.map((e) => `${e.field}: ${e.message}`).join('; '));
  return v.model;
}

/** 全枚举参考实现：枚举每条非根节点恰一条入边的组合，取可行树中最优 */
function bruteForce(model: ReturnType<typeof build>): { cost: number; nos: number[] } | null {
  const incoming = new Map<string, TLink[]>();
  for (const id of model.nodeIds) incoming.set(id, []);
  for (const l of model.links) incoming.get(l.to)!.push(l);

  const groups = model.nodeIds.filter((id) => id !== model.masterId).map((id) => incoming.get(id)!);
  if (groups.some((g) => g.length === 0)) return null;

  let best: { cost: number; nos: number[] } | null = null;
  const chosen: TLink[] = [];

  const lexLess = (a: number[], b: number[]) => {
    const sa = [...a].sort((x, y) => x - y);
    const sb = [...b].sort((x, y) => x - y);
    for (let i = 0; i < Math.min(sa.length, sb.length); i++) {
      if (sa[i] !== sb[i]) return sa[i] < sb[i];
    }
    return sa.length < sb.length;
  };

  const rec = (i: number) => {
    if (i === groups.length) {
      // 可行性：从主钟沿所选边能到达所有节点（n-1 条边 + 全可达 ⇔ 无环有根树）
      const seen = new Set<string>([model.masterId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const l of chosen) {
          if (seen.has(l.from) && !seen.has(l.to)) {
            seen.add(l.to);
            changed = true;
          }
        }
      }
      if (seen.size !== model.nodeIds.length) return;
      const cost = chosen.reduce((s, l) => s + l.cost, 0);
      const nos = chosen.map((l) => l.no);
      if (!best || cost < best.cost || (cost === best.cost && lexLess(nos, best.nos))) {
        best = { cost, nos };
      }
      return;
    }
    for (const e of groups[i]) {
      chosen.push(e);
      rec(i + 1);
      chosen.pop();
    }
  };
  rec(0);
  return best;
}

function assertMatchesBrute(model: ReturnType<typeof build>) {
  const expected = bruteForce(model);
  const result = solvePlan(model);
  if (expected === null) {
    expect(result.ok).toBe(false);
    return;
  }
  if (!result.ok) throw new Error('求解器报告不可行，但枚举存在可行树');
  expect(result.totalCost).toBe(expected.cost);
  expect(result.selectedLinkNos).toEqual([...expected.nos].sort((a, b) => a - b));
  expect(result.choices).toHaveLength(model.nodeIds.length - 1);
}

describe('solvePlan 手工用例', () => {
  it('最便宜入边构成闭环时必须破环（拒绝逐节点贪心）', () => {
    // B、C 互指代价各 1（最便宜但成环）；树必须从 A 侧破环
    const model = build(
      [
        ['M', true],
        ['A'],
        ['B'],
        ['C'],
        ['D'],
      ],
      [
        [1, 'M', 'A', 3],
        [2, 'A', 'B', 2],
        [3, 'B', 'C', 1],
        [4, 'C', 'B', 1],
        [5, 'A', 'C', 4],
        [6, 'C', 'D', 2],
        [7, 'B', 'D', 6],
        [8, 'M', 'D', 20],
      ],
    );
    const r = solvePlan(model);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 贪心：B<-4(C,1), C<-3(B,1) 成环；最优树选 A->B(2)+B->C(1)，破环增价在 B 侧
    expect(r.selectedLinkNos).toEqual([1, 2, 3, 6]);
    expect(r.totalCost).toBe(8);

    const dPath = r.paths.find((p) => p.nodeId === 'D')!;
    expect(dPath.nodeIds).toEqual(['M', 'A', 'B', 'C', 'D']);
    expect(dPath.linkNos).toEqual([1, 2, 3, 6]);
    expect(dPath.segmentCosts).toEqual([3, 2, 1, 2]);
    expect(dPath.totalCost).toBe(8);
  });

  it('明确列出从主钟不可达的节点', () => {
    const model = build(
      [
        ['M', true],
        ['A'],
        ['X'],
        ['Y'],
      ],
      [
        [1, 'M', 'A', 1],
        [2, 'X', 'A', 1], // 指向主钟方向，但 X 自身无来自 M 可达侧的入边
        [3, 'X', 'Y', 1],
        [4, 'Y', 'X', 1], // X、Y 互连成闭环孤岛
      ],
    );
    const r = solvePlan(model);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('unreachable');
    expect(r.unreachableNodeIds).toEqual(['X', 'Y']);
  });

  it('同代价时按编号升序数组字典序最小裁决', () => {
    // 两条等代价路径到 B：编号 2 vs 编号 3，应取 2
    const model = build(
      [
        ['M', true],
        ['A'],
        ['B'],
      ],
      [
        [1, 'M', 'A', 1],
        [2, 'A', 'B', 5],
        [3, 'M', 'B', 6],
      ],
    );
    const r = solvePlan(model);
    if (!r.ok) throw new Error('应可行');
    expect(r.totalCost).toBe(6);
    expect(r.selectedLinkNos).toEqual([1, 2]);
  });
});

describe('solvePlan 全枚举随机交叉验证', () => {
  // 固定种子的简易 PRNG，保证测试可复现
  function mulberry32(seed: number) {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const trials = [
    { n: 3, density: 1.0, seed: 11 },
    { n: 4, density: 0.7, seed: 23 },
    { n: 5, density: 0.55, seed: 37 },
    { n: 5, density: 0.9, seed: 41 },
    { n: 6, density: 0.5, seed: 53 },
    { n: 6, density: 0.8, seed: 67 },
  ];

  for (const t of trials) {
    it(`n=${t.n} density=${t.density} seed=${t.seed}`, () => {
      const rand = mulberry32(t.seed);
      const labels = ['M', 'A', 'B', 'C', 'D', 'E'];
      const nodes: [string, boolean?][] = labels.slice(0, t.n).map((l, i) => [l, i === 0]);
      const links: [number, string, string, number][] = [];
      let no = 1;
      for (let u = 0; u < t.n; u++) {
        for (let v = 1; v < t.n; v++) {
          if (u === v) continue;
          if (rand() < t.density) {
            links.push([no++, labels[u], labels[v], 1 + Math.floor(rand() * 9)]);
          }
        }
      }
      if (links.length === 0) return;
      const model = build(nodes, links);
      assertMatchesBrute(model);
    });
  }

  it('重复多次不同种子（n=4~6）均与枚举一致', () => {
    for (let seed = 100; seed < 130; seed++) {
      const rand = mulberry32(seed);
      const n = 3 + Math.floor(rand() * 4);
      const labels = ['M', 'A', 'B', 'C', 'D', 'E'];
      const nodes: [string, boolean?][] = labels.slice(0, n).map((l, i) => [l, i === 0]);
      const links: [number, string, string, number][] = [];
      let no = 1;
      for (let u = 0; u < n; u++) {
        for (let v = 1; v < n; v++) {
          if (u === v) continue;
          if (rand() < 0.5 + rand() * 0.4) {
            links.push([no++, labels[u], labels[v], 1 + Math.floor(rand() * 5)]);
          }
        }
      }
      const model = build(nodes, links);
      assertMatchesBrute(model);
    }
  });
});
