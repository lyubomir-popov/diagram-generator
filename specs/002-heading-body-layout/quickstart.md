# Quickstart: heading + body layout region

## Prerequisites

- Python 3.11+ with the project's `.venv` activated
- Feature branch `feat/002-heading-body-layout` checked out
- Feature 001 (box style contract) merged into the base branch

## Verify the fix

### 1. Run the targeted test suite

```bash
cd scripts
python -m pytest test_frame_loader.py test_layout_v3.py -q
```

### 2. Run full regression suite

```bash
python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q
```

### 3. Visual verification

Start the preview server and check the key diagrams:

```bash
python scripts/preview_server.py
```

Open in browser:
- `http://127.0.0.1:8100/view/v3:request-to-hardware-stack` – headings top-left, children below
- `http://127.0.0.1:8100/view/v3:android-security-comparison` – "Containerized Android" / "Virtualized Android" headings top-left
- `http://127.0.0.1:8100/view/v3:maas-architecture` – all panel headings top-left

### 4. Verify no heading/child overlap

For each headed container in the above diagrams, confirm:
- Heading text starts at top-left (inside padding)
- Icon (if present) is at top-right (inside padding)
- First child box starts below the heading zone
- No visual overlap between heading and children

## Key files

| File | What to check |
|------|--------------|
| `scripts/frame_loader.py` | `_parse_frame()` – `__body` creation copies `wrap`, `justify`, `fill_weight` |
| `scripts/test_frame_loader.py` | New tests for field inheritance |
| `scripts/test_layout_v3.py` | New tests for heading zone placement |
