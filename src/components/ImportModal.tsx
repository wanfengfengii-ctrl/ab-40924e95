import { useState } from 'react';
import { PlanInput } from '../lib/model';
import { parsePlanText, planToJson, SAMPLE_PLAN } from '../lib/io';

interface Props {
  onClose(): void;
  onImport(input: PlanInput): void;
}

export function ImportModal({ onClose, onImport }: Props) {
  const [text, setText] = useState(planToJson(SAMPLE_PLAN));
  const [err, setErr] = useState<string | null>(null);

  const doImport = () => {
    try {
      const parsed = parsePlanText(text);
      onImport(parsed);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>导入节点与链路</h3>
        <div className="hint">
          支持 JSON（<code>{'{ nodes, links }'}</code>，字段别名 name/source/target/weight 亦可）
          或简洁文本（<code>nodes:</code> / <code>links:</code> 分区，链路行：
          <code>1 | M -&gt; A | 3</code>）。所有数据仅在本地浏览器处理。
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        {err && <div className="import-err">导入失败：{err}</div>}
        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={doImport}>
            导入
          </button>
        </div>
      </div>
    </div>
  );
}
