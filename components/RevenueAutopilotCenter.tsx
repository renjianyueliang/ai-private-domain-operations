"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  Pause,
  Play,
  ShieldCheck,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import {
  autopilotModes,
  type AutopilotMode,
  type RevenueAutopilotProfile,
} from "../lib/autopilot";

type RevenueAutopilotCenterProps = {
  tenantName: string;
  riskLevel: string;
  profile: RevenueAutopilotProfile;
  isRunning: boolean;
  isPaused: boolean;
  onRun: () => void;
  onTogglePause: () => void;
};

const activityStatusLabels = {
  running: "执行中",
  queued: "已排队",
  review: "待审核",
  done: "已完成",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
}

export function RevenueAutopilotCenter({
  tenantName,
  riskLevel,
  profile,
  isRunning,
  isPaused,
  onRun,
  onTogglePause,
}: RevenueAutopilotCenterProps) {
  const [mode, setMode] = useState<AutopilotMode>(profile.mode);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [notice, setNotice] = useState("当前策略已继承行业合规规则，高风险动作仍需人工确认。");

  const visibleExceptions = useMemo(
    () => profile.exceptions.filter((item) => !dismissed.includes(item.id)),
    [dismissed, profile.exceptions],
  );

  function chooseMode(nextMode: AutopilotMode) {
    setMode(nextMode);
    const definition = autopilotModes.find((item) => item.id === nextMode);
    setNotice(`已切换为${definition?.name ?? "新的运行模式"}。正式环境将写入租户策略和审计日志。`);
  }

  return (
    <section id="today" className="autopilot-center" aria-label="营收自动驾驶中心">
      <div className="autopilot-hero">
        <div>
          <div className="section-kicker">营收自动驾驶 <span>演示数据</span></div>
          <h1>系统围绕经营目标持续运行</h1>
          <p>{tenantName} · {profile.goalName} · {riskLevel}行业策略</p>
        </div>
        <div className="autopilot-state-actions">
          <span className={`autopilot-state ${isPaused ? "paused" : "active"}`} role="status" aria-live="polite">
            {isPaused ? <Pause size={15} /> : <Activity size={15} />}
            {isPaused ? "AI团队已暂停" : isRunning ? "AI团队执行中" : "自动驾驶待命"}
          </span>
          {!isRunning && (
            <button type="button" className="autopilot-primary" onClick={onRun}>
              <Play size={17} />立即执行今日计划
            </button>
          )}
          <button
            type="button"
            className="autopilot-pause"
            onClick={() => {
              onTogglePause();
              setNotice(isPaused ? "自动驾驶已恢复。" : "自动驾驶已暂停，当前任务会在安全节点等待恢复。");
            }}
            disabled={!isRunning}
          >
            {isPaused ? "恢复运行" : "暂停"}
          </button>
        </div>
      </div>

      <div className="autopilot-metrics">
        <article>
          <span className="metric-icon green"><CircleDollarSign size={18} /></span>
          <div><small>演示归因收入</small><strong>{formatCurrency(profile.attributedRevenue)}</strong><em>样例订单 · 目标 {formatCurrency(profile.targetRevenue)}</em></div>
        </article>
        <article>
          <span className="metric-icon blue"><TrendingUp size={18} /></span>
          <div><small>商机金额</small><strong>{formatCurrency(profile.pipelineValue)}</strong><em>按当前成交概率估算</em></div>
        </article>
        <article>
          <span className="metric-icon amber"><Gauge size={18} /></span>
          <div><small>运营成本</small><strong>{formatCurrency(profile.operatingCost)}</strong><em>模型、视频与线索处理</em></div>
        </article>
        <article>
          <span className="metric-icon violet"><Target size={18} /></span>
          <div><small>归因投入产出</small><strong>{profile.attributedRoi}x</strong><em>毛利率约 {Math.round(profile.grossMarginRate * 100)}%</em></div>
        </article>
      </div>

      <div className="autopilot-main-grid">
        <article className="autopilot-goal-card">
          <div className="autopilot-card-heading">
            <div><strong>经营目标</strong><span>收入来自订单归因，不以播放量代替收益</span></div>
            <em>{profile.progressPercent}%</em>
          </div>
          <div className="autopilot-goal-progress" aria-label={`经营目标完成 ${profile.progressPercent}%`}>
            <span style={{ width: `${profile.progressPercent}%` }} />
          </div>
          <div className="autopilot-goal-numbers">
            <span>已完成 <strong>{formatCurrency(profile.attributedRevenue)}</strong></span>
            <span>预计商机 <strong>{formatCurrency(profile.pipelineValue)}</strong></span>
            <span>目标缺口 <strong>{formatCurrency(Math.max(profile.targetRevenue - profile.attributedRevenue, 0))}</strong></span>
          </div>
        </article>

        <article className="autopilot-mode-card">
          <div className="autopilot-card-heading">
            <div><strong>自动化等级</strong><span>客户只需选择结果和风险偏好</span></div>
            <ShieldCheck size={19} />
          </div>
          <div className="autopilot-mode-grid">
            {autopilotModes.map((item) => (
              <button
                key={item.id}
                type="button"
                className={mode === item.id ? "active" : ""}
                aria-pressed={mode === item.id}
                onClick={() => chooseMode(item.id)}
              >
                <strong>{item.name}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>
          <p className="autopilot-policy-note" role="status" aria-live="polite"><ShieldCheck size={15} />{notice}</p>
        </article>
      </div>

      <div className="autopilot-operations-grid">
        <article className="autopilot-activity-card">
          <div className="autopilot-card-heading">
            <div><strong>{isRunning ? (isPaused ? "系统已在安全节点暂停" : "系统正在做什么") : "今日运行计划"}</strong><span>按营收影响、风险和截止时间自动排序</span></div>
            <Bot size={19} />
          </div>
          <div className="autopilot-activity-list">
            {profile.activities.map((item) => (
              <div key={item.id}>
                <span className={`activity-dot ${item.status}`} />
                <div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.owner}</small></div>
                <em className={item.status}>
                  {isPaused && item.status === "running"
                    ? "已暂停"
                    : !isRunning && item.status === "running"
                      ? "待启动"
                      : !isRunning && item.status === "queued"
                        ? "待启动"
                        : !isRunning && item.status === "done"
                          ? "已准备"
                          : activityStatusLabels[item.status]}
                </em>
              </div>
            ))}
          </div>
        </article>

        <article className="autopilot-exception-card">
          <div className="autopilot-card-heading">
            <div><strong>只处理例外</strong><span>其余工作由系统自动推进和恢复</span></div>
            <em>{visibleExceptions.length}</em>
          </div>
          <div className="autopilot-exception-list">
            {visibleExceptions.length === 0 ? (
              <div className="autopilot-empty"><CheckCircle2 size={22} /><strong>没有需要人工处理的异常</strong><span>系统会继续运行并监控结果。</span></div>
            ) : visibleExceptions.map((item) => (
              <div key={item.id}>
                <AlertTriangle size={18} className={item.severity} />
                <div><strong>{item.title}</strong><p>{item.detail}</p><button type="button">{item.action}<ArrowRight size={14} /></button></div>
                <button type="button" className="dismiss-exception" aria-label={`忽略 ${item.title}`} onClick={() => setDismissed((current) => [...current, item.id])}><X size={15} /></button>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
