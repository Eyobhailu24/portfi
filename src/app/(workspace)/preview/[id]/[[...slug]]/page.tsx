import { PortfolioPreview } from "@/workspace/portfolios/preview";

export const metadata = { title: "Portfolio preview", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string; slug?: string[] }> }) {
  const { id, slug } = await params;
  return <PortfolioPreview id={id} slug={slug?.join("/") || ""}/>;
}
