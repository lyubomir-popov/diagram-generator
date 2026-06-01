# API Contract: Icon endpoint

**Endpoint**: `GET /api/icon/<name>`

## Request

| Parameter | Location | Type | Description |
|-----------|----------|------|-------------|
| `name` | Path | `string` | Icon filename (e.g. `Document.svg`) |

## Response

**Success (200)**:
- `Content-Type: image/svg+xml`
- Body: Raw SVG file content from `assets/icons/<name>`

**Not found (404)**:
- Icon file does not exist in `assets/icons/`

## Behaviour

- Serves the raw SVG file without modification (no fill recolouring)
- Fill recolouring is the client's responsibility (applied after fetch via DOM attribute patching)
- Only files directly under `assets/icons/` are served – no directory traversal (path is validated to prevent `../` escapes)

## Security

- Path traversal prevention: `name` must not contain `/`, `\`, or `..`
- Only `.svg` files served from the icons directory
