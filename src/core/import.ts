import type { LinkRow } from './types';

export interface ParsedImport {
  nodes: string[];
  master: string;
  rows: LinkRow[];
}

export type ImportResult =
  | { ok: true; data: ParsedImport }
  | { ok: false; error: string };

let rowKey = 1;
/** 生成新链路行的临时 key（仅 React 列表使用） */
export function nextRowKey(): number {
  return rowKey++;
}

export function emptyRow(nodes: string[]): LinkRow {
  return { key: rowKey++, id: '', from: nodes[0] ?? '', to: '', cost: '' };
}

/**
 * 解析导入 JSON。结构层面宽松（接受节点/链路为对象数组或字符串数组、
 * 主钟字段名常见变体），字段值合法性交由统一校验器一次性反馈。
 */
export function parseImport(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON 语法错误：无法解析，请检查格式（如逗号、引号）' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: '顶层必须是 JSON 对象，形如 { "nodes": [...], "master": "...", "links": [...] }' };
  }
  const obj = raw as Record<string, unknown>;

  const nodesRaw = obj.nodes ?? obj.nodeList;
  if (!Array.isArray(nodesRaw)) return { ok: false, error: '缺少 nodes 数组（节点列表）' };
  const nodes: string[] = [];
  for (const [i, item] of nodesRaw.entries()) {
    if (typeof item === 'string') {
      nodes.push(item);
    } else if (item && typeof item === 'object' && 'name' in item) {
      const v = (item as Record<string, unknown>).name;
      if (typeof v !== 'string') return { ok: false, error: `nodes[${i}].name 必须是字符串` };
      nodes.push(v);
    } else {
      return { ok: false, error: `nodes[${i}] 必须是字符串或 { "name": "..." }` };
    }
  }

  const masterRaw = obj.master ?? obj.root ?? obj.masterClock;
  if (typeof masterRaw !== 'string') return { ok: false, error: '缺少 master 字段（主钟节点名称）' };

  const linksRaw = obj.links ?? obj.edges ?? obj.candidates;
  if (!Array.isArray(linksRaw)) return { ok: false, error: '缺少 links 数组（候选链路列表）' };

  const rows: LinkRow[] = [];
  for (const [i, item] of linksRaw.entries()) {
    if (typeof item !== 'object' || item === null) {
      return { ok: false, error: `links[${i}] 必须是对象` };
    }
    const l = item as Record<string, unknown>;
    const id = l.id ?? l.no ?? l.number;
    const from = l.from ?? l.source ?? l.upstream ?? l.tail;
    const to = l.to ?? l.target ?? l.downstream ?? l.head;
    const cost = l.cost ?? l.weight ?? l.price;
    const s = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
    rows.push({ key: rowKey++, id: s(id), from: s(from), to: s(to), cost: s(cost) });
  }

  return { ok: true, data: { nodes, master: masterRaw, rows } };
}
