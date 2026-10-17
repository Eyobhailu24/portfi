"use client";

import { createUsePuck, registerOverlayPortal, type Config, type Data } from "@puckeditor/core";
import { useEffect, useRef } from "react";
import { blockTypes, newBlock, type Block, type BlockProps, type BlockType, type PortfolioPage, type Project } from "@/shared/portfolio/schema";
import { PortfolioBlock, PortfolioChrome } from "@/shared/portfolio/components";

export type EditorBlocks = { [K in BlockType]: Omit<BlockProps, "id"> };
export type EditorData = Data<EditorBlocks>;
export const useEditor = createUsePuck<Config<EditorBlocks>>();
export const blockLabels: Record<BlockType, string> = { Hero: "Introduction", Projects: "Selected work", Text: "Text & story", Experience: "Experience", Image: "Image", Contact: "Get in touch", Education: "Education", Skills: "Skills", Testimonials: "Testimonials", Gallery: "Gallery", Links: "Buttons & links", ProjectDetail: "Project detail", Columns: "Columns" };

export function toEditorData(page: PortfolioPage): EditorData {
  return { root: { props: {} }, content: page.blocks as EditorData["content"] };
}

export function portfolioConfig(project: Project, pageSlug: string): Config<EditorBlocks> {
  const component = (type: BlockType): Config<EditorBlocks>["components"]["Hero"] => {
    const { id: _id, ...defaults } = newBlock(type).props;
    return {
    label: blockLabels[type], defaultProps: { ...defaults, ...(type === "Columns" ? { columnsContent: [] } : {}) },
    render: (props) => <EditableBlock block={{ type, props } as Block} project={project} email={project.profile.email} linkPrefix={`/preview/${project.id}`}/>,
  }; };
  const components = Object.fromEntries(blockTypes.map((type) => [type, component(type)])) as Config<EditorBlocks>["components"];
  return { components, root: { render: ({ children }) => <PortfolioChrome project={project} pageSlug={pageSlug} linkPrefix={`/preview/${project.id}`}>{children}</PortfolioChrome> } };
}

function EditableBlock({ block, project, email, linkPrefix }: { block: Block; project: Project; email: string; linkPrefix: string }) {
  const selected = useEditor((state) => state.selectedItem?.props.id === block.props.id);
  const getSelectorForId = useEditor((state) => state.getSelectorForId);
  const dispatch = useEditor((state) => state.dispatch);
  const handle = useRef<HTMLSpanElement>(null);
  const gesture = useRef<{ x: number; width: number } | null>(null);
  useEffect(() => {
    if (!handle.current) return;
    return registerOverlayPortal(handle.current, { disableDrag: true, disableDragOnFocus: true });
  }, [selected]);
  function resize(width: number) {
    const selector = getSelectorForId(block.props.id);
    if (!selector) return;
    dispatch({ type: "replace", destinationIndex: selector.index, destinationZone: selector.zone, data: { ...block, props: { ...block.props, maxWidth: Math.max(480, Math.min(1440, Math.round(width))) } } });
  }
  return <div className="editor-portfolio-section" style={{ position: "relative" }}><PortfolioBlock block={block} pages={project.pages} email={email} linkPrefix={linkPrefix}/>{selected && <span ref={handle} className="editor-section-resize" role="slider" tabIndex={0} aria-label="Resize section content width" aria-valuemin={480} aria-valuemax={1440} aria-valuenow={block.props.maxWidth} title="Drag to resize section width" style={{ position: "absolute", right: "max(20px, calc((100% - " + block.props.maxWidth + "px) / 2))", top: "35%", height: 44, width: 9, borderRadius: 5, background: "#fff", border: "1px solid #2447e8", boxShadow: "0 1px 6px #0002", cursor: "ew-resize", zIndex: 50, touchAction: "none" }} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); gesture.current = { x: event.clientX, width: block.props.maxWidth }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (gesture.current) resize(gesture.current.width + (event.clientX - gesture.current.x) * 2); }} onPointerUp={(event) => { gesture.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { gesture.current = null; }} onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); resize(block.props.maxWidth + (event.key === "ArrowLeft" ? -16 : 16)); } }}/>}</div>;
}
