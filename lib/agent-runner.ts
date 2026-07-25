import { Agent, agentById } from "./agents";
import {
  createWorkflow,
  runComplianceForStep,
  WorkflowRun,
  WorkflowStep,
} from "./workflow";
import { generateWithModelGateway } from "./model-gateway";
import { getTenantById, SaasTenant } from "./saas";

function buildAgentPrompt(
  agent: Agent,
  command: string,
  step: WorkflowStep,
  previousOutputs: WorkflowStep[],
  tenant: SaasTenant,
) {
  const previousContext = previousOutputs
    .filter((previous) => previous.output)
    .slice(-4)
    .map((previous) => {
      const previousAgent = agentById[previous.agentId];
      return `【${previousAgent.name} / ${previous.title}】\n${previous.output}`;
    })
    .join("\n\n");

  return [
    "你是一个多行业私域运营 SaaS 系统里的 AI 员工。",
    "你的任务是生成运营策略、内容草稿、流程建议或审核结论。",
    "必须遵守当前客户行业的合规边界，不得输出收益承诺、疗效承诺、诊断结论、夸大宣传、违规私信或绕过平台风控的建议。",
    "可以输出知识科普、内容策略、视频脚本、平台发布建议、私域承接流程、合规提醒和人工跟进建议。",
    "",
    `当前客户租户：${tenant.name}`,
    `客户工作区：${tenant.workspace}`,
    `行业模板：${tenant.industryTemplate}`,
    `客户套餐：${tenant.plan}`,
    `合规规则：${tenant.complianceProfile}`,
    "",
    `当前指挥官任务：${command}`,
    `当前员工：${agent.index} ${agent.name}`,
    `员工职责：${agent.role}`,
    `当前步骤：${step.title}`,
    `步骤目标：${step.objective}`,
    `步骤输入：${step.input}`,
    previousContext ? `上游员工结果：\n${previousContext}` : "上游员工结果：暂无",
    "",
    "输出要求：",
    "1. 使用中文。",
    "2. 输出可直接放进 SaaS 控制台的结果。",
    "3. 不要输出 Markdown 表格。",
    "4. 使用短段落或编号列表。",
    "5. 如果涉及对外触达话术，必须写清楚“仅作教学，不构成投资建议”。",
  ].join("\n");
}

export async function buildWorkflowWithAgentRunner(
  command: string,
  tenantId?: string,
): Promise<WorkflowRun> {
  const tenant = getTenantById(tenantId);
  const workflow = createWorkflow(command);
  const completedSteps: WorkflowStep[] = [];
  let hasOpenAIOutput = false;
  const errors: string[] = [];
  let model = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-sol";

  for (const step of workflow.steps) {
    const agent = agentById[step.agentId];

    if (step.agentId === "compliance") {
      const complianceStep = runComplianceForStep(
        { ...step, status: "waiting" },
        completedSteps,
      );
      completedSteps.push(complianceStep);
      continue;
    }

    const result = await generateWithModelGateway(
      buildAgentPrompt(agent, workflow.command, step, completedSteps, tenant),
      { tenantId: tenant.id, taskKind: step.agentId },
    );
    model = result.model;

    const output = result.ok ? result.text : step.output;
    if (result.ok) {
      hasOpenAIOutput = true;
    } else {
      errors.push(`${agent.name}: ${result.error}`);
    }

    completedSteps.push({
      ...step,
      output,
      status: "waiting",
    });
  }

  return {
    ...workflow,
    tenantId: tenant.id,
    tenantName: tenant.name,
    steps: completedSteps,
    executionMode: hasOpenAIOutput ? "openai" : "mock",
    model,
    runLog:
      errors.length > 0
        ? [
            `当前租户：${tenant.name}（${tenant.workspace}）`,
            "模型网关未完整可用，已自动回退到本地 mock 输出。",
            ...errors.slice(0, 4),
          ]
        : [`当前租户：${tenant.name}（${tenant.workspace}）`, "模型网关已生成本次流程输出。"],
  };
}
