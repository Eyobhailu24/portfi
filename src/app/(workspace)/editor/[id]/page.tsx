import { EditorApp } from "@/workspace/editor/editor";

export const metadata = { title: "Make it yours" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <EditorApp id={(await params).id}/>;
}
