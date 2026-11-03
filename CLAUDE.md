# Working on Jiko

## Keep status docs in step with the work
Update the status documents in the same commit as the change that alters them, not in a later cleanup pass:

- `SPRINT_<n>.md` (the current sprint): the top **Status** line and each item's marker (✅ done, 🔶 partly done, ⏭ next, ⏸ blocked on a person or third party). Give the Status line the date it was last true.
- `DECISIONS.md`: when an **Open:** note gets resolved, rewrite it as **Resolved <date>:** with what fixed it.
- `FIELD_NOTES.md`: during the five-day run, fill in the daily row and any verbatim reactions as they come in.
- Runbooks (`backend/docs/*`) and READMEs: when a command, env var or endpoint changes, fix every doc that names it. Grep for the old name before committing.

Before committing, check that no doc still describes something as pending, broken or open when the commit makes it done, or the other way round.
