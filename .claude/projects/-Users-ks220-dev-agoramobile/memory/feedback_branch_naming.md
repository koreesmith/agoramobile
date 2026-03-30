---
name: Branch naming convention
description: Always use the Jira case name as the git branch name
type: feedback
---

Always use the Jira issue key (e.g. AMOBILE-8) as the branch name when starting work on a ticket.

**Why:** User explicitly requires it — keeps branches traceable to tickets.

**How to apply:** Before writing any code for a Jira issue, create a branch named exactly after the issue key (e.g. `git checkout -b AMOBILE-8`).
