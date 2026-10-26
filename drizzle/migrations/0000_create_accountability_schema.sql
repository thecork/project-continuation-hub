/*
# Create Accountability Engine core schema

1. Purpose
   Stores de-spun news stories, their cross-referenced source articles,
   extracted entities (the knowledge-graph nodes), relationships between
   entities (the graph edges), and tagged entities per story. The schema
   models a property-graph in Postgres using a nodes table + an edges table.

2. New Tables
   - `stories`: a news story that has been processed by the de-spun pipeline.
     Holds the objective summary, left/center/right bias breakdown, and status.
   - `sources`: individual source articles related to a story (URL, outlet,
     outlet lean, extracted content, retrieved_at).
   - `entities`: graph nodes — politicians, companies, people, legislation, etc.
     `type` discriminates the kind; `properties` stores type-specific fields.
   - `entity_edges`: graph edges between two entities with a typed relationship
     and JSONB properties (amount, date, etc.).
   - `story_entities`: join table tagging which entities appear in which story,
     with an optional context note.

3. Security
   - The public site is read-only: `anon` and `authenticated` may SELECT every
     row (all content is intentionally public, no per-user ownership), and
     nothing else.
   - All writes (story creation, pipeline output, relationship editing) run in
     server-side code with the service role, which bypasses RLS.
   - RLS is enabled on every table; INSERT/UPDATE/DELETE policies are simply
     never created, so no browser role can modify data.
*/

-- ============================================================
-- stories
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text NOT NULL,
  title text NOT NULL DEFAULT '',
  objective_summary text NOT NULL DEFAULT '',
  bias_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  -- pending | processing | complete | failed
  error_message text,
  raw_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

GRANT SELECT ON public.stories TO anon, authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stories_public_read" ON public.stories;
CREATE POLICY "stories_public_read" ON public.stories FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================================
-- sources
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  url text NOT NULL,
  outlet text NOT NULL DEFAULT '',
  outlet_lean text NOT NULL DEFAULT 'center',
  -- left | center | right | unknown
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  retrieved_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sources TO anon, authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sources_public_read" ON public.sources;
CREATE POLICY "sources_public_read" ON public.sources FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================================
-- entities  (graph nodes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  -- corporation | politician | person | superpac | legislation | agency | other
  name text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.entities TO anon, authenticated;
GRANT ALL ON public.entities TO service_role;
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entities_public_read" ON public.entities;
CREATE POLICY "entities_public_read" ON public.entities FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================================
-- entity_edges  (graph edges)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.entity_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  type text NOT NULL,
  -- funds | voted_on | lobbied_for | employs | owns | associated_with | mentioned_with
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_edge CHECK (source_id <> target_id),
  CONSTRAINT unique_edge UNIQUE (source_id, target_id, type)
);

GRANT SELECT ON public.entity_edges TO anon, authenticated;
GRANT ALL ON public.entity_edges TO service_role;
ALTER TABLE public.entity_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entity_edges_public_read" ON public.entity_edges;
CREATE POLICY "entity_edges_public_read" ON public.entity_edges FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================================
-- story_entities  (tag which entities appear in which story)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.story_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  context text NOT NULL DEFAULT '',
  UNIQUE (story_id, entity_id)
);

GRANT SELECT ON public.story_entities TO anon, authenticated;
GRANT ALL ON public.story_entities TO service_role;
ALTER TABLE public.story_entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "story_entities_public_read" ON public.story_entities;
CREATE POLICY "story_entities_public_read" ON public.story_entities FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sources_story_id ON public.sources(story_id);
CREATE INDEX IF NOT EXISTS idx_story_entities_story_id ON public.story_entities(story_id);
CREATE INDEX IF NOT EXISTS idx_story_entities_entity_id ON public.story_entities(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_edges_source_id ON public.entity_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_entity_edges_target_id ON public.entity_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON public.entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_name ON public.entities(name);
CREATE INDEX IF NOT EXISTS idx_stories_status ON public.stories(status);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON public.stories(created_at DESC);
