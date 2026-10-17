import { EditorLauncher } from "@/workspace/editor/launcher";
import { templateMeta } from "@/shared/portfolio/schema";

export const metadata = { title: "A fresh start" };
export default async function Page({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template } = await searchParams;
  const selected = templateMeta.find((item) => item.id === template)?.id || "studio";
  return <EditorLauncher template={selected}/>;
}
