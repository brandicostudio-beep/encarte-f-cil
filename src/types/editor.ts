export type TargetElementType =
  | "box"
  | "name"
  | "header"
  | "price"
  | "image"
  | "validity"
  | "stock"
  | "footer";

export interface SelectedTarget {
  productId: string;
  element: TargetElementType;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export type TransformHandle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "rot";

export interface GuideLine {
  id: string;
  orientation: "horizontal" | "vertical";
  position: number; // Em pixels do canvas 1080x1920
}

export interface SmartGuide {
  orientation: "horizontal" | "vertical";
  position: number; // Em pixels do canvas 1080x1920
  start: number;
  end: number;
  label?: string;
}

export type ChangeScope = "product" | "page" | "all" | "text_type";

export interface StylePreset {
  id: string;
  name: string;
  elementType: TargetElementType;
  style: Record<string, any>;
  createdAt: string;
}

export interface PreflightIssue {
  id: string;
  type: "text_overflow" | "font_below_min" | "missing_photo" | "empty_price" | "out_of_bounds";
  title: string;
  description: string;
  page: number;
  productId?: string;
  canAutoFix?: boolean;
}

export interface LayerItem {
  id: string;
  label: string;
  type: "product" | TargetElementType;
  productId?: string;
  isVisible: boolean;
  isLocked: boolean;
  isExpanded?: boolean;
  children?: LayerItem[];
}
