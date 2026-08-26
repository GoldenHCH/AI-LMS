import 'server-only'

import { changeProposalSchema, type ChangeProposal } from '@/lib/agent/proposal'
import { createAdminClient } from '@/lib/supabase/admin'

export type ProposalStatus = 'proposed' | 'accepted' | 'rejected'

export type ChangeProposalRecord = {
  id: string
  itemId: string
  kind: 'page' | 'quiz'
  proposedState: ChangeProposal
  rationale: string
  status: ProposalStatus
  isSensitive: boolean
}

export type ChangeBatch = {
  id: string
  courseId: string
  requestText: string
  createdAt: string
  proposals: ChangeProposalRecord[]
}

export type ProposalToPersist = {
  proposal: ChangeProposal
  isSensitive: boolean
}

// Callers must have already dropped anything computeProposalDiff() rejected
// (unknown item/question/answer IDs, read-only or New Quiz content) — a bad
// item_id reaching this function fails the whole insert via the foreign key,
// which is a bug in the caller, not an expected path.
export async function createChangeBatch(
  courseId: string,
  workspaceId: string,
  requestText: string,
  proposals: ProposalToPersist[],
): Promise<ChangeBatch | null> {
  const supabase = createAdminClient()
  const accessible = await courseIsAccessible(supabase, courseId, workspaceId)
  if (!accessible) return null

  const { data: batch, error: batchError } = await supabase
    .from('change_batches')
    .insert({ course_id: courseId, request_text: requestText })
    .select('id, course_id, request_text, created_at')
    .single()
  if (batchError || !batch) {
    throw new Error('Could not create change batch')
  }

  const { data: proposalRows, error: proposalError } = await supabase
    .from('change_proposals')
    .insert(
      proposals.map(({ proposal, isSensitive }) => ({
        batch_id: batch.id,
        item_id: proposal.itemId,
        kind: proposal.kind,
        proposed_state: proposal,
        rationale: proposal.rationale,
        is_sensitive: isSensitive,
      })),
    )
    .select('id, item_id, kind, proposed_state, rationale, status, is_sensitive')
  if (proposalError || !proposalRows) {
    await supabase.from('change_batches').delete().eq('id', batch.id)
    throw new Error('Could not persist proposed changes')
  }

  return {
    id: batch.id,
    courseId: batch.course_id,
    requestText: batch.request_text,
    createdAt: batch.created_at,
    proposals: proposalRows.map(mapProposalRow),
  }
}

export async function getChangeBatch(
  batchId: string,
  courseId: string,
  workspaceId: string,
): Promise<ChangeBatch | null> {
  const supabase = createAdminClient()
  const accessible = await courseIsAccessible(supabase, courseId, workspaceId)
  if (!accessible) return null

  const { data: batch, error: batchError } = await supabase
    .from('change_batches')
    .select('id, course_id, request_text, created_at')
    .eq('id', batchId)
    .eq('course_id', courseId)
    .maybeSingle()
  if (batchError) throw new Error('Could not load change batch')
  if (!batch) return null

  const { data: proposalRows, error: proposalError } = await supabase
    .from('change_proposals')
    .select('id, item_id, kind, proposed_state, rationale, status, is_sensitive')
    .eq('batch_id', batchId)
  if (proposalError) throw new Error('Could not load proposed changes')

  return {
    id: batch.id,
    courseId: batch.course_id,
    requestText: batch.request_text,
    createdAt: batch.created_at,
    proposals: (proposalRows ?? []).map(mapProposalRow),
  }
}

export type AcceptResult = {
  proposalId: string
  accepted: boolean
  reason: 'not_proposed' | null
}

// Applies the whitelisted field patch onto the stored lossless model via the
// accept_change_proposals RPC (the only way to get real multi-statement
// transactional semantics through PostgREST) — never writes CourseItem-
// shaped data over stored rows. Works for both a single accept and
// accept-all: the caller decides which IDs are eligible (e.g. excluding
// sensitive proposals for accept-all) and passes them in already filtered.
export async function acceptProposals(
  proposalIds: string[],
  batchId: string,
  courseId: string,
  workspaceId: string,
): Promise<AcceptResult[] | null> {
  if (proposalIds.length === 0) return []

  const supabase = createAdminClient()
  const accessible = await courseIsAccessible(supabase, courseId, workspaceId)
  if (!accessible) return null

  const batchExists = await batchBelongsToCourse(supabase, batchId, courseId)
  if (!batchExists) return null

  // Scope to proposals that actually belong to this batch before invoking
  // the RPC — the function itself trusts whatever IDs it's given.
  const { data: batchProposals, error: fetchError } = await supabase
    .from('change_proposals')
    .select('id')
    .eq('batch_id', batchId)
    .in('id', proposalIds)
  if (fetchError) throw new Error('Could not verify proposals')
  const scopedIds = (batchProposals ?? []).map((row) => row.id)
  if (scopedIds.length === 0) return []

  const { data, error } = await supabase.rpc('accept_change_proposals', {
    p_proposal_ids: scopedIds,
  })
  if (error) throw new Error('Could not accept proposals')

  return (data ?? []).map((row) => ({
    proposalId: row.proposal_id,
    accepted: row.accepted,
    reason: (row.reason as 'not_proposed' | null) ?? null,
  }))
}

export type RejectResult = 'rejected' | 'not_proposed'

// Reject has no side effects beyond the status column, so a single
// conditional UPDATE gives the same proposed-state re-check (T3) as the
// accept RPC without needing a transaction.
export async function rejectProposal(
  proposalId: string,
  batchId: string,
  courseId: string,
  workspaceId: string,
): Promise<RejectResult | null> {
  const supabase = createAdminClient()
  const accessible = await courseIsAccessible(supabase, courseId, workspaceId)
  if (!accessible) return null

  const batchExists = await batchBelongsToCourse(supabase, batchId, courseId)
  if (!batchExists) return null

  const { data, error } = await supabase
    .from('change_proposals')
    .update({ status: 'rejected' })
    .eq('id', proposalId)
    .eq('batch_id', batchId)
    .eq('status', 'proposed')
    .select('id')
  if (error) throw new Error('Could not reject proposal')

  return data && data.length > 0 ? 'rejected' : 'not_proposed'
}

async function batchBelongsToCourse(
  supabase: ReturnType<typeof createAdminClient>,
  batchId: string,
  courseId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('change_batches')
    .select('id')
    .eq('id', batchId)
    .eq('course_id', courseId)
    .maybeSingle()
  if (error) throw new Error('Could not verify batch')
  return data !== null
}

type ProposalRow = {
  id: string
  item_id: string
  kind: string
  proposed_state: unknown
  rationale: string
  status: string
  is_sensitive: boolean
}

function mapProposalRow(row: ProposalRow): ChangeProposalRecord {
  return {
    id: row.id,
    itemId: row.item_id,
    kind: row.kind === 'quiz' ? 'quiz' : 'page',
    proposedState: changeProposalSchema.parse(row.proposed_state),
    rationale: row.rationale,
    status: isProposalStatus(row.status) ? row.status : 'proposed',
    isSensitive: row.is_sensitive,
  }
}

function isProposalStatus(value: string): value is ProposalStatus {
  return value === 'proposed' || value === 'accepted' || value === 'rejected'
}

async function courseIsAccessible(
  supabase: ReturnType<typeof createAdminClient>,
  courseId: string,
  workspaceId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .eq('workspace_id', workspaceId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error) throw new Error('Could not verify course access')
  return data !== null
}
