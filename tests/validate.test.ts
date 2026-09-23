import { describe, expect, it } from 'vitest';
import { validateModel, LIMITS } from '../src/core/validate';
import type { LinkRow } from '../src/core/types';

let key = 1;
function row(id: string, from: string, to: string, cost: string): LinkRow {
  return { key: key++, id, from, to, cost };
}

const VALID_NODES = ['M', 'A', 'B'];
const VALID_MASTER = 'M';
const VALID_ROWS: LinkRow[] = [row('1', 'M', 'A', '5'), row('2', 'A', 'B', '3')];

describe('validateModel：合法输入', () => {
  it('最小合法模型通过', () => {
    const { errors, model } = validateModel(['M', 'A'], 'M', [row('1', 'M', 'A', '1')]);
    expect(errors).toEqual([]);
    expect(model).toEqual({
      nodes: ['M', 'A'],
      master: 'M',
      links: [{ id: 1, from: 'M', to: 'A', cost: 1 }],
    });
  });

  it('节点名去首尾空格后参与校验', () => {
    const { errors, model } = validateModel([' M ', 'A'], 'M', [row('1', 'M', 'A', '2')]);
    expect(errors).toEqual([]);
    expect(model!.nodes).toEqual(['M', 'A']);
  });

  it('规模上限边界：40 节点 120 链路通过', () => {
    const nodes = Array.from({ length: LIMITS.maxNodes }, (_, i) => `N${i}`);
    const rows = Array.from({ length: LIMITS.maxLinks }, (_, i) =>
      row(String(i + 1), `N${i % 40}`, `N${(i + 1) % 40}`, '1'),
    );
    const { errors, model } = validateModel(nodes, 'N0', rows);
    expect(errors).toEqual([]);
    expect(model!.links).toHaveLength(120);
  });
});

describe('validateModel：节点与主钟', () => {
  it('节点少于 2 个', () => {
    const { errors } = validateModel(['M'], 'M', [row('1', 'M', 'M', '1')]);
    expect(errors.some((e) => e.location === '节点列表' && e.message.includes('不得少于'))).toBe(true);
  });

  it('节点超过 40 个', () => {
    const nodes = Array.from({ length: 41 }, (_, i) => `N${i}`);
    const { errors } = validateModel(nodes, 'N0', [row('1', 'N0', 'N1', '1')]);
    expect(errors.some((e) => e.message.includes('不得超过 40'))).toBe(true);
  });

  it('节点名为空、重复均被定位', () => {
    const { errors } = validateModel(['M', '', 'A', 'A'], 'M', VALID_ROWS);
    expect(errors.some((e) => e.nodeIndex === 1 && e.message.includes('不能为空'))).toBe(true);
    expect(errors.some((e) => e.message.includes('「A」重复出现于第 3、4 行'))).toBe(true);
  });

  it('主钟缺失或不在节点列表', () => {
    expect(validateModel(VALID_NODES, '', VALID_ROWS).errors.some((e) => e.location === '主钟')).toBe(true);
    expect(
      validateModel(VALID_NODES, 'X', VALID_ROWS).errors.some((e) => e.message.includes('不在节点列表')),
    ).toBe(true);
  });
});

describe('validateModel：链路字段', () => {
  it('链路数量越界', () => {
    expect(validateModel(VALID_NODES, VALID_MASTER, []).errors.some((e) => e.message.includes('至少需要'))).toBe(
      true,
    );
    const rows = Array.from({ length: 121 }, (_, i) => row(String(i + 1), 'M', i % 2 ? 'A' : 'B', '1'));
    expect(
      validateModel(VALID_NODES, VALID_MASTER, rows).errors.some((e) => e.message.includes('不得超过 120')),
    ).toBe(true);
  });

  it('编号：空、非整数、零、负数、重复', () => {
    const rows = [
      row('', 'M', 'A', '1'),
      row('abc', 'M', 'A', '1'),
      row('0', 'M', 'A', '1'),
      row('-3', 'M', 'A', '1'),
      row('1.5', 'M', 'A', '1'),
      row('7', 'M', 'A', '1'),
      row('7', 'M', 'B', '1'),
    ];
    const { errors } = validateModel(VALID_NODES, VALID_MASTER, rows);
    expect(errors.filter((e) => e.message.includes('编号'))).toHaveLength(6); // 5 个非法 + 1 条重复汇总
    expect(errors.some((e) => e.message.includes('编号 7 重复出现于第 6、7 行'))).toBe(true);
  });

  it('端点：缺失、不存在、自环', () => {
    const rows = [
      row('1', '', 'A', '1'),
      row('2', 'M', '', '1'),
      row('3', '幽灵', 'A', '1'),
      row('4', 'M', '幽灵', '1'),
      row('5', 'A', 'A', '1'),
    ];
    const { errors } = validateModel(VALID_NODES, VALID_MASTER, rows);
    expect(errors.some((e) => e.message.includes('必须选择链路起点'))).toBe(true);
    expect(errors.some((e) => e.message.includes('必须选择链路终点'))).toBe(true);
    expect(errors.some((e) => e.message.includes('起点「幽灵」不存在'))).toBe(true);
    expect(errors.some((e) => e.message.includes('终点「幽灵」不存在'))).toBe(true);
    expect(errors.some((e) => e.message.includes('不允许自环'))).toBe(true);
  });

  it('代价：空、零、负数、小数、非数字', () => {
    const rows = [
      row('1', 'M', 'A', ''),
      row('2', 'M', 'A', '0'),
      row('3', 'M', 'A', '-5'),
      row('4', 'M', 'A', '2.5'),
      row('5', 'M', 'A', 'abc'),
    ];
    const { errors } = validateModel(VALID_NODES, VALID_MASTER, rows);
    expect(errors.filter((e) => e.message.includes('代价'))).toHaveLength(5);
  });

  it('指向主钟的候选链路允许存在（只是不会被选中）', () => {
    const { errors } = validateModel(['M', 'A'], 'M', [
      row('1', 'M', 'A', '1'),
      row('2', 'A', 'M', '1'),
    ]);
    expect(errors).toEqual([]);
  });
});

describe('validateModel：一次性定位反馈', () => {
  it('多处错误一次全部返回，且携带行定位信息', () => {
    const rows = [
      row('', 'M', 'A', '1'), // 第 1 行：编号空
      row('2', 'X', 'A', '1'), // 第 2 行：起点不存在
      row('3', 'M', 'B', '0'), // 第 3 行：代价非正
      row('3', 'M', 'A', '2'), // 第 4 行：编号重复
    ];
    const { errors, model } = validateModel(['M', '', 'A', 'B'], '', rows);
    expect(model).toBeNull();
    // 节点空名 + 主钟缺失 + 4 类链路错误，全部一次返回
    expect(errors.length).toBeGreaterThanOrEqual(6);
    expect(errors.some((e) => e.location === '链路 第 1 行')).toBe(true);
    expect(errors.some((e) => e.location === '链路 第 2 行')).toBe(true);
    expect(errors.some((e) => e.location === '链路 第 3 行')).toBe(true);
    expect(errors.some((e) => e.message.includes('编号 3 重复出现于第 3、4 行'))).toBe(true);
    expect(errors.some((e) => e.nodeIndex === 1)).toBe(true);
    expect(errors.some((e) => e.location === '主钟')).toBe(true);
    // 出错链路行携带 linkKey 供表格高亮
    const linkErr = errors.find((e) => e.location === '链路 第 1 行');
    expect(linkErr?.linkKey).toBe(rows[0].key);
  });
});
