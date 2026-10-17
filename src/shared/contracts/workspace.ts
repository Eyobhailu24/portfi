import type { Project } from "@/shared/portfolio/schema";

export type ProjectSummary = Pick<Project, "id" | "name" | "template" | "revision" | "profile" | "theme"> & {
  pages: Pick<Project["pages"][number], "id" | "name" | "slug">[];
  archivedAt: string | null; trashedAt: string | null; updatedAt: string | null;
};
