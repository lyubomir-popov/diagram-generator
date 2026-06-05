# Agent Inbox

Machine-generated handoffs, long diagnostics, and cross-repo follow-up notes go here.

Do not use this file for user notes. User-authored async notes belong in `INBOX.md`.

The agent should triage anything durable from this file into `TODO.md`, `STATUS.md`, `HISTORY.md`, or `docs/specs.md`, then empty this file back to this header template.

---

## Next session prompt — spec 025 engine contract on clean main

`main` is now the canonical integrated branch for the force runtime port and ELK preview/save work. Do **not** merge or cherry-pick the old `diagram-generator-elk` worktree branch wholesale; `main` already supersedes the stale preview/runtime overlap.

Current state:

- Force runtime restoration is complete and validated on `main`.
- ELK save/persistence is fixed and validated on `main`.
- ELK control metadata now comes only from the TS registry.
- `/api/runtime-identity` exists for worktree/server diagnosis.
- Composer ELK worktree value that still mattered has already been pulled over as QA/contract coverage.

Working demo surfaces:

- ELK preview: `python scripts/preview_server.py --port 8210` then open `/view/v3:juju-bootstrap-machines-process`
- Force preview: same server, open `/force/view/force-juju-landing-pages`

Validated checks already green on `main`:

```bash
npm --prefix packages/layout-engine run build:browser
python -m pytest scripts/test_preview_elk_layout_save.py scripts/test_frame_yaml_persistence.py scripts/test_elk_preview_qa.py scripts/test_preview_shell_bf_contract.py -q
python -m pytest scripts/test_preview_force_api.py -q
npm --prefix packages/layout-engine test -- tests/force-runtime.test.ts
python scripts/benchmark_force.py --ticks 5 --sizes 10
```

Next required work:

1. Implement **spec 025 phase 1**: define the preview-engine manifest/capability contract in the TS runtime surface.
2. Use **ELK** and **force** as the first two consumers of that contract.
3. Keep Python as preview glue only; do not reintroduce Python-side engine metadata catalogs.
4. After the engine contract lands cleanly, start **spec 026 T010**: extract save/reload orchestration out of `scripts/preview/editor.js`.

Non-goals for the next session:

- Do not resurrect package-local demo HTML under `packages/`.
- Do not merge the old ELK worktree branch directly.
- Do not start spec 022 again until spec 025 / the first spec 026 slice are underway.
