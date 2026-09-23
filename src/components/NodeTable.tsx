import { TNode } from '../lib/model';

interface Props {
  nodes: TNode[];
  /** 形如 nodes[2].id 的错误字段集合，用于行高亮与字段标红 */
  errorFields: Set<string>;
  onChange(nodes: TNode[]): void;
}

export function NodeTable({ nodes, errorFields, onChange }: Props) {
  const update = (i: number, patch: Partial<TNode>) => {
    onChange(nodes.map((n, j) => (j === i ? { ...n, ...patch } : n)));
  };

  const setMaster = (i: number, checked: boolean) => {
    if (!checked) return; // 主钟只能切换不能取消（最终仍由校验兜底）
    onChange(nodes.map((n, j) => ({ ...n, master: j === i })));
  };

  const remove = (i: number) => {
    onChange(nodes.filter((_, j) => j !== i));
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th style={{ width: 44 }}>#</th>
            <th>节点 id</th>
            <th style={{ width: 90 }}>主钟</th>
            <th style={{ width: 60 }}></th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((n, i) => {
            const rowErr =
              errorFields.has(`nodes[${i}].id`) ||
              [...errorFields].some((f) => f.startsWith(`nodes[${i}].`));
            return (
              <tr key={i} className={rowErr ? 'row-err' : undefined}>
                <td style={{ color: 'var(--muted)' }}>{i}</td>
                <td>
                  <input
                    type="text"
                    value={n.id}
                    className={rowErr ? 'invalid' : undefined}
                    placeholder={`如 M / SLAVE-${i + 1}`}
                    onChange={(e) => update(i, { id: e.target.value })}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={n.master === true}
                    onChange={(e) => setMaster(i, e.target.checked)}
                    title="设为主钟（根）"
                  />
                </td>
                <td className="op">
                  <button className="danger" onClick={() => remove(i)} title="删除节点">
                    删除
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ marginTop: 10 }}>
        <button onClick={() => onChange([...nodes, { id: '', master: false }])}>+ 添加节点</button>
      </div>
    </div>
  );
}
