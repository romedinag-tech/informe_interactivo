// Tipos del contenido estructurado de un bloque (columna `Block.content` en BD).

export type HeadingContent = { text: string; level?: 2 | 3 | 4 };
export type ParagraphContent = { text: string };
export type CalloutContent = { text: string; tone?: "info" | "warn" | "note" };
export type ImageContent = { src: string; alt: string; caption?: string };

export type TableContent = {
  columns: string[];
  rows: (string | number)[][];
  caption?: string;
};

export type ChartContent = {
  kind: "bar" | "line" | "area";
  data: Record<string, string | number>[];
  xKey: string;
  series: { key: string; label: string; color?: string }[];
  caption?: string;
};

export type BlockContent =
  | HeadingContent
  | ParagraphContent
  | CalloutContent
  | ImageContent
  | TableContent
  | ChartContent;

// Forma serializada de un bloque para el visor (lo que consume el cliente).
export type ViewBlock = {
  id: string;
  anchorKey: string;
  type: "HEADING" | "PARAGRAPH" | "TABLE" | "CHART" | "IMAGE" | "CALLOUT";
  content: BlockContent;
  annotationCount: number;
};

export type ViewSection = {
  id: string;
  title: string | null;
  collapsedByDefault?: boolean;
  blocks: ViewBlock[];
};

export type ViewChapter = {
  id: string;
  number: string | null;
  title: string;
  sections: ViewSection[];
};
