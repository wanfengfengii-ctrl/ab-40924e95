import { LIMITS } from '../core/validate';
import type { LinkRow } from '../core/types';

interface Props {
  rows: LinkRow[];
  nodeOptions: string[];
  errorKeys: Set<number>;
  onPatch(key: number, patch: Partial<Omit<LinkRow, 'key'>>): void;
  onAdd(): void;
  onDelete(key: number): void;
}

/** 候选有向链路编辑表 */
export function LinkEditor({ rows, nodeOptions, errorKeys, onPatch, onAdd, onDelete }: Props) {
  const options = nodeOptions.filter((n) => n.trim() !== '');

  const endpointOptions = (current: string) => {
    const elems = [
      <option key="__empty" value="">
        （选择节点）
      </option>,
    ];
    if (current && !options.includes(current)) {
      elems.push(
        <option key={current} value={current}>
          （已删除）{current}
        </option>,
      );
    }
    for (const n of options) {
      elems.push(
        <option key={n} value={n}>
          {n}
        </option>,
      );
    }
    return elems;
  };

  return (
    <section className="card">
      <header className="card-head">
        <h2>② 候选有向链路</h2>
        <span className="badge">
          {rows.length} / {LIMITS.maxLinks}
        </span>
      </header>
      <p className="hint">方向：上游时源 → 下游设备；编号为唯一正整数，安装代价为正整数。</p>
      <div className="table-wrap">
        <table className="links-table">
          <thead>
            <tr>
              <th className="col-idx">#</th>
              <th>编号</th>
              <th>起点（上游）</th>
              <th>终点（下游）</th>
              <th>安装代价</th>
              <th className="col-op" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.key} className={errorKeys.has(row.key) ? 'row-error' : undefined}>
                <td className="col-idx">{i + 1}</td>
                <td>
                  <input
                    className="text num"
                    value={row.id}
                    placeholder="如 7"
                    onChange={(e) => onPatch(row.key, { id: e.target.value })}
                  />
                </td>
                <td>
                  <select value={row.from} onChange={(e) => onPatch(row.key, { from: e.target.value })}>
                    {endpointOptions(row.from)}
                  </select>
                </td>
                <td>
                  <select value={row.to} onChange={(e) => onPatch(row.key, { to: e.target.value })}>
                    {endpointOptions(row.to)}
                  </select>
                </td>
                <td>
                  <input
                    className="text num"
                    value={row.cost}
                    placeholder="正整数"
                    onChange={(e) => onPatch(row.key, { cost: e.target.value })}
                  />
                </td>
                <td className="col-op">
                  <button type="button" className="icon-btn" title="删除该链路" onClick={() => onDelete(row.key)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="ghost" onClick={onAdd} disabled={rows.length >= LIMITS.maxLinks}>
        ＋ 添加链路
      </button>
    </section>
  );
}
