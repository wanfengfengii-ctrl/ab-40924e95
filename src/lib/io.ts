import { PlanInput } from './model';

/** 内置示例：含更便宜的闭环选择（B-C 互指），演示为何不能逐节点贪心 */
export const SAMPLE_PLAN: PlanInput = {
  nodes: [
    { id: 'M', master: true },
    { id: 'A' },
    { id: 'B' },
    { id: 'C' },
    { id: 'D' },
  ],
  links: [
    { no: 1, from: 'M', to: 'A', cost: 3 },
    { no: 2, from: 'A', to: 'B', cost: 2 },
    { no: 3, from: 'B', to: 'C', cost: 1 },
    { no: 4, from: 'C', to: 'B', cost: 1 },
    { no: 5, from: 'A', to: 'C', cost: 4 },
    { no: 6, from: 'C', to: 'D', cost: 2 },
    { no: 7, from: 'B', to: 'D', cost: 6 },
    { no: 8, from: 'M', to: 'D', cost: 20 },
  ],
};

/**
 * 解析导入文本：JSON 优先；也接受面向工程师的简洁文本格式
 *   nodes:
 *     M (master)
 *     A
 *   links:
 *     1 | M -> A | 3
 * 空白行与 # 注释被忽略。
 */
export function parsePlanText(text: string): PlanInput {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('导入内容为空');

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let json: unknown;
    try {
      json = JSON.parse(trimmed);
    } catch (e) {
      throw new Error(`JSON 解析失败：${(e as Error).message}`);
    }
    return normalizeJson(json);
  }

  return parseSimpleText(trimmed);
}

function normalizeJson(json: unknown): PlanInput {
  if (typeof json !== 'object' || json === null) throw new Error('JSON 顶层须为对象');
  const obj = json as Record<string, unknown>;
  const rawNodes = obj.nodes;
  const rawLinks = obj.links;
  if (!Array.isArray(rawNodes) || !Array.isArray(rawLinks)) {
    throw new Error('JSON 须包含 nodes 与 links 两个数组');
  }
  const nodes = rawNodes.map((n) => {
    if (typeof n === 'string') return { id: n, master: false };
    const r = n as Record<string, unknown>;
    return {
      id: String(r.id ?? r.name ?? ''),
      master: r.master === true || r.isMaster === true,
    };
  });
  const links = rawLinks.map((l) => {
    const r = l as Record<string, unknown>;
    return {
      no: Number(r.no ?? r.id),
      from: String(r.from ?? r.source ?? ''),
      to: String(r.to ?? r.target ?? ''),
      cost: Number(r.cost ?? r.weight ?? NaN),
    };
  });
  return { nodes, links };
}

function parseSimpleText(text: string): PlanInput {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const nodes: PlanInput['nodes'] = [];
  const links: PlanInput['links'] = [];
  let section: 'nodes' | 'links' | '' = '';

  for (const line of lines) {
    const lower = line.toLowerCase().replace(/[:：]\s*$/, '');
    if (lower === 'nodes' || line === '节点') {
      section = 'nodes';
      continue;
    }
    if (lower === 'links' || line === '链路') {
      section = 'links';
      continue;
    }
    if (section === 'nodes') {
      const m = line.match(/^(.+?)(?:\s*[\(（]\s*master\s*[\)）])?\s*$/i);
      const isMaster = /[\(（]\s*master\s*[\)）]/i.test(line);
      const id = (isMaster ? line.replace(/[\(（]\s*master\s*[\)）]/i, '') : m![1]).trim();
      nodes.push({ id, master: isMaster });
    } else if (section === 'links') {
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length !== 3) throw new Error(`链路行格式错误：「${line}」，应为 编号 | 起点 -> 终点 | 代价`);
      const no = Number(parts[0]);
      const endpoints = parts[1].split('->').map((p) => p.trim());
      if (endpoints.length !== 2 || !endpoints[0] || !endpoints[1]) {
        throw new Error(`链路端点格式错误：「${parts[1]}」，应为 起点 -> 终点`);
      }
      const cost = Number(parts[2]);
      links.push({ no, from: endpoints[0], to: endpoints[1], cost });
    } else {
      throw new Error(`无法识别的行：「${line}」，请以 nodes: 或 links: 分区`);
    }
  }
  if (nodes.length === 0) throw new Error('未解析到任何节点');
  return { nodes, links };
}

export function planToJson(input: PlanInput): string {
  return JSON.stringify(input, null, 2);
}
