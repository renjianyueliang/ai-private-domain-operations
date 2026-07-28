"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  FileText,
  FileVideo2,
  Link2,
  MessageSquareText,
  RadioTower,
  ShieldAlert,
  Target,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

type TodayWorkspaceProps = {
  tenantName: string;
  readyContentCount: number;
  reviewVideoCount: number;
  highIntentCount: number;
  paidOrderCount: number;
  industryName: string;
  view?: "today" | "review" | "channels" | "all";
  tenantId?: string;
};

type IndustryWorkspaceConfig = {
  setupItems: Array<{ id: string; label: string; done: boolean }>;
  revenueLoop: string[];
  contentTaskTitle: string;
  contentTaskDetail: string;
  leadTaskDetail: string;
  channelTaskTitle: string;
  scriptReviewTitle: string;
  scriptReviewRisk: string;
  replyReviewTitle: string;
  replyReviewRisk: string;
  publishReviewTitle: string;
  approvalSummary: string;
  channels: Array<{
    name: string;
    description: string;
    status: string;
    statusClass: string;
    icon: LucideIcon;
  }>;
};

const industryWorkspaceConfigs: Record<string, IndustryWorkspaceConfig> = {
  交易教学: {
    setupItems: [
      { id: "industry", label: "交易教学行业规则", done: true },
      { id: "knowledge", label: "课程与销售知识库", done: true },
      { id: "telegram", label: "Telegram Bot", done: false },
      { id: "youtube", label: "YouTube 发布授权", done: false },
      { id: "review", label: "金融内容审核规则", done: true },
    ],
    revenueLoop: ["内容", "免费资料", "Telegram", "AI 诊断", "人工成交", "课程交付"],
    contentTaskTitle: "批准 3 条风险教育视频脚本",
    contentTaskDetail: "内容员工已生成，合规员工标记 1 处收益暗示，需要人工确认。",
    leadTaskDetail: "来自 Telegram 和网站测评，已完成需求诊断并触发报价审批。",
    channelTaskTitle: "连接 Telegram Bot 与 YouTube",
    scriptReviewTitle: "50K 考试盘如何控制单日回撤",
    scriptReviewRisk: "发现“稳定通过”表述",
    replyReviewTitle: "客户询问指标是否保证盈利",
    replyReviewRisk: "金融承诺类问题，必须人工回复",
    publishReviewTitle: "YouTube 本周 3 条视频排期",
    approvalSummary: "收益承诺、价格优惠、付款退款和账号发布均保留人工批准与审计记录。",
    channels: [
      { name: "Telegram Bot", description: "官方 Bot API · 可自动回复", status: "可连接", statusClass: "status-ready", icon: RadioTower },
      { name: "YouTube", description: "OAuth 后可排期发布与读取评论", status: "待授权", statusClass: "status-pending", icon: FileVideo2 },
      { name: "企业微信", description: "需企业认证与客户联系权限", status: "待认证", statusClass: "status-pending", icon: MessageSquareText },
      { name: "视频号 / 小红书", description: "生成合规发布包与操作清单", status: "半自动", statusClass: "status-manual", icon: Bot },
    ],
  },
  金融: {
    setupItems: [
      { id: "industry", label: "金融行业合规规则", done: true },
      { id: "knowledge", label: "产品、资质与顾问知识库", done: true },
      { id: "wecom", label: "企业微信客户联系", done: false },
      { id: "youtube", label: "YouTube 发布授权", done: false },
      { id: "review", label: "金融咨询审核规则", done: true },
    ],
    revenueLoop: ["科普内容", "测评资料", "企业微信", "需求诊断", "顾问成交", "服务交付"],
    contentTaskTitle: "批准 3 条资产配置科普脚本",
    contentTaskDetail: "合规员工发现 1 处固定收益暗示，已生成安全改写版本。",
    leadTaskDetail: "来自企业微信和网站测评，已完成风险偏好与需求摘要。",
    channelTaskTitle: "连接企业微信与 YouTube",
    scriptReviewTitle: "家庭资产配置的三个常见误区",
    scriptReviewRisk: "发现确定性收益暗示",
    replyReviewTitle: "客户询问产品是否保本保息",
    replyReviewRisk: "金融产品承诺必须由持牌顾问接管",
    publishReviewTitle: "金融科普内容本周发布排期",
    approvalSummary: "产品承诺、适当性判断、报价付款和账号发布均保留人工批准与审计记录。",
    channels: [
      { name: "企业微信", description: "客户主动添加后进入顾问承接", status: "待认证", statusClass: "status-pending", icon: MessageSquareText },
      { name: "YouTube", description: "适合长视频与科普内容发布", status: "待授权", statusClass: "status-pending", icon: FileVideo2 },
      { name: "公众号 / 微信客服", description: "官方能力承接主动咨询", status: "可配置", statusClass: "status-ready", icon: RadioTower },
      { name: "小红书", description: "先生成审核后的素材包", status: "半自动", statusClass: "status-manual", icon: Bot },
    ],
  },
  医美: {
    setupItems: [
      { id: "industry", label: "医美行业与广告规则", done: true },
      { id: "knowledge", label: "项目、医生与护理知识库", done: true },
      { id: "wecom", label: "企业微信预约承接", done: false },
      { id: "douyin", label: "抖音企业号授权", done: false },
      { id: "review", label: "医疗内容审核规则", done: true },
    ],
    revenueLoop: ["科普内容", "咨询资料", "企业微信", "预约面诊", "人工成交", "到店服务"],
    contentTaskTitle: "批准 3 条面诊评估科普脚本",
    contentTaskDetail: "内容员工已生成，医疗合规检查发现 1 处疗效暗示。",
    leadTaskDetail: "来自小红书和抖音咨询，已整理项目关注点与预约意向。",
    channelTaskTitle: "连接企业微信与抖音企业号",
    scriptReviewTitle: "做项目前为什么要先面诊评估",
    scriptReviewRisk: "发现效果确定性表述",
    replyReviewTitle: "客户询问项目是否一定有效",
    replyReviewRisk: "疗效与适应症问题必须转医生或咨询师",
    publishReviewTitle: "本周医美科普内容发布排期",
    approvalSummary: "疗效判断、诊疗建议、价格优惠和账号发布均保留专业人员批准与审计记录。",
    channels: [
      { name: "企业微信", description: "主动扫码后进入预约和咨询承接", status: "待认证", statusClass: "status-pending", icon: MessageSquareText },
      { name: "抖音企业号", description: "需要企业主体与行业资质审核", status: "待授权", statusClass: "status-pending", icon: FileVideo2 },
      { name: "小红书", description: "生成封面、正文与视频素材包", status: "半自动", statusClass: "status-manual", icon: RadioTower },
      { name: "视频号", description: "内容审核后生成发布计划", status: "半自动", statusClass: "status-manual", icon: Bot },
    ],
  },
  中医: {
    setupItems: [
      { id: "industry", label: "中医健康内容规则", done: true },
      { id: "knowledge", label: "门店、医生与健康知识库", done: true },
      { id: "wecom", label: "企业微信门店承接", done: false },
      { id: "channels", label: "视频号与抖音授权", done: false },
      { id: "review", label: "健康科普审核规则", done: true },
    ],
    revenueLoop: ["健康科普", "咨询资料", "企业微信", "预约到店", "人工成交", "复诊复购"],
    contentTaskTitle: "批准 3 条节气养生科普脚本",
    contentTaskDetail: "系统发现 1 处诊断倾向表达，已转为通用健康科普。",
    leadTaskDetail: "来自视频号和抖音咨询，已整理健康关注点与到店意向。",
    channelTaskTitle: "连接企业微信与视频号",
    scriptReviewTitle: "节气变化下的日常作息建议",
    scriptReviewRisk: "发现疑似诊断与治疗承诺",
    replyReviewTitle: "客户询问能否直接判断体质并开方",
    replyReviewRisk: "诊断和处方必须由合规医师线下完成",
    publishReviewTitle: "本周健康科普内容发布排期",
    approvalSummary: "诊断处方、疗效承诺、价格优惠和账号发布均保留合规人员批准与审计记录。",
    channels: [
      { name: "企业微信", description: "承接客户主动咨询与门店预约", status: "待认证", statusClass: "status-pending", icon: MessageSquareText },
      { name: "视频号", description: "科普视频审核后生成发布包", status: "半自动", statusClass: "status-manual", icon: FileVideo2 },
      { name: "抖音 / 快手", description: "需要企业资质和健康类审核", status: "待授权", statusClass: "status-pending", icon: RadioTower },
      { name: "公众号 / 微信客服", description: "官方能力承接主动咨询", status: "可配置", statusClass: "status-ready", icon: Bot },
    ],
  },
};

const defaultWorkspaceConfig = industryWorkspaceConfigs["交易教学"];

export function TodayWorkspace({
  tenantName,
  readyContentCount,
  reviewVideoCount,
  highIntentCount,
  paidOrderCount,
  industryName,
  view = "all",
  tenantId,
}: TodayWorkspaceProps) {
  const config = industryWorkspaceConfigs[industryName] ?? defaultWorkspaceConfig;
  const setupItems = config.setupItems;
  const revenueLoop = config.revenueLoop;
  const [completedSetup, setCompletedSetup] = useState(
    setupItems.filter((item) => item.done).map((item) => item.id),
  );
  const [reviewedItems, setReviewedItems] = useState<string[]>([]);
  const setupPercent = Math.round((completedSetup.length / setupItems.length) * 100);
  const tenantSuffix = tenantId ? `?tenant=${encodeURIComponent(tenantId)}` : "";

  const todayTasks = useMemo(
    () => [
      {
        id: "task-content",
        priority: "高优先级",
        title: config.contentTaskTitle,
        detail: config.contentTaskDetail,
        owner: "内容员工 → 合规员工",
        time: "预计 8 分钟",
        href: `/workspace/review${tenantSuffix}`,
        cta: "去审核",
        icon: ClipboardCheck,
      },
      {
        id: "task-lead",
        priority: "高意向",
        title: `${Math.max(highIntentCount, 2)} 位客户等待人工接管`,
        detail: config.leadTaskDetail,
        owner: "私域员工 → 销售员工",
        time: "超过 22 分钟",
        href: `/workspace/inbox${tenantSuffix}`,
        cta: "查看会话",
        icon: MessageSquareText,
      },
      {
        id: "task-channel",
        priority: "待配置",
        title: config.channelTaskTitle,
        detail: "连接后才能自动承接咨询与发布；授权动作仍需账号管理员完成。",
        owner: "渠道管理员",
        time: "一次性配置",
        href: `/workspace/channels${tenantSuffix}`,
        cta: "开始连接",
        icon: Link2,
      },
    ],
    [config, highIntentCount],
  );

  const reviewQueue = [
    {
      id: "review-01",
      type: "视频脚本",
      severity: "需改写",
      title: config.scriptReviewTitle,
      risk: config.scriptReviewRisk,
      owner: "05 视频员工",
      action: "批准安全版本",
      doneLabel: "已批准安全版本",
    },
    {
      id: "review-02",
      type: "私域回复",
      severity: "必须人工",
      title: config.replyReviewTitle,
      risk: config.replyReviewRisk,
      owner: "08 销售员工",
      action: "转人工接管",
      doneLabel: "已转人工接管",
    },
    {
      id: "review-03",
      type: "发布任务",
      severity: "可确认",
      title: config.publishReviewTitle,
      risk: "内容合规，可确认排期",
      owner: "11 发布员工",
      action: "确认发布排期",
      doneLabel: "已确认排期",
    },
  ];

  return (
    <>
      {(view === "all" || view === "today") && (
      <section id="today-actions" className="today-command-center" aria-label="今日运营工作台">
        <div className="today-heading">
          <div>
            <div className="section-kicker">今日工作台</div>
            <h2>先推进能带来客户的 3 件事</h2>
            <p>{tenantName} 的内容、获客、私域与成交状态已经汇总到这里。</p>
          </div>
          <a className="today-run-button" href={`/workspace/review${tenantSuffix}`}>
            <ClipboardCheck size={18} aria-hidden="true" />
            处理 3 项待办
          </a>
        </div>

        <div className="today-metrics" aria-label="今日关键指标">
          <article>
            <span className="metric-icon green"><FileText size={18} /></span>
            <div><small>可用内容</small><strong>{Math.max(readyContentCount, 6)}</strong><em>3 条待审核</em></div>
          </article>
          <article>
            <span className="metric-icon amber"><FileVideo2 size={18} /></span>
            <div><small>视频队列</small><strong>{Math.max(reviewVideoCount, 4)}</strong><em>1 条存在风险</em></div>
          </article>
          <article>
            <span className="metric-icon blue"><UsersRound size={18} /></span>
            <div><small>高意向线索</small><strong>{Math.max(highIntentCount, 2)}</strong><em>建议 30 分钟内接管</em></div>
          </article>
          <article>
            <span className="metric-icon violet"><Target size={18} /></span>
            <div><small>本周期成交</small><strong>{paidOrderCount}</strong><em>按订单状态统计</em></div>
          </article>
        </div>

        <div className="today-grid">
          <article className="today-panel priority-panel">
            <div className="today-panel-heading">
              <div>
                <strong>今日优先事项</strong>
                <span>按营收影响和风险自动排序</span>
              </div>
              <small>3 项待处理</small>
            </div>
            <div className="today-task-list">
              {todayTasks.map((task) => {
                const Icon = task.icon;
                return (
                  <div key={task.id} className="today-task">
                    <span className="task-icon"><Icon size={19} aria-hidden="true" /></span>
                    <div className="task-copy">
                      <em>{task.priority}</em>
                      <strong>{task.title}</strong>
                      <p>{task.detail}</p>
                      <small>{task.owner} · {task.time}</small>
                    </div>
                    <a href={task.href}>{task.cta}<ArrowRight size={15} /></a>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="today-panel setup-panel">
            <div className="today-panel-heading">
              <div>
                <strong>上线准备度</strong>
                <span>关键配置完成后才能自动运行</span>
              </div>
              <small>{setupPercent}%</small>
            </div>
            <div className="setup-progress" aria-label={`上线准备度 ${setupPercent}%`}>
              <span style={{ width: `${setupPercent}%` }} />
            </div>
            <div className="setup-list">
              {setupItems.map((item) => {
                const checked = completedSetup.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={checked ? "completed" : ""}
                    onClick={() => setCompletedSetup((current) =>
                      checked ? current.filter((id) => id !== item.id) : [...current, item.id],
                    )}
                  >
                    <span>{checked && <Check size={14} />}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </article>
        </div>

        <article className="revenue-loop-card" aria-label="营收闭环">
          <div>
            <strong>本周验证闭环</strong>
            <span>先证明一条内容能带来一位客户与一笔订单</span>
          </div>
          <div className="revenue-loop">
            {revenueLoop.map((step, index) => (
              <span key={step} className={index < 2 ? "done" : index === 2 ? "current" : ""}>
                <em>{index < 2 ? <Check size={13} /> : index + 1}</em>{step}
                {index < revenueLoop.length - 1 && <ArrowRight size={15} />}
              </span>
            ))}
          </div>
        </article>
      </section>
      )}

      {(view === "all" || view === "review") && (
      <section id="review" className="review-center" aria-label="人工审核中心">
        <div className="section-heading-row compact-heading">
          <div>
            <div className="section-kicker">人工审核中心</div>
            <h2>只把高风险与对外动作交给真人</h2>
          </div>
          <div className="review-summary">
            <p>{config.approvalSummary}</p>
            <span role="status" aria-live="polite">
              {reviewedItems.length === reviewQueue.length
                ? "本批次已处理完毕"
                : `${reviewQueue.length - reviewedItems.length} 项等待决策`}
            </span>
          </div>
        </div>
        <div className="review-queue">
          {reviewQueue.map((item) => {
            const reviewed = reviewedItems.includes(item.id);
            return (
              <article key={item.id} className={reviewed ? "reviewed" : ""}>
                <div className="review-card-meta">
                  <span className="review-type">{item.type}</span>
                  <em>{item.severity}</em>
                </div>
                <strong>{item.title}</strong>
                <p><ShieldAlert size={15} />{item.risk}</p>
                <small>{item.owner}</small>
                <button
                  type="button"
                  onClick={() => setReviewedItems((current) =>
                    reviewed ? current.filter((id) => id !== item.id) : [...current, item.id],
                  )}
                >
                  {reviewed
                    ? <><CheckCircle2 size={15} />{item.doneLabel}</>
                    : <><ClipboardCheck size={15} />{item.action}</>}
                </button>
              </article>
            );
          })}
        </div>
      </section>
      )}

      {(view === "all" || view === "channels") && (
      <section id="channels" className="channel-center" aria-label="渠道连接状态">
        <div className="section-heading-row compact-heading">
          <div>
            <div className="section-kicker">渠道连接器</div>
            <h2>每个平台的自动化边界一眼可见</h2>
          </div>
          <p>优先使用官方 API；不具备官方权限的平台生成发布包，由真人确认上传。</p>
        </div>
        <div className="channel-status-grid">
          {config.channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <article key={channel.name}>
                <Icon size={20} />
                <div><strong>{channel.name}</strong><span>{channel.description}</span></div>
                <em className={channel.statusClass}>{channel.status}</em>
              </article>
            );
          })}
        </div>
        <div className="channel-boundary-note">
          <CircleAlert size={17} />
          个人微信外挂、非官方 Hook、批量模拟点击和绕过平台风控不纳入商业版本。
          <span><Clock3 size={14} />连接日志将进入审计中心</span>
        </div>
      </section>
      )}
    </>
  );
}
