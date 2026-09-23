import { describe, expect, it } from 'vitest';
import { PlanInput } from './model';
import { parsePlanText, planToJson, SAMPLE_PLAN } from './io';

describe('parsePlanText', () => {
  it('解析 JSON', () => {
    const r = parsePlanText(planToJson(SAMPLE_PLAN));
    expect(r.nodes).toHaveLength(5);
    expect(r.links).toHaveLength(8);
  });

  it('解析简洁文本格式', () => {
    const text = `
# 注释行
nodes:
  M (master)
  A
links:
  1 | M -> A | 3
  2 | A -> M | 5
`;
    const r = parsePlanText(text);
    expect(r.nodes).toEqual([
      { id: 'M', master: true },
      { id: 'A', master: false },
    ]);
    expect(r.links[0]).toEqual({ no: 1, from: 'M', to: 'A', cost: 3 });
  });

  it('容忍字段别名 source/target/weight', () => {
    const r: PlanInput = parsePlanText(
      JSON.stringify({
        nodes: [{ name: 'M', isMaster: true }, { name: 'A' }],
        links: [{ id: 7, source: 'M', target: 'A', weight: 9 }],
      }),
    );
    expect(r.nodes[0].id).toBe('M');
    expect(r.links[0]).toMatchObject({ no: 7, from: 'M', to: 'A', cost: 9 });
  });

  it('非法输入抛错', () => {
    expect(() => parsePlanText('')).toThrow();
    expect(() => parsePlanText('{bad json')).toThrow();
    expect(() => parsePlanText('hello:\n  x')).toThrow();
  });
});
