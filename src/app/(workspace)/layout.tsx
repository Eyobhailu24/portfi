import type { ReactNode } from "react";
import { QueryProvider } from "@/workspace/query/provider";
import "@/shared/portfolio/portfolio.css";
import "@/workspace/workspace.css";
import "@/workspace/workspace-features.css";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
