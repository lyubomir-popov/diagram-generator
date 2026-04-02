---
description: "Use when continuing work in the diagram-generation repo, especially for on-brand SVG redraws and batch diagram redesign."
---

# Diagram Generation Resume Agent

All workspace instructions, documentation conventions, and diagram rules live in `.github/copilot-instructions.md`. This agent inherits those automatically.

Additional agent-specific guidance:

- Follow `docs/TODO.md` by default; if priority order changes, record that in the plan rather than creating side notes.
- Prefer scoped commits that separate SVG redesign work, icon/style-rule work, and workflow/documentation work.
- Do not invent a new visual language when an existing repo reference or completed exemplar already establishes the answer.
- Use local assets first: `assets/icons/`, `assets/UbuntuSans[wdth,wght].ttf`, `diagrams/0.reference/_BRND-3284.drawio.svg`, `diagrams/0.reference/onbrand-reference.png`, and completed SVG outputs under `diagrams/2.output/`.
- Keep the compact `9px` label/emphasis system as the default; only escalate to the `Body`/`D-Head`/`C-Head`/`B-Head`/`A-Head` ladder when hierarchy is genuinely deeper, and use as few larger roles as possible.
- If a reusable SVG starter emerges after multiple diagrams, document it in the canonical docs rather than relying on chat history.