/**
 * 领域模型：授时网络有向生成树规划
 *
 * 一台从钟只能接收一个上游时源（恰选一条入边）；
 * 主钟（根）不得选择入边；全部从钟必须由主钟可达。
 * 合法方案 = 以主钟为根、覆盖全部节点的有向生成树（arborescence）。
 */

export interface TNode {
  id: string;
  /** 是否为主钟（根）。数据中恰好一个；省略视为 false。 */
  master?: boolean;
}

export interface TLink {
  /** 链路编号，在一次规划中唯一，正整数 */
  no: number;
  /** 上游（时源发出方） */
  from: string;
  /** 下游（时源接收方，即该入边的归属节点） */
  to: string;
  /** 安装代价，正整数 */
  cost: number;
}

export interface PlanInput {
  nodes: TNode[];
  links: TLink[];
}

export interface FieldError {
  /** 精确定位，如 nodes[2].id / links[0].cost / master */
  field: string;
  message: string;
}

/** 校验后的规划模型（主钟与节点均存在且唯一） */
export interface ValidModel {
  nodes: TNode[];
  links: TLink[];
  masterId: string;
  nodeIds: string[];
}

/** 单台从钟的规划结果 */
export interface ParentChoice {
  /** 从钟节点 id */
  nodeId: string;
  /** 所选父链路编号 */
  linkNo: number;
  /** 直接上游节点 id */
  parentId: string;
  /** 该链路安装代价 */
  linkCost: number;
}

export interface PlannedPath {
  nodeId: string;
  /** 从主钟到该从钟依次经过的链路编号 */
  linkNos: number[];
  /** 路径上的节点，首为主钟，末为该从钟 */
  nodeIds: string[];
  /** 各段代价，与 linkNos 对齐 */
  segmentCosts: number[];
  /** 路径累计代价 */
  totalCost: number;
}

export interface SolveSuccess {
  ok: true;
  model: ValidModel;
  /** 入选链路编号，升序（字典序裁决对象） */
  selectedLinkNos: number[];
  totalCost: number;
  choices: ParentChoice[];
  paths: PlannedPath[];
}

export interface SolveUnreachable {
  ok: false;
  reason: 'unreachable';
  model: ValidModel;
  /** 在候选图中从主钟不可达的节点 id */
  unreachableNodeIds: string[];
}

export type SolveResult = SolveSuccess | SolveUnreachable;

/**
 * 字段级校验：错误须一次全部定位反馈（不采用遇错即停）。
 * 同时满足业务约束：节点 2~40 个且 id 唯一；链路 1~120 条、编号唯一正整数；
 * 端点必须存在且不同；代价为正整数；恰有一个主钟。
 */
export function validateInput(input: PlanInput): { model: ValidModel } | { errors: FieldError[] } {
  const errors: FieldError[] = [];
  const nodes = Array.isArray(input.nodes) ? input.nodes : [];
  const links = Array.isArray(input.links) ? input.links : [];

  if (nodes.length < 2 || nodes.length > 40) {
    errors.push({ field: 'nodes', message: `节点数量须在 2 至 40 之间，当前 ${nodes.length} 个` });
  }

  const nodeIdSet = new Set<string>();
  const masterIds: string[] = [];
  nodes.forEach((n, i) => {
    const field = `nodes[${i}].id`;
    const rawId = n?.id;
    if (typeof rawId !== 'string' || rawId.trim() === '') {
      errors.push({ field, message: '节点 id 不能为空' });
      return;
    }
    const id = rawId.trim();
    if (nodeIdSet.has(id)) {
      errors.push({ field, message: `节点 id「${id}」重复` });
    } else {
      nodeIdSet.add(id);
    }
    if (n?.master === true) masterIds.push(id);
  });

  if (masterIds.length === 0) {
    errors.push({ field: 'master', message: '必须指定恰好一个主钟节点' });
  } else if (masterIds.length > 1) {
    errors.push({
      field: 'master',
      message: `主钟只能有一个，当前指定了 ${masterIds.length} 个：${masterIds.join('、')}`,
    });
  }

  if (links.length < 1 || links.length > 120) {
    errors.push({ field: 'links', message: `链路数量须在 1 至 120 之间，当前 ${links.length} 条` });
  }

  const linkNoSet = new Set<number>();
  links.forEach((l, i) => {
    if (!l || typeof l !== 'object') {
      errors.push({ field: `links[${i}]`, message: '链路必须为对象' });
      return;
    }
    const noField = `links[${i}].no`;
    if (!Number.isInteger(l.no) || l.no <= 0) {
      errors.push({ field: noField, message: '链路编号必须为正整数' });
    } else if (linkNoSet.has(l.no)) {
      errors.push({ field: noField, message: `链路编号 ${l.no} 重复` });
    } else {
      linkNoSet.add(l.no);
    }

    if (typeof l.from !== 'string' || l.from.trim() === '') {
      errors.push({ field: `links[${i}].from`, message: '起点不能为空' });
    } else if (!nodeIdSet.has(l.from.trim())) {
      errors.push({ field: `links[${i}].from`, message: `起点节点「${l.from}」不存在` });
    }

    if (typeof l.to !== 'string' || l.to.trim() === '') {
      errors.push({ field: `links[${i}].to`, message: '终点不能为空' });
    } else if (!nodeIdSet.has(l.to.trim())) {
      errors.push({ field: `links[${i}].to`, message: `终点节点「${l.to}」不存在` });
    }

    if (
      typeof l.from === 'string' && typeof l.to === 'string' &&
      l.from.trim() !== '' && l.to.trim() !== '' &&
      l.from.trim() === l.to.trim()
    ) {
      errors.push({ field: `links[${i}].to`, message: `链路 ${l.no ?? `#${i}`} 的起点与终点必须不同` });
    }

    if (!Number.isInteger(l.cost) || l.cost <= 0) {
      errors.push({ field: `links[${i}].cost`, message: '安装代价必须为正整数' });
    }
  });

  if (errors.length > 0) return { errors };

  return {
    model: {
      nodes: nodes.map((n) => ({ id: n.id.trim(), master: n.master === true })),
      links: links.map((l) => ({ no: l.no, from: l.from.trim(), to: l.to.trim(), cost: l.cost })),
      masterId: masterIds[0],
      nodeIds: nodes.map((n) => n.id.trim()),
    },
  };
}

/** 候选图中从主钟出发的可达集合（用于明确列出不可达节点） */
export function reachableFromMaster(model: ValidModel): Set<string> {
  const adj = new Map<string, string[]>();
  for (const id of model.nodeIds) adj.set(id, []);
  for (const l of model.links) adj.get(l.from)?.push(l.to);

  const seen = new Set<string>([model.masterId]);
  const queue = [model.masterId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of adj.get(cur) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}
