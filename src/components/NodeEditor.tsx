import { LIMITS } from '../core/validate';

interface Props {
  nodes: string[];
  master: string;
  errorRows: Set<number>;
  onRename(index: number, name: string): void;
  onDelete(index: number): void;
  onAdd(): void;
  onSetMaster(name: string): void;
}

/** 节点列表与主钟指定 */
export function NodeEditor({ nodes, master, errorRows, onRename, onDelete, onAdd, onSetMaster }: Props) {
  return (
    <section className="card">
      <header className="card-head">
        <h2>① 节点与主钟</h2>
        <span className="badge">
          {nodes.length} / {LIMITS.maxNodes}
        </span>
      </header>
      <p className="hint">每台设备一个唯一节点；单选指定主钟（主钟不选择入边，其余节点各选一条入边）。</p>
      <ul className="node-list">
        {nodes.map((name, i) => (
          <li key={i} className={errorRows.has(i) ? 'row-error' : undefined}>
            <label className="master-radio" title="设为主钟">
              <input
                type="radio"
                name="master-node"
                checked={name.trim() !== '' && master === name}
                onChange={() => onSetMaster(name)}
              />
              <span>主钟</span>
            </label>
            <input
              className="text"
              value={name}
              placeholder={`节点 ${i + 1} 名称`}
              onChange={(e) => onRename(i, e.target.value)}
            />
            <button type="button" className="icon-btn" title="删除该节点" onClick={() => onDelete(i)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="ghost" onClick={onAdd} disabled={nodes.length >= LIMITS.maxNodes}>
        ＋ 添加节点
      </button>
    </section>
  );
}
