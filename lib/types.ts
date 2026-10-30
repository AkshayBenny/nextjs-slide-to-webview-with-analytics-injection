export type SourceFormat = "pptx" | "pdf";

export type DeckLinkOverlay = {
  slideNumber: number;
  left: number;
  top: number;
  width: number;
  height: number;
  href: string;
  kind: "external" | "internal";
  newTab: boolean;
  label: string;
};

export type DeckMetadata = {
  id: string;
  companyName: string;
  originalFileName: string;
  sourceFormat: SourceFormat;
  createdAt: string;
  sizeBytes: number;
  links: DeckLinkOverlay[];
};
