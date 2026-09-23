import { describe, expect, it } from 'vitest';
import { minArborescence, type ArborescenceEdge } from '../src/core/edmonds';

/** 构造边：w 为 bigint 字面量 */
function e(u: number, v: number, w: bigint, id: number): ArborescenceEdge {
  return { u, v, w, id };
}

describe('minArborescence（Chu-Liu/Edmonds）', () => {
  it('简单链式图直取最小入边', () => {
    // 0→1(5), 0→1(9), 1→2(3), 0→2(20)
    const res = minArborescence(0, 3, [
      e(0, 1, 5n, 1),
      e(0, 1, 9n, 2),
      e(1, 2, 3n, 3),
      e(0, 2, 20n, 4),
    ]);
    expect(res).not.toBeNull();
    expect(res!.total).toBe(8n);
    expect(res!.ids.sort((a, b) => a - b)).toEqual([1, 3]);
  });

  it('最小入边成环时必须收缩：全局最优 ≠ 逐节点贪心', () => {
    // 经典反例：1、2 各自的最小入边构成环 1↔2
    // 贪心（成环，非法）：2→1(1) + 1→2(1) + 0→3(10)
    // 最优：0→1(5) + 1→2(1) + 0→3(10) = 16
    const res = minArborescence(0, 4, [
      e(0, 1, 5n, 1),
      e(0, 2, 5n, 2),
      e(1, 2, 1n, 3),
      e(2, 1, 1n, 4),
      e(0, 3, 10n, 5),
    ]);
    expect(res).not.toBeNull();
    expect(res!.total).toBe(16n);
    expect(res!.ids.sort((a, b) => a - b)).toEqual([1, 3, 5]);
  });

  it('嵌套环（环套环）正确展开', () => {
    // 1↔2 成环，(1,2) 与 3 又构成外层环
    const res = minArborescence(0, 4, [
      e(1, 2, 1n, 1),
      e(2, 1, 1n, 2),
      e(2, 3, 1n, 3),
      e(3, 1, 1n, 4),
      e(0, 1, 100n, 5),
      e(0, 2, 6n, 6),
      e(0, 3, 7n, 7),
    ]);
    expect(res).not.toBeNull();
    // 最优：0→2(6) + 2→1(1) + 2→3(1) = 8
    expect(res!.total).toBe(8n);
    expect(res!.ids.sort((a, b) => a - b)).toEqual([2, 3, 6]);
  });

  it('根节点不选入边：指向根的边被忽略', () => {
    const res = minArborescence(0, 2, [e(1, 0, 1n, 9), e(0, 1, 2n, 1)]);
    expect(res).not.toBeNull();
    expect(res!.ids).toEqual([1]);
  });

  it('存在无入边节点时返回 null', () => {
    const res = minArborescence(0, 3, [e(0, 1, 1n, 1)]);
    expect(res).toBeNull();
  });

  it('支持平行边（同端点不同编号）', () => {
    const res = minArborescence(0, 2, [e(0, 1, 5n, 1), e(0, 1, 3n, 2)]);
    expect(res).not.toBeNull();
    expect(res!.total).toBe(3n);
    expect(res!.ids).toEqual([2]);
  });
});
