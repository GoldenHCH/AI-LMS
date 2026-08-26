-- Accept applies a whitelisted field patch onto the stored lossless model
-- (never writes CourseItem-shaped data over stored rows), wrapped in one
-- transaction so accept-all is all-or-nothing (E5). A plpgsql function is
-- the only way to get real multi-statement transactional semantics through
-- PostgREST/supabase-js, which has no client-side transaction API.
--
-- Server-side proposed-state re-check (T3): a proposal not currently in
-- 'proposed' state is skipped and reported back, not silently applied —
-- protects against multi-tab/direct-API races on top of the UI lock.
--
-- `for update` locks the targeted change_proposals rows for the duration of
-- the transaction, so two concurrent accept calls on the same proposal can't
-- both win.
create or replace function public.accept_change_proposals(p_proposal_ids uuid[])
returns table (proposal_id uuid, accepted boolean, reason text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  rec record;
  question jsonb;
  answer jsonb;
  v_quiz_id uuid;
begin
  for rec in
    select cp.id, cp.item_id, cp.kind, cp.proposed_state, cp.status
    from public.change_proposals cp
    where cp.id = any(p_proposal_ids)
    for update
  loop
    if rec.status <> 'proposed' then
      proposal_id := rec.id;
      accepted := false;
      reason := 'not_proposed';
      return next;
      continue;
    end if;

    if rec.kind = 'page' then
      update public.pages
        set body_html = case
          when rec.proposed_state ? 'bodyHtml' then rec.proposed_state->>'bodyHtml'
          else body_html
        end
        where module_item_id = rec.item_id;
    else
      select id into v_quiz_id from public.quizzes where module_item_id = rec.item_id;

      for question in select * from jsonb_array_elements(rec.proposed_state->'questions')
      loop
        if (question->>'remove')::boolean is true then
          delete from public.quiz_questions
            where id = (question->>'questionId')::uuid and quiz_id = v_quiz_id;
          continue;
        end if;

        update public.quiz_questions
          set
            stem_html = case
              when question ? 'stemHtml' then question->>'stemHtml'
              else stem_html
            end,
            points_possible = case
              when question ? 'pointsPossible' then (question->>'pointsPossible')::numeric
              else points_possible
            end
          where id = (question->>'questionId')::uuid and quiz_id = v_quiz_id;

        for answer in select * from jsonb_array_elements(coalesce(question->'answers', '[]'::jsonb))
        loop
          update public.quiz_answers
            set
              text_html = case
                when answer ? 'textHtml' then answer->>'textHtml'
                else text_html
              end,
              is_correct = case
                when answer ? 'isCorrect' then (answer->>'isCorrect')::boolean
                else is_correct
              end,
              weight = case
                when answer ? 'weight' then (answer->>'weight')::numeric
                else weight
              end
            where id = (answer->>'answerId')::uuid
              and question_id = (question->>'questionId')::uuid;
        end loop;
      end loop;

      -- Question removal changes question_count; keep the model invariant
      -- (quizzes.question_count == count(quiz_questions)) in sync.
      update public.quizzes
        set question_count = (
          select count(*) from public.quiz_questions where quiz_id = v_quiz_id
        )
        where id = v_quiz_id;
    end if;

    update public.change_proposals set status = 'accepted' where id = rec.id;
    proposal_id := rec.id;
    accepted := true;
    reason := null;
    return next;
  end loop;
end;
$$;

revoke all on function public.accept_change_proposals(uuid[]) from anon, authenticated;
