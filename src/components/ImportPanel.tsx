import { useRef, useState } from 'react';

export interface ImportFeedback {
  ok: boolean;
  message: string;
}

interface Props {
  /** 导入一段 JSON 文本，返回反馈消息 */
  onImportText(text: string): ImportFeedback;
  onLoadSample(): void;
  onExport(): void;
}

/** 导入 / 导出 / 示例 */
export function ImportPanel({ onImportText, onLoadSample, onExport }: Props) {
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<ImportFeedback | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const apply = (content: string) => {
    setFeedback(onImportText(content));
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => apply(String(reader.result ?? ''));
    reader.onerror = () => setFeedback({ ok: false, message: '导入失败：文件读取错误' });
    reader.readAsText(file);
  };

  return (
    <section className="card">
      <header className="card-head">
        <h2>③ 导入 / 导出</h2>
      </header>
      <p className="hint">
        JSON 格式：{'{ "nodes": [...], "master": "...", "links": [{ "id": 1, "from": "...", "to": "...", "cost": 5 }] }'}
      </p>
      <textarea
        className="import-text"
        rows={5}
        placeholder='粘贴 JSON，例如 {"nodes":["M","A"],"master":"M","links":[{"id":1,"from":"M","to":"A","cost":3}]}'
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="btn-row">
        <button type="button" className="ghost" onClick={() => apply(text)} disabled={!text.trim()}>
          从文本导入
        </button>
        <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
          选择 JSON 文件
        </button>
        <button type="button" className="ghost" onClick={onLoadSample}>
          载入示例
        </button>
        <button type="button" className="ghost" onClick={onExport}>
          导出当前输入
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
      </div>
      {feedback && (
        <p className={feedback.ok ? 'feedback ok' : 'feedback bad'} role="status">
          {feedback.message}
        </p>
      )}
    </section>
  );
}
