ALTER TABLE "ForumVote"
  ADD CONSTRAINT "ForumVote_exactly_one_target_check"
  CHECK (("threadId" IS NOT NULL)::int + ("replyId" IS NOT NULL)::int = 1),
  ADD CONSTRAINT "ForumVote_value_check"
  CHECK ("value" IN (-1, 1));
