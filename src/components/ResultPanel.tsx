import type { Solution } from '../core/solve';

interface Props {
  solution: Solution | null;
  master: string;
  focus: string | null;
  onFocus(node: string | null): void;
}

/** 计算结果：总览、每台从钟的父链路与路径、逐段核对 */
export function ResultPanel({ solution, master, focus, onFocus }: Props) {
  if (!solution) {
    return (
      <section className="card result-card muted-card">
        <h2>④ 计算结果</h2>
        <p className="hint">
          尚未产生有效结果。请在左侧完成输入后点击「开始计算」；
          输入一旦修改，旧结果会立即失效。
        </p>
      </section>
    );
  }

  const slaves = Object.keys(solution.paths);
  const focusPath = focus ? solution.paths[focus] : null;

  return (
    <section className="card result-card">
      <header className="card-head">
        <h2>④ 计算结果</h2>
        <span className="badge ok">全局最优</span>
      </header>

      <div className="summary">
        <div className="metric">
          <span className="metric-label">总代价</span>
          <span className="metric-value">{solution.totalCost}</span>
        </div>
        <div className="metric">
          <span className="metric-label">选中链路</span>
          <span className="metric-value">{solution.selectedIds.length} 条</span>
        </div>
        <div className="metric wide">
          <span className="metric-label">选中编号（升序）</span>
          <span className="metric-value mono">[{solution.selectedIds.join(', ')}]</span>
        </div>
      </div>

      <div className="table-wrap">
        <table className="result-table">
          <thead>
            <tr>
              <th>从钟</th>
              <th>父链路</th>
              <th>上游时源</th>
              <th>链路代价</th>
              <th>到主钟路径</th>
              <th>路径累计</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {slaves.map((name) => {
              const p = solution.parentOf[name];
              const path = solution.paths[name];
              const nodeChain = [name, ...path.hops.map((h) => h.from)].join(' → ');
              return (
                <tr key={name} className={focus === name ? 'row-focus' : undefined}>
                  <td className="strong">{name}</td>
                  <td className="mono">#{p.linkId}</td>
                  <td>{p.from}</td>
                  <td className="mono">{p.cost}</td>
                  <td className="mono path-cell" title={nodeChain}>
                    {nodeChain}
                  </td>
                  <td className="mono">{path.total}</td>
                  <td>
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => onFocus(focus === name ? null : name)}
                    >
                      {focus === name ? '收起' : '逐段核对'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {focus && focusPath && (
        <div className="focus-panel">
          <h3>
            从钟「{focus}」到主钟「{master}」：共 {focusPath.hops.length} 段，累计代价{' '}
            {focusPath.total}
          </h3>
          <ol className="hop-list">
            {focusPath.hops.map((hop, i) => (
              <li key={i} className="hop">
                <span className="hop-idx">{i + 1}</span>
                <span className="hop-body">
                  <span className="hop-link mono">链路 #{hop.linkId}</span>
                  <span className="hop-route">
                    {hop.from} → {hop.to}
                  </span>
                  <span className="hop-cost mono">代价 {hop.cost}</span>
                  <span className="hop-cum mono">累计 {hop.cumulative}</span>
                </span>
              </li>
            ))}
            <li className="hop arrive">
              <span className="hop-idx">✓</span>
              <span className="hop-body">到达主钟 {master}，全程累计 {focusPath.total}</span>
            </li>
          </ol>
        </div>
      )}
    </section>
  );
}
