export type StoryStatus = "pending" | "processing" | "complete" | "failed";

export type EntityType =
  | "corporation"
  | "politician"
  | "person"
  | "superpac"
  | "legislation"
  | "agency"
  | "other";

export type OutletLean = "left" | "center" | "right" | "unknown";

export interface BiasEntry {
  summary: string;
  sources?: string[];
}

export interface BiasBreakdown {
  left?: BiasEntry;
  center?: BiasEntry;
  right?: BiasEntry;
}

export interface Story {
  id: string;
  source_url: string;
  title: string;
  objective_summary: string;
  bias_summary: BiasBreakdown;
  status: StoryStatus;
  error_message: string | null;
  raw_text: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface Source {
  id: string;
  story_id: string;
  url: string;
  outlet: string;
  outlet_lean: OutletLean;
  title: string;
  content: string;
  retrieved_at: string;
}

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  subtitle: string;
  properties: Record<string, unknown>;
  created_at: string;
}

export interface EntityEdge {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  properties: Record<string, unknown>;
  created_at: string;
}

export interface StoryEntity {
  id: string;
  story_id: string;
  entity_id: string;
  context: string;
  entity?: Entity;
}

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  corporation: "Corporation",
  politician: "Politician",
  person: "Person",
  superpac: "Super PAC",
  legislation: "Legislation",
  agency: "Agency",
  other: "Other",
};

export const ENTITY_TYPE_COLORS: Record<EntityType, string> = {
  corporation: "#38bdf8",
  politician: "#f43f5e",
  person: "#e8b341",
  superpac: "#a78bfa",
  legislation: "#34d399",
  agency: "#fb923c",
  other: "#818a94",
};

export const ENTITY_TYPES: EntityType[] = [
  "corporation",
  "politician",
  "person",
  "superpac",
  "legislation",
  "agency",
  "other",
];

export const EDGE_TYPES = [
  "funds",
  "voted_on",
  "lobbied_for",
  "employs",
  "owns",
  "associated_with",
  "mentioned_with",
] as const;

export const EDGE_LABELS: Record<string, string> = {
  funds: "funds",
  voted_on: "voted on",
  lobbied_for: "lobbied for",
  employs: "employs",
  owns: "owns",
  associated_with: "associated with",
  mentioned_with: "co-mentioned",
};
