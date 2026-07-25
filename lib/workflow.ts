import { AgentId, agentById } from "./agents";
import { checkCompliance, ComplianceResult } from "./compliance";

export type StepStatus =
  | "waiting"
  | "running"
  | "done"
  | "needs_review"
  | "blocked";

export type WorkflowStep = {
  id: string;
  agentId: AgentId;
  title: string;
  objective: string;
  input: string;
  output: string;
  status: StepStatus;
  duration: string;
  compliance?: ComplianceResult;
  handoff?: string;
};

export type WorkflowRun = {
  command: string;
  tenantId?: string;
  tenantName?: string;
  executionMode: "mock" | "openai";
  model: string;
  runLog: string[];
  customerProfile: {
    segment: string;
    painPoint: string;
    stage: string;
    product: string;
  };
  steps: WorkflowStep[];
};

const defaultCommand = "帮我设计黄金交易新手课的7天私域转化流程";

type WorkflowScenario = {
  industryName: string;
  product: string;
  segment: string;
  painPoint: string;
  stage: string;
  corePath: string;
  riskPrinciple: string;
  positioningInput: string;
  positioningOutput: string[];
  contentPlanTitle: string;
  contentInput: string;
  contentPlan: string[];
  leadPathInput: string;
  leadPath: string[];
  sampleQuestion: string;
  publicToPrivate: string[];
  accountOps: string[];
  accountCare: string[];
  advisorNext: string[];
  salesTitle: string;
  salesInput: string;
  salesOutput: string[];
  analyticsInput: string;
  analyticsOutput: string[];
};

function getWorkflowScenario(command: string): WorkflowScenario {
  if (command.includes("医美") || command.includes("面诊") || command.includes("护理")) {
    return {
      industryName: "医美",
      product: "医美项目科普与面诊咨询服务",
      segment: "关注医美项目但担心效果和风险的潜在客户",
      painPoint: "不了解项目边界、恢复期、个体差异和正规面诊流程",
      stage: "从短视频/小红书种草进入预约咨询前",
      corePath: "项目科普短视频 → 面诊评估说明 → 私域咨询 → 预约面诊 → 人工咨询师跟进",
      riskPrinciple: "只做项目科普、流程说明和预约引导，不承诺效果，不自动给医疗方案。",
      positioningInput: "医美机构、医生资质、项目科普、面诊评估、恢复期护理",
      positioningOutput: [
        "定位建议：用“专业面诊评估与项目科普”替代“保证变美”。",
        "内容支柱：项目原理、适合/不适合人群、恢复期护理、医生资质、真实咨询流程。",
        "差异化：强调正规资质、个体差异和面诊评估，避免夸大前后对比。",
      ],
      contentPlanTitle: "生成医美7天内容计划",
      contentInput: "医美咨询、面诊评估、项目科普、恢复期护理",
      contentPlan: [
        "Day 1：为什么做项目前先做面诊评估。",
        "Day 2：一个项目是否适合你，不能只看别人案例。",
        "Day 3：恢复期护理容易忽略的三件事。",
        "Day 4：如何看医生资质和机构资质。",
        "Day 5：常见医美项目的风险边界科普。",
        "Day 6：咨询预约引导：先了解基础情况，再安排面诊。",
        "Day 7：直播预热：医生讲面诊流程，不做效果承诺。",
      ],
      leadPathInput: "小红书评论、抖音私信、预约表单、企业微信咨询",
      leadPath: [
        "线索入口1：评论关键词“面诊”，引导领取《项目评估前准备清单》。",
        "线索入口2：预约表单收集关注项目、既往经历、期望和禁忌情况。",
        "线索入口3：企业微信承接咨询，自动提示“具体方案需面诊评估”。",
        "评分规则：关注具体项目 + 愿意面诊 + 接受风险提示 = 高意向。",
      ],
      sampleQuestion: "用户评论：这个项目能维持多久？一定有效吗？",
      publicToPrivate: [
        "评论回复：维持时间和效果会因个体情况不同，建议先做正规面诊评估。",
        "私信草稿：可以先发你一份《项目评估前准备清单》，里面会说明适合人群、恢复期和面诊前注意事项。",
        "咨询提示：线上内容只做科普，不替代医生面诊，也不承诺具体效果。",
      ],
      accountOps: [
        "主账号：每天1条医生/咨询师科普短视频，强调流程和风险边界。",
        "切片号：每天1-2条直播切片，统一导向预约评估清单。",
        "图文号：发布恢复期护理、面诊准备和资质说明。",
        "互动：高风险咨询进入人工审核，不自动给项目方案。",
      ],
      accountCare: [
        "频率建议：医美内容避免高频促销刷屏。",
        "重复度控制：同类项目话术保留多个合规版本轮换。",
        "安全提醒：价格、效果、适应症、恢复期问题必须人工确认。",
      ],
      advisorNext: [
        "优先级1：先整理《项目评估前准备清单》作为资料钩子。",
        "优先级2：发布3条面诊评估类视频测试咨询率。",
        "优先级3：直播只讲项目原理和流程，不做效果承诺。",
        "优先级4：高意向客户进入人工面诊预约队列。",
      ],
      salesTitle: "生成面诊预约转化话术",
      salesInput: "高意向用户：关注项目效果，担心风险，希望先了解适合度",
      salesOutput: [
        "预约引导：具体方案需要结合你的基础情况和医生面诊评估，建议先预约一次评估。",
        "服务介绍：我们会先做项目原理、风险边界和恢复期说明，再由专业人员评估是否适合。",
        "异议处理：如果你担心效果，可以先了解个体差异、恢复期和风险提示，不建议只看案例做决定。",
        "边界说明：线上沟通只做信息收集和科普，不替代医生面诊，也不承诺具体效果。",
      ],
      analyticsInput: "医美内容获客与面诊预约流程",
      analyticsOutput: [
        "日报指标：曝光、收藏、评论、私信、资料领取、预约表单、面诊到店。",
        "转化漏斗：内容曝光 → 评论/私信 → 企业微信 → 预约面诊 → 到店咨询 → 成交。",
        "优化建议：如果私信率低，调整项目科普角度；如果预约低，优化面诊准备清单和咨询引导。",
      ],
    };
  }

  if (command.includes("中医") || command.includes("养生") || command.includes("调理")) {
    return {
      industryName: "中医",
      product: "中医健康科普与门店咨询服务",
      segment: "关注养生调理但需要正规咨询的潜在客户",
      painPoint: "不知道如何辨别体质、容易照搬偏方、缺少线下咨询路径",
      stage: "从健康科普内容进入门店咨询前",
      corePath: "健康科普短视频 → 体质/作息资料 → 企业微信咨询 → 预约到店 → 人工接诊",
      riskPrinciple: "只做健康科普、作息建议和预约引导，不远程诊断，不自动开方。",
      positioningInput: "中医馆、体质科普、节气养生、门店咨询、健康免责声明",
      positioningOutput: [
        "定位建议：用“日常调理和健康科普”替代“包治根治”。",
        "内容支柱：作息饮食、节气养生、体质科普、门店咨询流程、就医提醒。",
        "差异化：强调辨证需要线下咨询，不用单一方子套所有人。",
      ],
      contentPlanTitle: "生成中医7天内容计划",
      contentInput: "中医健康科普、节气养生、门店咨询、体质调理",
      contentPlan: [
        "Day 1：为什么体质调理不能照搬别人的方子。",
        "Day 2：夏季作息和饮食调理的三个基础点。",
        "Day 3：常见亚健康信号，哪些情况应及时正规就医。",
        "Day 4：节气养生应该先看生活习惯。",
        "Day 5：到店咨询前可以准备哪些信息。",
        "Day 6：门店咨询流程说明，不做线上诊断。",
        "Day 7：直播预热：健康科普答疑，高风险问题转人工。",
      ],
      leadPathInput: "视频号评论、快手评论、企业微信、门店预约表单",
      leadPath: [
        "线索入口1：评论关键词“调理”，引导领取《作息饮食自查表》。",
        "线索入口2：预约表单收集作息、饮食、主要困扰和是否已就医。",
        "线索入口3：企业微信承接咨询，自动提示“不替代医生诊断”。",
        "评分规则：愿意到店 + 描述完整 + 接受线下咨询 = 高意向。",
      ],
      sampleQuestion: "用户评论：我这个症状吃什么能根治？",
      publicToPrivate: [
        "评论回复：具体症状不能仅凭评论判断，建议正规就医或线下咨询。",
        "私信草稿：可以先发你一份《作息饮食自查表》，用于整理基础情况，后续由人工帮你预约咨询。",
        "咨询提示：线上内容仅为健康科普，不替代医生诊断，也不提供处方。",
      ],
      accountOps: [
        "主账号：每天1条健康科普短视频，强调作息、饮食和正规咨询。",
        "切片号：每天1条直播答疑切片，敏感症状问题不直接回答治疗方案。",
        "图文号：发布节气养生、体质科普和门店流程。",
        "互动：涉及症状、药方、治疗结果的问题进入人工审核。",
      ],
      accountCare: [
        "频率建议：健康内容保持稳定更新，避免过度营销。",
        "重复度控制：免责声明和转人工提示保持统一。",
        "安全提醒：症状、用药、处方、疗效问题必须人工确认。",
      ],
      advisorNext: [
        "优先级1：先准备《作息饮食自查表》作为资料钩子。",
        "优先级2：发布3条节气养生视频测试收藏率。",
        "优先级3：直播只讲健康科普，不做线上诊断。",
        "优先级4：高意向客户进入门店预约队列。",
      ],
      salesTitle: "生成门店咨询转化话术",
      salesInput: "高意向用户：有健康调理需求，希望知道是否适合到店咨询",
      salesOutput: [
        "预约引导：你的情况需要结合更多信息判断，可以先预约到店咨询。",
        "服务介绍：我们会先了解作息、饮食、主要困扰和既往情况，再由专业人员评估。",
        "异议处理：如果你担心是否适合，可以先整理自查表，人工会帮你判断是否需要到店。",
        "边界说明：线上沟通只做健康科普和预约引导，不替代医生诊断，也不提供处方。",
      ],
      analyticsInput: "健康科普获客与门店咨询流程",
      analyticsOutput: [
        "日报指标：曝光、收藏、评论、资料领取、企业微信添加、预约、到店。",
        "转化漏斗：内容曝光 → 评论/私信 → 企业微信 → 预约咨询 → 到店 → 服务转化。",
        "优化建议：如果收藏低，优化科普主题；如果预约低，优化自查表和到店流程说明。",
      ],
    };
  }

  if (command.includes("金融") || command.includes("财商") || command.includes("资产")) {
    return {
      industryName: "金融",
      product: "金融知识科普与顾问咨询服务",
      segment: "关注资产配置和风险管理的潜在客户",
      painPoint: "想了解理财常识但容易被保本保息、稳赚话术误导",
      stage: "从金融科普内容进入顾问咨询前",
      corePath: "金融科普短视频 → 风险测评资料 → 私域咨询 → 人工顾问跟进",
      riskPrinciple: "只做金融知识科普和风险教育，不推荐具体标的，不承诺收益。",
      positioningInput: "财商教育、资产配置、风险测评、金融合规、顾问咨询",
      positioningOutput: [
        "定位建议：用“风险认知和财商科普”替代“稳赚方案”。",
        "内容支柱：风险承受能力、预算管理、保险常识、长期配置、常见误区。",
        "差异化：强调科普和决策框架，不给具体产品推荐。",
      ],
      contentPlanTitle: "生成金融7天内容计划",
      contentInput: "金融科普、资产配置、风险教育、顾问咨询",
      contentPlan: [
        "Day 1：普通家庭做配置前先问自己的三个问题。",
        "Day 2：为什么不能轻信保本保息。",
        "Day 3：风险承受能力到底看什么。",
        "Day 4：预算管理比追高收益更重要。",
        "Day 5：保险科普：先理解保障边界。",
        "Day 6：直播预热：讲风险识别，不推荐产品。",
        "Day 7：引导测评：先做风险测评，再人工咨询。",
      ],
      leadPathInput: "YouTube评论、TikTok私信、资料领取、Telegram Bot",
      leadPath: [
        "线索入口1：评论关键词“测评”，引导领取《风险承受能力自测表》。",
        "线索入口2：表单收集年龄段、目标、负债、风险偏好和咨询需求。",
        "线索入口3：Telegram/企业微信承接，自动提示“不构成投资建议”。",
        "评分规则：资料填写完整 + 明确咨询目标 + 接受风险提示 = 高意向。",
      ],
      sampleQuestion: "用户评论：有没有稳赚的产品推荐？",
      publicToPrivate: [
        "评论回复：不能承诺稳赚，也不能直接推荐具体产品，可以先了解风险承受能力和基础配置原则。",
        "私信草稿：我可以发你一份《风险承受能力自测表》，用于梳理目标、期限和风险偏好。",
        "咨询提示：内容仅为金融知识科普，不构成具体投资建议。",
      ],
      accountOps: [
        "主账号：每天1条金融科普短视频，强调风险识别和基础常识。",
        "切片号：每天1条直播切片，统一导向风险测评资料。",
        "图文号：发布财商清单、预算模板和风险提示。",
        "互动：涉及产品、收益、标的的问题全部进入人工审核。",
      ],
      accountCare: [
        "频率建议：金融内容避免高频诱导咨询。",
        "重复度控制：收益、风险、免责声明的表达保持一致。",
        "安全提醒：产品推荐、收益测算、投资建议必须人工确认。",
      ],
      advisorNext: [
        "优先级1：先准备《风险承受能力自测表》作为资料钩子。",
        "优先级2：发布3条风险误区视频测试评论率。",
        "优先级3：直播只讲风险教育，不推荐具体产品。",
        "优先级4：高意向客户进入人工顾问跟进队列。",
      ],
      salesTitle: "生成顾问咨询转化话术",
      salesInput: "高意向用户：想做资产配置，关心收益和风险",
      salesOutput: [
        "咨询引导：如果你想系统梳理目标和风险承受能力，可以先做一份测评，再由人工顾问沟通。",
        "服务介绍：咨询重点是帮你理解风险、目标和配置逻辑，不提供保本保息承诺。",
        "异议处理：如果你关心收益，第一步更应该先明确期限、风险承受能力和流动性需求。",
        "边界说明：内容仅为金融知识科普，不构成具体投资建议，也不承诺收益。",
      ],
      analyticsInput: "金融科普获客与顾问咨询流程",
      analyticsOutput: [
        "日报指标：曝光、评论、测评领取、表单提交、私域添加、人工咨询、成交。",
        "转化漏斗：内容曝光 → 评论/私信 → 测评表单 → 私域咨询 → 人工顾问 → 付费服务。",
        "优化建议：如果测评领取低，调整风险话题；如果人工咨询低，优化测评后承接话术。",
      ],
    };
  }

  return {
    industryName: "交易教学",
    product: command.includes("黄金") ? "黄金交易新手课" : "交易教学训练营",
    segment: "交易教学新手学员",
    painPoint: "缺少交易体系、容易追买卖点、风险认知不足",
    stage: "公域关注后准备进入私域学习",
    corePath: "短视频教育触达 → 资料领取 → 社群7天学习 → 试听课 → 人工销售跟进",
    riskPrinciple: "只做教学、案例复盘和风险教育，不输出买卖点或收益承诺。",
    positioningInput: "交易教学账号、黄金入门、风控教育、课程转化路径",
    positioningOutput: [
      "定位建议：用“交易风险管理教练”替代“带你赚钱老师”。",
      "内容支柱：新手误区、交易纪律、仓位管理、复盘方法、模拟训练。",
      "差异化：强调训练流程、学习陪跑和风险意识，避免炫耀收益。",
    ],
    contentPlanTitle: "生成7天内容计划",
    contentInput: "交易新手、黄金交易、7天私域转化",
    contentPlan: [
      "Day 1：为什么新手先学风控，而不是先找买卖点。",
      "Day 2：一张图看懂黄金交易常见波动场景。",
      "Day 3：新手最容易忽略的三类交易成本。",
      "Day 4：如何做一份交易复盘记录。",
      "Day 5：模拟盘训练为什么比盲目实盘更重要。",
      "Day 6：直播课预热：用案例讲解交易计划，不给具体交易建议。",
      "Day 7：邀请试听课：适合想系统学习交易纪律的新手。",
    ],
    leadPathInput: "短视频评论、直播预约、资料领取、表单线索",
    leadPath: [
      "线索入口1：短视频评论关键词“学习计划”，引导领取《交易新手7天学习表》。",
      "线索入口2：直播预约页收集学习经验、交易品类、当前困惑。",
      "线索入口3：社群入群表单筛选是否接受风险提示和教学边界。",
      "评分规则：填写完整 + 关注风控 + 愿意试听 = 高意向。",
    ],
    sampleQuestion: "用户评论：黄金交易怎么入门？",
    publicToPrivate: [
      "评论回复：可以先从风险认知和复盘习惯开始，不建议一上来追买卖点。",
      "私信草稿：我整理了一份《黄金交易新手7天学习表》，主要讲基础概念、风险意识和复盘方法。如果你想系统学习，可以发你一份。",
      "入群提示：群内只做交易教学和案例复盘，不提供喊单、跟单或收益承诺。",
    ],
    accountOps: [
      "主账号：每天1条教学短视频，强调学习路径和风险意识。",
      "切片号：每天2条直播切片，统一导向资料领取。",
      "图文号：每天1篇复盘模板或新手误区。",
      "互动：每日固定两次回复评论，所有私信草稿进入审核中心。",
    ],
    accountCare: [
      "频率建议：新号每天1-2条内容，不做高频私信触达。",
      "重复度控制：同一引导话术保留3个版本轮换。",
      "安全提醒：涉及课程转化的私信必须人工确认，不自动群发。",
    ],
    advisorNext: [
      "优先级1：先准备《交易新手7天学习表》作为资料钩子。",
      "优先级2：发布3条新手误区短视频测试评论率。",
      "优先级3：直播课只讲学习框架和案例复盘，不讲具体买卖点。",
      "优先级4：高意向用户进入人工销售跟进队列。",
    ],
    salesTitle: "生成课程转化话术",
    salesInput: "高意向用户：新手，想系统学习黄金交易，担心亏损",
    salesOutput: [
      "试听邀约：如果你现在最困惑的是交易没有体系，可以先来听一节入门公开课。",
      "课程介绍：课程重点是基础概念、风险管理、复盘训练和交易纪律，不提供喊单或跟单服务。",
      "异议处理：如果你担心亏损，第一步更应该学习如何识别风险、控制仓位和做模拟训练。",
      "边界说明：课程是教学服务，不承诺收益，也不构成任何投资建议。",
    ],
    analyticsInput: "7天私域转化流程",
    analyticsOutput: [
      "日报指标：曝光、评论、资料领取、入群、试听预约、人工跟进、成交。",
      "转化漏斗：内容曝光 → 互动 → 表单 → 入群 → 试听 → 付费。",
      "优化建议：如果评论率低，调整选题；如果入群低，调整资料钩子；如果试听低，优化公开课主题。",
    ],
  };
}

export function createWorkflow(command = defaultCommand): WorkflowRun {
  const normalizedCommand = command.trim() || defaultCommand;
  const scenario = getWorkflowScenario(normalizedCommand);
  const product = scenario.product;

  const steps: WorkflowStep[] = [
    {
      id: "step-01",
      agentId: "brain",
      title: "拆解指挥官目标",
      objective: "把一句话任务拆成可执行的私域运营链路。",
      input: normalizedCommand,
      output: [
        `目标产品：${product}`,
        `目标人群：${scenario.segment}。`,
        `核心路径：${scenario.corePath}。`,
        `风控原则：${scenario.riskPrinciple}`,
      ].join("\n"),
      status: "waiting",
      duration: "12s",
      handoff: "交给 AI创作、AI获客、IP拆解并行拆分。",
    },
    {
      id: "step-02",
      agentId: "ipResearch",
      title: `拆解${scenario.industryName} IP 打法`,
      objective: "形成可参考但不照搬的内容定位和差异化表达。",
      input: scenario.positioningInput,
      output: scenario.positioningOutput.join("\n"),
      status: "waiting",
      duration: "18s",
      handoff: "交给 AI创作生成选题库。",
    },
    {
      id: "step-03",
      agentId: "creator",
      title: scenario.contentPlanTitle,
      objective: "生成短视频、图文和直播预热视频的内容素材。",
      input: scenario.contentInput,
      output: scenario.contentPlan.join("\n"),
      status: "waiting",
      duration: "24s",
      handoff: "交给账号运营安排发布节奏。",
    },
    {
      id: "step-04",
      agentId: "leadGen",
      title: "设计获客路径",
      objective: "规划从公域内容到私域线索池的转化入口。",
      input: scenario.leadPathInput,
      output: scenario.leadPath.join("\n"),
      status: "waiting",
      duration: "16s",
      handoff: "交给公转私生成引导话术。",
    },
    {
      id: "step-05",
      agentId: "publicToPrivate",
      title: "生成公转私话术",
      objective: "生成评论区、私信、入群引导的话术草稿。",
      input: scenario.sampleQuestion,
      output: scenario.publicToPrivate.join("\n"),
      status: "waiting",
      duration: "20s",
      handoff: "高风险触达内容，必须交给合规风控审核。",
    },
    {
      id: "step-06",
      agentId: "accountOps",
      title: "安排账号矩阵发布",
      objective: "制定一周账号发布和互动节奏。",
      input: "主账号、切片号、图文号、直播预热",
      output: scenario.accountOps.join("\n"),
      status: "waiting",
      duration: "14s",
      handoff: "交给养号管理检查节奏风险。",
    },
    {
      id: "step-07",
      agentId: "accountCare",
      title: "检查账号健康",
      objective: "控制频率、重复度和账号异常风险。",
      input: "每日发布、评论回复、私信草稿、资料领取入口",
      output: scenario.accountCare.join("\n"),
      status: "waiting",
      duration: "10s",
      handoff: "交给 AI锦囊汇总下一步动作。",
    },
    {
      id: "step-08",
      agentId: "advisor",
      title: "生成运营下一步建议",
      objective: "给运营人员一个可执行动作清单。",
      input: "内容计划、获客路径、公转私话术、账号节奏",
      output: scenario.advisorNext.join("\n"),
      status: "waiting",
      duration: "9s",
      handoff: "交给 AI成交生成课程转化话术。",
    },
    {
      id: "step-09",
      agentId: "sales",
      title: scenario.salesTitle,
      objective: "生成咨询、预约、课程或服务介绍的转化话术草稿。",
      input: scenario.salesInput,
      output: scenario.salesOutput.join("\n"),
      status: "waiting",
      duration: "22s",
      handoff: "课程转化话术必须交给合规风控审核。",
    },
    {
      id: "step-10",
      agentId: "compliance",
      title: "审核对外内容风险",
      objective: `检查所有触达、转化和${scenario.industryName}行业表达。`,
      input: "公转私话术 + 转化话术 + 内容计划",
      output: "",
      status: "waiting",
      duration: "11s",
      handoff: "审核通过后进入人工确认；发现风险则阻断。",
    },
    {
      id: "step-11",
      agentId: "analytics",
      title: "生成数据复盘模板",
      objective: "定义客户试用时可看的运营指标。",
      input: scenario.analyticsInput,
      output: scenario.analyticsOutput.join("\n"),
      status: "waiting",
      duration: "8s",
      handoff: "全流程完成，等待人工确认对外动作。",
    },
  ];

  return {
    command: normalizedCommand,
    executionMode: "mock",
    model: "mock",
    runLog: ["当前使用本地 mock 输出。配置 OPENAI_API_KEY 后将自动调用 OpenAI API。"],
    customerProfile: {
      segment: scenario.segment,
      painPoint: scenario.painPoint,
      stage: scenario.stage,
      product,
    },
    steps,
  };
}

export function runComplianceForStep(step: WorkflowStep, allSteps: WorkflowStep[]) {
  const agent = agentById[step.agentId];
  if (step.agentId !== "compliance") {
    return step;
  }

  const textForReview = allSteps
    .filter((candidate) =>
      ["creator", "publicToPrivate", "sales"].includes(candidate.agentId),
    )
    .map((candidate) => `${candidate.title}\n${candidate.output}`)
    .join("\n\n");

  const result = checkCompliance(textForReview);
  const status: StepStatus = result.passed ? "needs_review" : "blocked";

  return {
    ...step,
    status,
    compliance: result,
    output: [
      `${agent.name}结论：${result.summary}`,
      `合规分：${result.score}/100`,
      result.hits.length
        ? `风险点：${result.hits.map((hit) => `${hit.keyword}（${hit.reason}）`).join("；")}`
        : "风险点：未发现收益承诺、喊单、荐股荐币或诱导高杠杆表达。",
      `改写建议：${result.rewriteAdvice.join("；")}`,
    ].join("\n"),
  };
}
