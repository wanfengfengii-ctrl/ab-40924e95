import type { LinkRow, Model } from './types';
import { nextRowKey } from './import';

/**
 * 内置示例：6 节点 12 链路。
 * 逐节点贪心会在 从钟A↔从钟B 之间成环（A 选 #4、B 选 #3），
 * 全局最优解为链路 {2,4,5,7,9}，总代价 18；
 * 链路 7 与 13 同代价可互换，用于演示编号字典序裁决（选中 7 而非 13）。
 */
export const SAMPLE_MODEL: Model = {
  nodes: ['主钟GPS', '从钟A', '从钟B', '从钟C', '从钟D', '从钟E'],
  master: '主钟GPS',
  links: [
    { id: 1, from: '主钟GPS', to: '从钟A', cost: 10 },
    { id: 2, from: '主钟GPS', to: '从钟B', cost: 8 },
    { id: 3, from: '从钟A', to: '从钟B', cost: 3 },
    { id: 4, from: '从钟B', to: '从钟A', cost: 4 },
    { id: 5, from: '从钟B', to: '从钟C', cost: 2 },
    { id: 6, from: '从钟A', to: '从钟C', cost: 7 },
    { id: 7, from: '从钟C', to: '从钟D', cost: 2 },
    { id: 8, from: '主钟GPS', to: '从钟D', cost: 15 },
    { id: 9, from: '从钟D', to: '从钟E', cost: 2 },
    { id: 10, from: '从钟C', to: '从钟E', cost: 6 },
    { id: 11, from: '从钟E', to: '从钟D', cost: 3 },
    { id: 13, from: '从钟B', to: '从钟D', cost: 2 },
  ],
};

export const SAMPLE_JSON = JSON.stringify(SAMPLE_MODEL, null, 2);

export function sampleRows(): LinkRow[] {
  return SAMPLE_MODEL.links.map((l) => ({
    key: nextRowKey(),
    id: String(l.id),
    from: l.from,
    to: l.to,
    cost: String(l.cost),
  }));
}
