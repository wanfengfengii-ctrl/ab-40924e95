import { useState } from 'react';
import { SolveSuccess } from '../lib/model';

interface Props {
  result: SolveSuccess;
}

export function ResultPanel({ result }: Props) {
  const { model, choices, paths } = result;
  const [selectedNode, setSelectedNode] = useState<string>(
    choices[0]?.nodeId ?? '',
  );

  const path = paths.find((p) => p.nodeId === selectedNode) ?? paths[0];
  const choiceByNode = new Map(choices.map((c) => [c.nodeId, c]));

  return (
    <div>
      <div className="summary">
        <span>
          <span className="k">求解状态</span>
          <span className="v" style={{ color: 'var(--ok)' }}>
            已得到全局最优有向生成树
          </span>
        </span>
        <span>
          <span className="k">总安装代价</span>
          <span className="v">{result.totalCost}</span>
        </span>
        <span>
          <span className="k">入选链路</span>
          <span className="v">[{result.selectedLinkNos.join(', ')}]</span>
        </span>
      </div>

      <div className="result-grid">
        <div className="node-list">
          <button className="master-row" disabled title="主钟为根，无入边">
            <span>★ {model.masterId}</span>
            <span>主钟</span>
          </button>
          {choices.map((c) => (
            <button
              key={c.nodeId}
              className={c.nodeId === selectedNode ? 'active' : ''}
              onClick={() => setSelectedNode(c.nodeId)}
            >
              <span>{c.nodeId}</span>
              <span style={{ color: 'var(--muted)' }}>
                ← #{c.linkNo}（{c.parentId}）
              </span>
            </button>
          ))}
        </div>

        {path && (
          <div className="path-detail">
            <h3>
              从钟 {path.nodeId} 的追溯路径
              {(() => {
                const c = choiceByNode.get(path.nodeId)!;
                return (
                  <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 13 }}>
                    {' '}
                    （父链路 #{c.linkNo}：{c.parentId} → {c.nodeId}，代价 {c.linkCost}）
                  </span>
                );
              })()}
            </h3>

            <div className="path-chain">
              {path.nodeIds.map((id, idx) => (
                <span key={`${id}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {idx > 0 && (
                    <span className="arrow-seg">
                      ── #{path.linkNos[idx - 1]} ──▶
                    </span>
                  )}
                  <span className={`node-pill ${idx === 0 ? 'master' : ''}`}>
                    {idx === 0 ? '★ ' : ''}
                    {id}
                  </span>
                </span>
              ))}
            </div>

            <table className="segments">
              <thead>
                <tr>
                  <th>段</th>
                  <th>链路编号</th>
                  <th>走向</th>
                  <th style={{ textAlign: 'right' }}>本段代价</th>
                  <th style={{ textAlign: 'right' }}>累计代价</th>
                </tr>
              </thead>
              <tbody>
                {path.linkNos.map((no, i) => {
                  const cumulative = path.segmentCosts.slice(0, i + 1).reduce((s, x) => s + x, 0);
                  return (
                    <tr key={`${no}-${i}`}>
                      <td style={{ color: 'var(--muted)' }}>第 {i + 1} 段</td>
                      <td>#{no}</td>
                      <td>
                        {path.nodeIds[i]} → {path.nodeIds[i + 1]}
                      </td>
                      <td style={{ textAlign: 'right' }}>{path.segmentCosts[i]}</td>
                      <td className="cum" style={{ textAlign: 'right' }}>
                        {cumulative}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={3} style={{ textAlign: 'right', color: 'var(--muted)' }}>
                    到主钟路径总代价
                  </td>
                  <td></td>
                  <td className="cum" style={{ textAlign: 'right', fontWeight: 700 }}>
                    {path.totalCost}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
