import { useMemo, useRef, useState } from 'react';
import {
  FieldError,
  PlanInput,
  SolveResult,
  validateInput,
} from './lib/model';
import { solvePlan } from './lib/solver';
import { parsePlanText, planToJson, SAMPLE_PLAN } from './lib/io';
import { NodeTable } from './components/NodeTable';
import { LinkTable } from './components/LinkTable';
import { ResultPanel } from './components/ResultPanel';
import { ImportModal } from './components/ImportModal';

interface StoredResult {
  /** 结果对应的输入快照；当前输入与之不同即立即失效 */
  signature: string;
  errors: FieldError[] | null;
  result: SolveResult | null;
}

function signatureOf(input: PlanInput): string {
  // 以编辑顺序与全部字段值为指纹：任何编辑（含编号调整）都会改变结果有效性
  return JSON.stringify(input);
}

export function App() {
  const [input, setInput] = useState<PlanInput>(() => structuredClone(SAMPLE_PLAN));
  const [stored, setStored] = useState<StoredResult | null>(null);
  const [showImport, setShowImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const signature = signatureOf(input);
  const isStale = stored !== null && stored.signature !== signature;
  const active: StoredResult | null = isStale ? null : stored;

  // 实时校验仅供行高亮；正式字段错误以点击“启动计算”时一次性反馈为准
  const liveErrors = useMemo(() => {
    const v = validateInput(input);
    return 'errors' in v ? new Set(v.errors.map((e) => e.field)) : new Set<string>();
  }, [input]);

  const runCompute = () => {
    const v = validateInput(input);
    if ('errors' in v) {
      setStored({ signature, errors: v.errors, result: null });
      return;
    }
    setStored({ signature, errors: null, result: solvePlan(v.model) });
  };

  const replaceAll = (next: PlanInput) => {
    setInput(next);
    setStored(null);
  };

  const exportJson = () => {
    const blob = new Blob([planToJson(input)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timing-plan.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File) => {
    try {
      const text = await file.text();
      replaceAll(parsePlanText(text));
      setShowImport(false);
    } catch (e) {
      alert(`导入失败：${(e as Error).message}`);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>精密试验场 · 授时网络追溯树规划台</h1>
          <div className="sub">
            每台从钟恰选一条上游入边，求解以主钟为根、总安装代价最小的有向生成树；
            同代价取所选链路编号升序数组字典序最小者。全部计算在本地浏览器完成。
          </div>
        </div>
      </header>

      <div className="toolbar">
        <button className="primary" onClick={runCompute}>
          ▶ 启动计算
        </button>
        <button onClick={() => setShowImport(true)}>导入（JSON / 文本）</button>
        <button onClick={() => fileInputRef.current?.click()}>从文件导入</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.txt,application/json,text/plain"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = '';
          }}
        />
        <button onClick={exportJson}>导出 JSON</button>
        <button onClick={() => replaceAll(structuredClone(SAMPLE_PLAN))}>载入示例</button>
        <button
          className="danger"
          onClick={() => replaceAll({ nodes: [{ id: 'M', master: true }, { id: '' }], links: [] })}
        >
          清空
        </button>
      </div>

      <div className="layout">
        <section className="panel">
          <h2>
            节点
            <span className="count">
              {input.nodes.length} / 2–40，须 id 唯一且恰有一个主钟
            </span>
          </h2>
          <NodeTable
            nodes={input.nodes}
            errorFields={active?.errors ? fieldSet(active.errors, 'nodes') : liveErrors}
            onChange={(nodes) => setInput((p) => ({ ...p, nodes }))}
          />
        </section>

        <section className="panel">
          <h2>
            候选有向链路
            <span className="count">{input.links.length} / 1–120，编号唯一 · 正整数代价</span>
          </h2>
          <LinkTable
            links={input.links}
            nodes={input.nodes}
            errorFields={active?.errors ? fieldSet(active.errors, 'links') : liveErrors}
            onChange={(links) => setInput((p) => ({ ...p, links }))}
          />
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>计算结果</h2>

        {isStale && (
          <div className="stale-banner">
            ⚠ 输入自上次计算后已变化，旧结果已失效。请重新点击「启动计算」。
          </div>
        )}

        {active?.errors && (
          <div className="errors-box">
            <h3>输入存在 {active.errors.length} 处字段错误（已全部定位）：</h3>
            <ul>
              {active.errors.map((e, i) => (
                <li key={i}>
                  <code>{e.field}</code>：{e.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {active?.result && !active.result.ok && (
          <div className="unreachable-box">
            <h3>结构合法，但候选链路无法构成覆盖全部节点的追溯树</h3>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              下列节点在候选有向图中从主钟
              <span style={{ color: 'var(--master)' }}> {active.result.model.masterId} </span>
              出发不可达（逐台自选最便宜入边形成的闭环也会导致此问题），
              请补充或调整候选链路：
            </div>
            <div>
              {active.result.unreachableNodeIds.map((id) => (
                <span key={id} className="chip bad">
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}

        {active?.result?.ok && <ResultPanel result={active.result} />}

        {!active && !isStale && (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            编辑或导入节点、主钟与候选链路后，点击「启动计算」查看每台从钟的父链路、
            到主钟的完整路径与总代价。
          </div>
        )}
      </section>

      <div className="footer-note">
        全局裁决算法：Edmonds（Chu–Liu）有根最小树形图 + 编号字典序破并列；纯前端本地计算，无网络请求。
      </div>

      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onImport={replaceAll} />
      )}
    </div>
  );
}

function fieldSet(errors: FieldError[], prefix: 'nodes' | 'links'): Set<string> {
  return new Set(
    errors
      .filter((e) => e.field === prefix || e.field.startsWith(`${prefix}[`) || e.field === 'master')
      .map((e) => e.field),
  );
}
