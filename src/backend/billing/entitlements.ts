import { HTTPException } from "hono/http-exception";
import { plans } from "@/shared/plans/plans";
import type { Project } from "@/shared/portfolio/schema";
import type { OwnerContext, PlanId } from "@/backend/services/workspace-store";

export function entitlements(context: OwnerContext, now = Date.now()) {
  const { user, state } = context;
  const paid = state.subscription && ["active", "trialing"].includes(state.subscription.status) && Date.parse(state.subscription.accessUntil) > now ? state.subscription.plan : null;
  const trial = state.trial && Date.parse(state.trial.endsAt) > now;
  const id: PlanId = user.mode === "guest" ? "pro" : paid || (trial ? "creator" : "free");
  const plan = plans.find((item) => item.id === id)!;
  return { ...plan, portfolios: user.mode === "guest" ? 10 : plan.portfolios, source: user.mode === "guest" ? "preview" : paid ? "subscription" : trial ? "trial" : "free", trialEndsAt: state.trial?.endsAt || null, advanced: id !== "free", library: id === "pro", historyLimit: id === "free" ? 1 : user.mode === "guest" ? 30 : 200 };
}

export function activeProjectCount(context: OwnerContext, ids: string[]) {
  return ids.filter((id) => !context.state.metadata[id]?.archivedAt && !context.state.metadata[id]?.trashedAt).length;
}
export function reserveProject(context: OwnerContext, ids: string[]) {
  const plan = entitlements(context);
  if (activeProjectCount(context, ids) >= plan.portfolios) throw new HTTPException(403, { message: `${plan.source === "preview" ? "The local preview" : plan.name} supports ${plan.portfolios} active portfolios. Archive a portfolio to make room, or upgrade.` });
}
export function checkDocument(context: OwnerContext, next: Project, previous?: Project, strict = false) {
  const plan = entitlements(context);
  if (next.pages.length > plan.pages && (strict || next.pages.length > (previous?.pages.length || 0))) throw new HTTPException(403, { message: `${plan.name} supports ${plan.pages} pages per portfolio. Your existing work is retained; upgrade or make a compatible copy to publish it.` });
  if (strict && !plan.advanced) {
    const premium = next.template === "editorial" || next.template === "professional" || !next.theme.footerCredit || next.theme.font === "custom" || next.pages.some((page) => page.blocks.some((block) => [block.props, ...block.props.columnsContent.map((child) => child.content)].some((props) => Object.values(props.responsive).some((style) => Object.keys(style).length > 0) || props.hover !== "none" || props.delay > 0 || props.animation === "stagger")));
    if (premium) throw new HTTPException(403, { message: "This portfolio uses Creator features. Upgrade or make a Free-compatible copy before exporting or publishing. Your original stays saved." });
  }
  if (strict && plan.id !== "pro" && next.pages.some((page) => page.blocks.some((block) => [block.props, ...block.props.columnsContent.map((child) => child.content)].some((props) => props.hover !== "none")))) throw new HTTPException(403, { message: "Hover motion presets require Pro. Your design stays saved; choose None or upgrade before publishing." });
}
