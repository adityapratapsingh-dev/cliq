## Vercel "Git author must have access to the project" error

**Symptom:** Vercel refuses to create a deployment:
`Git author openhands-agent must have access to the project on Vercel to create deployments.`

**Root cause:** Vercel's git-author deployment gate only builds commits whose
**git author email** belongs to a Vercel account with access to the project. This
repo's owner is `adityapratapsingh-dev <pratapsinghaditya202@gmail.com>`, but the
agent's commits were authored `openhands <openhands@all-hands.dev>` (the default
per the system prompt). The owner's commits deploy fine; the agent's do not.

**Fix applied:** re-author the agent commits to the project owner's identity.
Content is untouched — verified by comparing tree hashes before/after
(`git rev-parse <ref>^{tree}`). Rewrite command that worked (note: the
`--env-filter` is evaluated by **sh, not bash**, so `source` is unavailable —
inline the logic and export POSIX-style):

```sh
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --env-filter '
if [ "$GIT_AUTHOR_EMAIL" = "openhands@all-hands.dev" ] || [ "$GIT_COMMITTER_EMAIL" = "openhands@all-hands.dev" ]; then
  export GIT_AUTHOR_NAME="adityapratapsingh-dev"
  export GIT_AUTHOR_EMAIL="pratapsinghaditya202@gmail.com"
  export GIT_COMMITTER_NAME="adityapratapsingh-dev"
  export GIT_COMMITTER_EMAIL="pratapsinghaditya202@gmail.com"
fi
' --tag-name-filter cat -- <branches>
```

**Going forward for this repo:** commit as the owner, e.g.
`git -c user.name=adityapratapsingh-dev -c user.email=pratapsinghaditya202@gmail.com commit ...`
so Vercel deploys don't fail. (Confirm this is acceptable — it attributes agent
work to the human; the alternative is the owner adding the agent identity to the
Vercel team, or disabling the git-author check.)

**Gotchas hit:**
- `git filter-branch` rewrites ALL listed branches. If `main` and a PR branch are
  listed together, they both get new SHAs; re-check ancestry afterwards.
- After rewriting, a PR branch can end up missing commits that landed on `main`,
  making the PR diff *delete* those files. Rebuild the branch on the new `main`
  instead of reusing the stale one.
- `git push --force-with-lease` fails with "stale info" right after a local
  rewrite; pass the expected remote SHA explicitly:
  `git push --force-with-lease=<branch>:<expected-remote-sha> origin <branch>`.
- Do NOT force-push `main` (default branch) without explicit approval. A safe
  alternative is to land a new owner-authored commit on top (e.g. merging the PR),
  so the deployed head commit passes the gate.

**Verify a fix:** poll the commit status —
`GET /repos/{owner}/{repo}/commits/{sha}/status` → look for the `Vercel` context
going `pending` → `success` ("Deployment has completed").

## Recurrence (PR #13, 2026-10-18) — tip-only re-author recipe
Symptom repeated on PR #13: only the newest commit was bad; the two below it
were already owner-authored. Fastest fix is amend, NOT filter-branch:
1. `git -c user.name=adityapratapsingh-dev -c user.email=pratapsinghaditya202@gmail.com commit --amend --no-edit --reset-author`
2. Confirm content unchanged: tree hash identical before/after (`git rev-parse HEAD^{tree}`).
3. This repo is a SHALLOW clone and its fetch refspec is ONLY
   `+refs/heads/main:refs/remotes/origin/main` — so `origin/<feature-branch>`
   does NOT exist locally and `--force-with-lease` cannot read it. Get the
   remote SHA via `git ls-remote origin <branch>` and pass it explicitly:
   `git push --force-with-lease=<branch>:<remote-sha> origin <branch>`.
4. Vercel goes pending -> success in ~20-40s; poll `GET /repos/{o}/{r}/commits/{sha}/status`.

Also: the agent's PRs are created as DRAFTS (GitHub shows "still a work in
progress"). To flip: `PATCH /pulls/{n}` with `{"draft":false}` did NOT work;
use GraphQL `markPullRequestReadyForReview(input:{pullRequestId:<node_id>})`.
