export type ModelProviderStatus = "connected" | "configurable" | "offline";
export type ModelProfileId = "quality" | "balanced" | "economy" | "private";

export type ModelProvider = {
  id: string;
  name: string;
  protocol: string;
  status: ModelProviderStatus;
  description: string;
  credentialMode: "platform" | "tenant" | "private";
};

export type ModelProfile = {
  id: ModelProfileId;
  name: string;
  description: string;
  priority: "quality" | "balanced" | "cost" | "privacy";
};

export type ModelRoute = {
  id: string;
  task: string;
  employee: string;
  profileId: ModelProfileId;
  fallbackProfileId: ModelProfileId;
  qualityGate: string;
};

export const modelProviders: ModelProvider[] = [
  {
    id: "primary-reasoning",
    name: "平台主推理服务",
    protocol: "Responses API",
    status: "configurable",
    description: "用于战略拆解、复杂内容和高风险审核。",
    credentialMode: "platform",
  },
  {
    id: "compatible-gateway",
    name: "兼容模型网关",
    protocol: "OpenAI-compatible",
    status: "configurable",
    description: "统一接入兼容接口的文本与多模态模型。",
    credentialMode: "tenant",
  },
  {
    id: "private-runtime",
    name: "客户私有模型",
    protocol: "Private endpoint",
    status: "offline",
    description: "企业版可连接专属部署或本地推理服务。",
    credentialMode: "private",
  },
];

export const modelProfiles: ModelProfile[] = [
  {
    id: "quality",
    name: "质量优先",
    description: "复杂推理、合规与高价值内容",
    priority: "quality",
  },
  {
    id: "balanced",
    name: "智能均衡",
    description: "质量、速度和成本自动平衡",
    priority: "balanced",
  },
  {
    id: "economy",
    name: "成本优先",
    description: "批量分类、摘要与低风险回复",
    priority: "cost",
  },
  {
    id: "private",
    name: "私有模型",
    description: "客户专属数据和受限任务",
    priority: "privacy",
  },
];

export const initialModelRoutes: ModelRoute[] = [
  {
    id: "route-brain",
    task: "目标拆解与经营决策",
    employee: "AI大脑",
    profileId: "quality",
    fallbackProfileId: "balanced",
    qualityGate: "结构完整度 ≥ 90%",
  },
  {
    id: "route-content",
    task: "选题、脚本与营销内容",
    employee: "AI创作",
    profileId: "balanced",
    fallbackProfileId: "quality",
    qualityGate: "知识库引用与品牌一致",
  },
  {
    id: "route-conversation",
    task: "评论、私信与线索分类",
    employee: "公转私",
    profileId: "economy",
    fallbackProfileId: "balanced",
    qualityGate: "低风险且置信度 ≥ 85%",
  },
  {
    id: "route-compliance",
    task: "行业合规与对外风险检查",
    employee: "合规风控",
    profileId: "quality",
    fallbackProfileId: "private",
    qualityGate: "规则引擎与模型双通过",
  },
];

export function getModelProfile(profileId: ModelProfileId) {
  return modelProfiles.find((profile) => profile.id === profileId) ?? modelProfiles[1];
}
