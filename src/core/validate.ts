import type { FieldError, LinkRow, Model } from './types';

/** 模型约束：2~40 个唯一节点，1~120 条编号唯一的链路 */
export const LIMITS = {
  minNodes: 2,
  maxNodes: 40,
  minLinks: 1,
  maxLinks: 120,
} as const;

const POS_INT = /^\d+$/;

/** 解析正整数（安全整数范围内），非法返回 null */
function parsePositiveInt(raw: string): number | null {
  const s = raw.trim();
  if (!POS_INT.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return n;
}

/**
 * 字段级校验：一次性收集全部错误（不短路），
 * 全部通过时返回解析后的模型，否则 model 为 null。
 */
export function validateModel(
  nodes: string[],
  master: string,
  rows: LinkRow[],
): { errors: FieldError[]; model: Model | null } {
  const errors: FieldError[] = [];
  const trimmed = nodes.map((n) => n.trim());

  // ---- 节点 ----
  trimmed.forEach((name, i) => {
    if (!name) {
      errors.push({ location: `节点 第 ${i + 1} 行`, message: '节点名称不能为空', nodeIndex: i });
    }
  });
  if (trimmed.length < LIMITS.minNodes) {
    errors.push({
      location: '节点列表',
      message: `节点数量不得少于 ${LIMITS.minNodes} 个（当前 ${trimmed.length} 个）`,
    });
  }
  if (trimmed.length > LIMITS.maxNodes) {
    errors.push({
      location: '节点列表',
      message: `节点数量不得超过 ${LIMITS.maxNodes} 个（当前 ${trimmed.length} 个）`,
    });
  }
  const nameRows = new Map<string, number[]>();
  trimmed.forEach((name, i) => {
    if (!name) return;
    const arr = nameRows.get(name) ?? [];
    arr.push(i + 1);
    nameRows.set(name, arr);
  });
  for (const [name, rows_] of nameRows) {
    if (rows_.length > 1) {
      errors.push({
        location: '节点列表',
        message: `节点「${name}」重复出现于第 ${rows_.join('、')} 行，节点必须唯一`,
      });
    }
  }

  // ---- 主钟 ----
  if (!master) {
    errors.push({ location: '主钟', message: '必须指定一个主钟节点' });
  } else if (!trimmed.includes(master)) {
    errors.push({ location: '主钟', message: `主钟「${master}」不在节点列表中` });
  }

  // ---- 链路数量 ----
  if (rows.length < LIMITS.minLinks) {
    errors.push({
      location: '链路列表',
      message: `至少需要 ${LIMITS.minLinks} 条候选链路（当前 ${rows.length} 条）`,
    });
  }
  if (rows.length > LIMITS.maxLinks) {
    errors.push({
      location: '链路列表',
      message: `候选链路不得超过 ${LIMITS.maxLinks} 条（当前 ${rows.length} 条）`,
    });
  }

  // ---- 链路字段 ----
  const idRows = new Map<number, number[]>();
  const parsedLinks: Model['links'] = [];
  rows.forEach((row, i) => {
    const location = `链路 第 ${i + 1} 行`;
    let id: number | null = null;
    let cost: number | null = null;

    if (!row.id.trim()) {
      errors.push({ location, message: '链路编号不能为空', linkKey: row.key });
    } else {
      id = parsePositiveInt(row.id);
      if (id === null) {
        errors.push({
          location,
          message: `链路编号「${row.id.trim()}」不是正整数`,
          linkKey: row.key,
        });
      } else {
        const arr = idRows.get(id) ?? [];
        arr.push(i + 1);
        idRows.set(id, arr);
      }
    }

    const { from, to } = row;
    if (!from) {
      errors.push({ location, message: '必须选择链路起点', linkKey: row.key });
    } else if (!trimmed.includes(from)) {
      errors.push({ location, message: `起点「${from}」不存在于节点列表`, linkKey: row.key });
    }
    if (!to) {
      errors.push({ location, message: '必须选择链路终点', linkKey: row.key });
    } else if (!trimmed.includes(to)) {
      errors.push({ location, message: `终点「${to}」不存在于节点列表`, linkKey: row.key });
    }
    if (from && to && from === to) {
      errors.push({ location, message: '起点与终点不能相同（不允许自环）', linkKey: row.key });
    }

    if (!row.cost.trim()) {
      errors.push({ location, message: '安装代价不能为空', linkKey: row.key });
    } else {
      cost = parsePositiveInt(row.cost);
      if (cost === null) {
        errors.push({
          location,
          message: `安装代价「${row.cost.trim()}」不是正整数`,
          linkKey: row.key,
        });
      }
    }

    if (
      id !== null &&
      cost !== null &&
      from &&
      to &&
      trimmed.includes(from) &&
      trimmed.includes(to) &&
      from !== to
    ) {
      parsedLinks.push({ id, from, to, cost });
    }
  });
  for (const [id, rows_] of idRows) {
    if (rows_.length > 1) {
      errors.push({
        location: '链路编号',
        message: `编号 ${id} 重复出现于第 ${rows_.join('、')} 行，链路编号必须唯一`,
      });
    }
  }

  if (errors.length > 0) return { errors, model: null };
  return { errors, model: { nodes: trimmed, master, links: parsedLinks } };
}
