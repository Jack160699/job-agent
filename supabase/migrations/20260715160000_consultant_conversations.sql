-- Consultant conversations, message conversation linkage, and confirmed write proposals.

CREATE TABLE IF NOT EXISTS public.consultant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Career chat',
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consultant_conversations_user_updated_idx
  ON public.consultant_conversations(user_id, updated_at DESC);

ALTER TABLE public.consultant_messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.consultant_conversations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS consultant_messages_conversation_created_idx
  ON public.consultant_messages(conversation_id, created_at);

DO $$ BEGIN
  CREATE TYPE public.agent_action_proposal_status AS ENUM (
    'PENDING',
    'EXECUTED',
    'EXPIRED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.agent_action_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.consultant_conversations(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.agent_action_proposal_status NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_action_proposals_user_status_idx
  ON public.agent_action_proposals(user_id, status, expires_at);

ALTER TABLE public.consultant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_action_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consultant_conversations_owner ON public.consultant_conversations;
CREATE POLICY consultant_conversations_owner ON public.consultant_conversations
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS agent_action_proposals_owner ON public.agent_action_proposals;
CREATE POLICY agent_action_proposals_owner ON public.agent_action_proposals
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());
