# API Contract: Frame-tree endpoint (overlay extension)

**Endpoint**: `GET /api/frame-tree/<slug>` (existing – extended)

## Change

Add `overlays` array to the response JSON.

## Response (extended)

```json
{
  "title": "string",
  "root": { /* Frame tree – unchanged */ },
  "arrows": [ /* Arrow[] – unchanged */ ],
  "gridCols": 2,
  "gridColGap": null,
  "gridRowGap": null,
  "gridOuterMargin": null,
  "overlays": [
    {
      "id": "string",
      "label": "string",
      "members": ["frame-id-1", "frame-id-2"]
    }
  ]
}
```

## Overlay fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique overlay identifier |
| `label` | `string` | Display label |
| `members` | `string[]` | Frame IDs in this overlay group |

## Backwards compatibility

- The `overlays` field is always present (empty array `[]` when no overlays defined)
- Existing clients that don't read `overlays` are unaffected
- The `deserializeFrameDiagram()` function in `layout-bridge.js` will be updated to parse the field
