/** 链路编辑行：表单态一律使用字符串，提交校验时再解析为正整数。 */
export interface LinkRow {
  /** 仅用于 React 列表 key 的稳定标识，与业务编号无关 */
  key: number;
  id: string;
  from: string;
  to: string;
  cost: string;
}

/** 通过全部字段校验后的链路模型 */
export interface Link {
  id: number;
  from: string;
  to: string;
  cost: number;
}

/** 通过全部字段校验后的输入模型 */
export interface Model {
  nodes: string[];
  master: string;
  links: Link[];
}

/** 字段级错误：携带定位信息，便于一次性反馈并高亮对应行 */
export interface FieldError {
  /** 人类可读的定位，如「链路 第 3 行」 */
  location: string;
  message: string;
  /** 出错链路行的 key（用于表格行高亮） */
  linkKey?: number;
  /** 出错节点行的下标（用于节点行高亮） */
  nodeIndex?: number;
}
