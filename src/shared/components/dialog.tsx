"use client";

import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Dialog({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (value: boolean) => void; title: string; description: string; children: ReactNode }) {
  return <Primitive.Root open={open} onOpenChange={onOpenChange}><Primitive.Portal><Primitive.Overlay className="dialog-overlay"/><Primitive.Content className="dialog-content"><Primitive.Title className="dialog-title">{title}</Primitive.Title><Primitive.Description className="dialog-description">{description}</Primitive.Description><Primitive.Close className="dialog-close icon-button" aria-label="Close dialog"><X size={18}/></Primitive.Close>{children}</Primitive.Content></Primitive.Portal></Primitive.Root>;
}
