export type ComplianceHit = {
  keyword: string;
  reason: string;
  severity: "medium" | "high";
};

export type ComplianceResult = {
  passed: boolean;
  score: number;
  hits: ComplianceHit[];
  summary: string;
  rewriteAdvice: string[];
};

const rules: ComplianceHit[] = [
  { keyword: "保证收益", reason: "交易教学不能承诺收益结果。", severity: "high" },
  { keyword: "稳赚", reason: "容易构成稳赚不赔暗示。", severity: "high" },
  { keyword: "必赚", reason: "容易构成确定性收益承诺。", severity: "high" },
  { keyword: "跟单", reason: "可能被理解为带单或具体交易建议。", severity: "high" },
  { keyword: "喊单", reason: "交易教学场景应避免实时买卖指令。", severity: "high" },
  { keyword: "荐股", reason: "涉及具体证券推荐风险。", severity: "high" },
  { keyword: "荐币", reason: "涉及具体币种推荐风险。", severity: "high" },
  { keyword: "高杠杆", reason: "不得诱导用户放大杠杆风险。", severity: "high" },
  { keyword: "翻倍", reason: "容易构成夸大收益宣传。", severity: "medium" },
  { keyword: "盈利截图", reason: "历史案例不能包装成未来收益。", severity: "medium" },
  { keyword: "保本保息", reason: "金融内容不能承诺保本或固定收益。", severity: "high" },
  { keyword: "固定收益", reason: "金融内容应避免确定性收益暗示。", severity: "high" },
  { keyword: "代客投资", reason: "涉及代客投资和资质风险。", severity: "high" },
  { keyword: "永久有效", reason: "医美内容不能承诺永久效果。", severity: "high" },
  { keyword: "无风险", reason: "医疗和医美服务不能宣称完全无风险。", severity: "high" },
  { keyword: "百分百", reason: "容易构成绝对化疗效或效果承诺。", severity: "high" },
  { keyword: "包治", reason: "健康医疗内容不能承诺包治。", severity: "high" },
  { keyword: "根治", reason: "健康医疗内容不能随意承诺根治。", severity: "high" },
  { keyword: "自动开方", reason: "系统不能自动诊断或开方。", severity: "high" },
  { keyword: "替代医院", reason: "健康科普不能替代正规医疗诊断。", severity: "high" },
];

const safeContextSignals = [
  "不提供",
  "不做",
  "不输出",
  "不面向",
  "不涉及",
  "不建议",
  "不承诺",
  "禁止",
  "不得",
  "避免",
  "拒绝",
  "不能",
  "不构成",
];

function appearsInSafeContext(text: string, keyword: string) {
  const index = text.indexOf(keyword);
  if (index < 0) return false;

  const contextStart = Math.max(0, index - 16);
  const contextEnd = Math.min(text.length, index + keyword.length + 8);
  const context = text.slice(contextStart, contextEnd);

  return safeContextSignals.some((signal) => context.includes(signal));
}

export function checkCompliance(text: string): ComplianceResult {
  const hits = rules.filter((rule) => {
    if (!text.includes(rule.keyword)) return false;
    return !appearsInSafeContext(text, rule.keyword);
  });
  const highHits = hits.filter((hit) => hit.severity === "high").length;
  const mediumHits = hits.filter((hit) => hit.severity === "medium").length;
  const score = Math.max(0, 100 - highHits * 28 - mediumHits * 14);
  const passed = hits.length === 0;

  return {
    passed,
    score,
    hits,
    summary: passed
      ? "未发现高风险宣传表达，可进入人工确认。"
      : `发现 ${hits.length} 个风险表达，建议先改写后再对外使用。`,
    rewriteAdvice: [
      "金融内容把“收益结果”改成“风险认知、知识科普和人工咨询”。",
      "医美内容把“效果承诺”改成“个体差异、面诊评估和正规资质”。",
      "中医/健康内容把“诊断治疗”改成“健康科普、线下咨询和正规就医提醒”。",
      "所有高风险行业的对外触达都应加入免责声明，并保留人工确认。",
    ],
  };
}
