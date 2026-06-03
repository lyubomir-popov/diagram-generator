# Tasks: Spec 013 – TS preview API

- [x] T010 `grid-info.ts`, `component-tree.ts`, `frame-serialize.ts`
- [x] T011 Unit tests for grid info + component tree
- [x] T020 `emit-frame-diagram-json.mjs`, `layout-frame-diagram.mjs`
- [x] T030 Wire `preview_server.py` frame-tree, grid, tree endpoints (`preview_ts_layout.py`)
- [x] T040 Remove `_get_layout_result` from preview paths (SVG Python fallback only)
- [x] T050 Document JSON-as-transport in copilot-instructions + spec 008 pointer
- [x] T051 Delete dead Python serialization helpers when unused
- [x] T060 HTTP smoke tests `scripts/test_preview_ts_api.py`
- [x] T070 TS preview hot-reload: watch layout pool + Node CLIs + `dist/`; recreate pools on `_rebuild()`
