import { TLink, TNode } from '../lib/model';

interface Props {
  links: TLink[];
  nodes: TNode[];
  /** 形如 links[3].cost 的错误字段集合，用于行高亮与字段标红 */
  errorFields: Set<string>;
  onChange(links: TLink[]): void;
}

type CellField = 'no' | 'from' | 'to' | 'cost';

export function LinkTable({ links, nodes, errorFields, onChange }: Props) {
  const update = (i: number, patch: Partial<TLink>) => {
    onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  };

  const remove = (i: number) => {
    onChange(links.filter((_, j) => j !== i));
  };

  const add = () => {
    const used = new Set(links.map((l) => l.no));
    let no = 1;
    while (used.has(no)) no++;
    onChange([...links, { no, from: nodes[0]?.id ?? '', to: nodes[1]?.id ?? '', cost: 1 }]);
  };

  const options = nodes.map((n) => n.id);
  const rowHasError = (i: number) =>
    [...errorFields].some((f) => f.startsWith(`links[${i}].`));
  const cellInvalid = (i: number, field: CellField) => errorFields.has(`links[${i}].${field}`);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th style={{ width: 70 }}>编号</th>
            <th>起点 from</th>
            <th>终点 to</th>
            <th style={{ width: 90 }}>代价</th>
            <th style={{ width: 60 }}></th>
          </tr>
        </thead>
        <tbody>
          {links.map((l, i) => (
            <tr key={i} className={rowHasError(i) ? 'row-err' : undefined}>
              <td>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={Number.isFinite(l.no) ? l.no : ''}
                  className={cellInvalid(i, 'no') ? 'invalid' : undefined}
                  onChange={(e) => update(i, { no: Number(e.target.value) })}
                />
              </td>
              <td>
                <select
                  value={options.includes(l.from) ? l.from : ''}
                  className={cellInvalid(i, 'from') ? 'invalid' : undefined}
                  onChange={(e) => update(i, { from: e.target.value })}
                >
                  {!options.includes(l.from) && <option value="">（无效）</option>}
                  {options.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  value={options.includes(l.to) ? l.to : ''}
                  className={cellInvalid(i, 'to') ? 'invalid' : undefined}
                  onChange={(e) => update(i, { to: e.target.value })}
                >
                  {!options.includes(l.to) && <option value="">（无效）</option>}
                  {options.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={Number.isFinite(l.cost) ? l.cost : ''}
                  className={cellInvalid(i, 'cost') ? 'invalid' : undefined}
                  onChange={(e) => update(i, { cost: Number(e.target.value) })}
                />
              </td>
              <td className="op">
                <button className="danger" onClick={() => remove(i)}>
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 10 }}>
        <button onClick={add} disabled={nodes.length < 2}>
          + 添加链路
        </button>
      </div>
    </div>
  );
}
