import { useMemo, useState } from 'react';
import { NodeEditor } from './components/NodeEditor';
import { LinkEditor } from './components/LinkEditor';
import { ImportPanel, type ImportFeedback } from './components/ImportPanel';
import { ErrorPanel } from './components/ErrorPanel';
import { ResultPanel } from './components/ResultPanel';
import { validateModel } from './core/validate';
import { solveTimingNetwork, unreachableFromMaster, type Solution } from './core/solve';
import { parseImport, emptyRow, nextRowKey } from './core/import';
import { SAMPLE_MODEL, sampleRows } from './core/sample';
import type { FieldError, LinkRow } from './core/types';

export default function App() {
  const [nodes, setNodes] = useState<string[]>(() => [...SAMPLE_MODEL.nodes]);
  const [master, setMaster] = useState<string>(SAMPLE_MODEL.master);
  const [rows, setRows] = useState<LinkRow[]>(() => sampleRows());

  const [errors, setErrors] = useState<FieldError[]>([]);
  const [unreachable, setUnreachable] = useState<string[]>([]);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  /** 输入一旦变化，旧结果与旧诊断立即失效 */
  const invalidate = () => {
    setErrors([]);
    setUnreachable([]);
    setSolution(null);
    setFocus(null);
  };

  /* ---------- 节点编辑 ---------- */

  const renameNode = (index: number, name: string) => {
    const old = nodes[index];
    invalidate();
    setNodes(nodes.map((n, i) => (i === index ? name : n)));
    if (old !== name) {
      // 重命名联动：链路端点与主钟引用同步更新
      setRows(rows.map((r) => ({
        ...r,
        from: r.from === old ? name : r.from,
        to: r.to === old ? name : r.to,
      })));
      if (master === old) setMaster(name);
    }
  };

  const deleteNode = (index: number) => {
    const name = nodes[index];
    invalidate();
    setNodes(nodes.filter((_, i) => i !== index));
    if (master === name) setMaster('');
    // 链路保留原引用，统一校验会定位「端点不存在」
  };

  const addNode = () => {
    invalidate();
    setNodes([...nodes, `节点${nodes.length + 1}`]);
  };

  const setMasterNode = (name: string) => {
    invalidate();
    setMaster(name);
  };

  /* ---------- 链路编辑 ---------- */

  const patchRow = (key: number, patch: Partial<Omit<LinkRow, 'key'>>) => {
    invalidate();
    setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    invalidate();
    setRows([...rows, emptyRow(nodes)]);
  };

  const deleteRow = (key: number) => {
    invalidate();
    setRows(rows.filter((r) => r.key !== key));
  };

  /* ---------- 导入 / 导出 / 示例 ---------- */

  const importText = (text: string): ImportFeedback => {
    const parsed = parseImport(text);
    if (!parsed.ok) return { ok: false, message: `导入失败：${parsed.error}` };
    const { nodes: n, master: m, rows: r } = parsed.data;
    invalidate();
    setNodes(n);
    setMaster(m);
    setRows(r);
    // 导入后立即统一校验，一次性反馈全部字段问题
    const { errors: errs } = validateModel(n, m, r);
    setErrors(errs);
    return errs.length > 0
      ? { ok: true, message: `已导入，但存在 ${errs.length} 处字段问题，请见下方反馈` }
      : { ok: true, message: `已导入 ${n.length} 个节点、${r.length} 条链路` };
  };

  const loadSample = () => {
    invalidate();
    setNodes([...SAMPLE_MODEL.nodes]);
    setMaster(SAMPLE_MODEL.master);
    setRows(sampleRows());
  };

  const exportJson = () => {
    const num = (s: string): number | string => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : s);
    const payload = {
      nodes,
      master,
      links: rows.map((r) => ({ id: num(r.id), from: r.from, to: r.to, cost: num(r.cost) })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timing-network.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    invalidate();
    setNodes(['主钟', '从钟1']);
    setMaster('主钟');
    setRows([{ key: nextRowKey(), id: '1', from: '主钟', to: '从钟1', cost: '1' }]);
  };

  /* ---------- 计算 ---------- */

  const compute = () => {
    setFocus(null);
    const { errors: errs, model } = validateModel(nodes, master, rows);
    if (!model) {
      setErrors(errs);
      setUnreachable([]);
      setSolution(null);
      return;
    }
    setErrors([]);
    const un = unreachableFromMaster(model);
    if (un.length > 0) {
      setUnreachable(un);
      setSolution(null);
      return;
    }
    setUnreachable([]);
    setSolution(solveTimingNetwork(model));
  };

  /* ---------- 派生状态 ---------- */

  const nodeErrorRows = useMemo(
    () => new Set(errors.flatMap((e) => (e.nodeIndex === undefined ? [] : [e.nodeIndex]))),
    [errors],
  );
  const linkErrorKeys = useMemo(
    () => new Set(errors.flatMap((e) => (e.linkKey === undefined ? [] : [e.linkKey]))),
    [errors],
  );

  return (
    <div className="app">
      <header className="app-head">
        <h1>精密试验场授时网络规划台</h1>
        <p>
          最小代价有向生成树（Chu-Liu/Edmonds 全局裁决，同代价取链路编号字典序最小）·
          全部计算在本地浏览器完成
        </p>
      </header>

      <main className="layout">
        <div className="col">
          <NodeEditor
            nodes={nodes}
            master={master}
            errorRows={nodeErrorRows}
            onRename={renameNode}
            onDelete={deleteNode}
            onAdd={addNode}
            onSetMaster={setMasterNode}
          />
          <LinkEditor
            rows={rows}
            nodeOptions={nodes}
            errorKeys={linkErrorKeys}
            onPatch={patchRow}
            onAdd={addRow}
            onDelete={deleteRow}
          />
          <ImportPanel onImportText={importText} onLoadSample={loadSample} onExport={exportJson} />
          <div className="compute-bar">
            <button type="button" className="primary" onClick={compute}>
              开始计算
            </button>
            <button type="button" className="ghost" onClick={resetAll}>
              清空重置
            </button>
          </div>
        </div>

        <div className="col">
          <ErrorPanel errors={errors} unreachable={unreachable} />
          <ResultPanel solution={solution} master={master} focus={focus} onFocus={setFocus} />
        </div>
      </main>

      <footer className="app-foot">
        <p>
          模型约束：2~40 个唯一节点，1~120 条编号唯一的有向链路，端点必须存在且不同，安装代价为正整数；
          主钟不选择入边，其余每台从钟恰选一条入边并最终可追溯至主钟。
        </p>
      </footer>
    </div>
  );
}
