import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Entity,
  EntityEdge,
  Source,
  Story,
  StoryEntity,
} from "./types";

const ACTIVE: Story["status"][] = ["pending", "processing"];

const isBusy = (status: Story["status"] | undefined) =>
  status === "pending" || status === "processing";

export function storiesQueryOptions() {
  return queryOptions({
    queryKey: ["stories"],
    queryFn: async (): Promise<Story[]> => {
      const { data, error } = await supabase
        .from("stories")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data as unknown as Story[]) ?? [];
    },
    refetchInterval: (query) =>
      (query.state.data as Story[] | undefined)?.some((s) => isBusy(s.status))
        ? 4000
        : false,
  });
}

export interface StoryDetail {
  story: Story | null;
  sources: Source[];
  storyEntities: StoryEntity[];
  edges: EntityEdge[];
}

export function storyQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["story", id],
    queryFn: async (): Promise<StoryDetail> => {
      const [storyRes, sourcesRes, seRes] = await Promise.all([
        supabase.from("stories").select("*").eq("id", id).maybeSingle(),
        supabase.from("sources").select("*").eq("story_id", id),
        supabase
          .from("story_entities")
          .select("*, entity:entities(*)")
          .eq("story_id", id),
      ]);

      if (storyRes.error) throw new Error(storyRes.error.message);

      const story = (storyRes.data as unknown as Story) ?? null;
      const sources = (sourcesRes.data as unknown as Source[]) ?? [];
      const storyEntities =
        (seRes.data as unknown as (StoryEntity & { entity?: Entity })[]) ?? [];

      const entityIds = storyEntities.map((se) => se.entity_id);
      let edges: EntityEdge[] = [];
      if (entityIds.length > 1) {
        const { data: edgeData } = await supabase
          .from("entity_edges")
          .select("*")
          .in("source_id", entityIds)
          .in("target_id", entityIds);
        edges = (edgeData as unknown as EntityEdge[]) ?? [];
      }

      return { story, sources, storyEntities, edges };
    },
    refetchInterval: (query) =>
      isBusy((query.state.data as StoryDetail | undefined)?.story?.status)
        ? 4000
        : false,
  });
}

export function entitiesQueryOptions() {
  return queryOptions({
    queryKey: ["entities"],
    queryFn: async (): Promise<Entity[]> => {
      const { data, error } = await supabase
        .from("entities")
        .select("*")
        .order("name");
      if (error) throw new Error(error.message);
      return (data as unknown as Entity[]) ?? [];
    },
  });
}

export interface EntityDetail {
  entity: Entity | null;
  edges: EntityEdge[];
  connected: Entity[];
  storyLinks: (StoryEntity & { story?: Story })[];
}

export function entityQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["entity", id],
    queryFn: async (): Promise<EntityDetail> => {
      const { data: ent, error } = await supabase
        .from("entities")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const entity = (ent as unknown as Entity) ?? null;

      const [outRes, inRes, seRes] = await Promise.all([
        supabase.from("entity_edges").select("*").eq("source_id", id),
        supabase.from("entity_edges").select("*").eq("target_id", id),
        supabase
          .from("story_entities")
          .select("*, story:stories(*)")
          .eq("entity_id", id),
      ]);

      const edges = [
        ...((outRes.data as unknown as EntityEdge[]) ?? []),
        ...((inRes.data as unknown as EntityEdge[]) ?? []),
      ];

      const connectedIds = new Set<string>();
      edges.forEach((e) => {
        connectedIds.add(e.source_id === id ? e.target_id : e.source_id);
      });

      let connected: Entity[] = [];
      if (connectedIds.size > 0) {
        const { data } = await supabase
          .from("entities")
          .select("*")
          .in("id", Array.from(connectedIds));
        connected = (data as unknown as Entity[]) ?? [];
      }

      return {
        entity,
        edges,
        connected,
        storyLinks:
          (seRes.data as unknown as (StoryEntity & { story?: Story })[]) ?? [],
      };
    },
  });
}
