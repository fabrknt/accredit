# AGENTS.md — accredit/contracts-evm two-agent operating contract

This subproject is built by **two agents that cross-review each other**: Claude Code
(CC) and Codex. The repo — not chat memory — is the only shared memory. Every handoff
is a committed artifact (task brief, code, review file).

## Division of labour (by task *frame*, not by "implement vs review")

The split axis is how much **frame** a task has — goal clarity, convergence condition,
the contour of the right answer.

- **Frame thin** (exploration: vague goal, unknown state, trial-and-error) → **CC**.
  Manufactures the contour while progressing. Owns: architecture, ADRs, task briefs,
  exploratory spikes, the final "is this explainable / safe to operate?" pass.
- **Frame thick** (convergence: clear diff, fixed perspective, a converging answer) →
  **Codex**. Fast and sharp. Owns: implementing tightly-specified task briefs,
  deploy/config/installer tooling, adversarial audits and reviews.

**Cross-pass rule:** whoever implemented a change is NOT its reviewer. The other agent
reviews (same type shares blind spots). A change merges only after a review by the
other agent.

## Workflow (branch → review → merge)

1. **Brief.** CC writes a task brief in `docs/tasks/NNN-slug.md` (goal, scope,
   acceptance criteria, out-of-scope, files to touch). A brief is "frame" — make it
   thick before handing a task to Codex.
2. **Branch.** Always branch from `master`: `task/NNN-slug`. Never pile unrelated work
   onto someone else's branch. One task per branch.
3. **Implement.** The assigned agent implements ON that branch and commits.
4. **Review.** The OTHER agent reviews the branch diff and writes
   `reviews/NNN-slug.md` (verdict: APPROVE / CHANGES, prioritized P0/P1/P2 findings).
   Iterate until APPROVE.
5. **Merge.** Only an APPROVED branch merges to `master`. Do not merge your own
   un-reviewed work.

## Gates (must hold before review is requested)

- `forge build` clean.
- `forge test` green (add tests for new behaviour; security-relevant paths need a
  negative test that proves the guard).
- No secrets committed. Keys live in `.env` (gitignored); commit only `.env.example`.

## Git hygiene

- Branch from `master`; rebase onto `master` (not merge commits) to stay current.
- Commit as `psyto <saito.hiroyuki@gmail.com>`.
- This is local-only for now — do NOT `git push` to the public fabrknt/accredit remote
  unless explicitly asked.

## Running Codex (from this directory)

- Review (read-only): `codex exec -s read-only --skip-git-repo-check "<prompt>"`
- Implement on a branch (writes): `codex exec -s workspace-write "<task brief ref>"`

## Project context

EVM rebuild of accredit's on-chain compliance enforcement for the HashKey Chain
Horizon Hackathon (Tokyo, Jun 18–Jul 11 2026). Axis: compliance-enforced HSP payments
+ AI-AML transfer screening. See `README.md` for chain params and contract map.
