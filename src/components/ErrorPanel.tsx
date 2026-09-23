import type { FieldError } from '../core/types';

interface Props {
  errors: FieldError[];
  unreachable: string[];
}

/** 字段错误与结构不可达的一次性反馈面板 */
export function ErrorPanel({ errors, unreachable }: Props) {
  if (errors.length === 0 && unreachable.length === 0) return null;
  return (
    <div className="error-stack">
      {errors.length > 0 && (
        <section className="card error-card" role="alert">
          <h2>字段错误（{errors.length} 项）</h2>
          <ul className="error-list">
            {errors.map((e, i) => (
              <li key={i}>
                <span className="loc">{e.location}</span>
                <span>{e.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {unreachable.length > 0 && (
        <section className="card warn-card" role="alert">
          <h2>主钟不可达节点（{unreachable.length} 个）</h2>
          <p>
            输入结构合法，但在候选链路图中，以下节点无法从主钟沿有向链路到达，
            因此不存在覆盖全部节点的有向生成树：
          </p>
          <ul className="chip-list">
            {unreachable.map((n) => (
              <li key={n} className="chip bad">
                {n}
              </li>
            ))}
          </ul>
          <p className="hint">请补充指向这些节点（或其上游节点）的候选链路后重新计算。</p>
        </section>
      )}
    </div>
  );
}
