import { describe, expect, it } from 'vitest';
import { FieldError, PlanInput, TLink, TNode, validateInput } from './model';

function input(nodes: Array<[string, boolean?]>, links: Array<[number, string, string, number]>): PlanInput {
  return {
    nodes: nodes.map(([id, master]) => ({ id, master: master ?? false }) as TNode),
    links: links.map(([no, from, to, cost]) => ({ no, from, to, cost }) as TLink),
  };
}

describe('validateInput', () => {
  it('接受合法模型', () => {
    const r = validateInput(input([['M', true], ['A']], [[1, 'M', 'A', 1]]));
    expect(r).toMatchObject({ model: { masterId: 'M' } });
  });

  it('一次性定位多个字段错误', () => {
    const r = validateInput(
      input(
        [
          ['A'],
          ['A'],
          ['B'],
        ],
        [
          [0, 'A', 'B', 0],
          [2, 'X', 'A', -3],
          [3, 'B', 'B', 2],
        ],
      ) as PlanInput,
    );
    if ('model' in r) throw new Error('应校验失败');
    const fields = r.errors.map((e: FieldError) => e.field);
    expect(fields).toContain('master'); // 无主钟
    expect(fields).toContain('nodes[1].id'); // 重复 id
    expect(fields).toContain('links[0].no'); // 编号非正整数
    expect(fields).toContain('links[0].cost'); // 代价非正整数
    expect(fields).toContain('links[1].from'); // 端点不存在
    expect(fields).toContain('links[2].to'); // 自环
  });

  it('节点与链路数量越界', () => {
    const one = validateInput({ nodes: [{ id: 'M', master: true }], links: [] });
    expect('errors' in one).toBe(true);
    if ('errors' in one) expect(one.errors.some((e) => e.field === 'nodes')).toBe(true);

    const manyNodes = validateInput({
      nodes: Array.from({ length: 41 }, (_, i) => ({ id: `n${i}`, master: i === 0 })),
      links: [{ no: 1, from: 'n0', to: 'n1', cost: 1 }],
    });
    expect('errors' in manyNodes).toBe(true);

    const noLinks = validateInput({ nodes: [{ id: 'M', master: true }, { id: 'A' }], links: [] });
    if ('errors' in noLinks) expect(noLinks.errors.some((e) => e.field === 'links')).toBe(true);
  });

  it('主钟不唯一与链路编号重复', () => {
    const r = validateInput(
      input(
        [
          ['M', true],
          ['N', true],
        ],
        [
          [1, 'M', 'N', 1],
          [1, 'N', 'M', 2],
        ],
      ),
    );
    if ('model' in r) throw new Error('应校验失败');
    expect(r.errors.some((e) => e.field === 'master')).toBe(true);
    expect(r.errors.some((e) => e.field === 'links[1].no')).toBe(true);
  });
});
