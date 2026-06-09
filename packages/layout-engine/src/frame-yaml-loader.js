/**
 * Native frame YAML → FrameDiagram (v3).
 * TypeScript source of truth for batch export; mirrors scripts/frame_loader.py.
 */
import { readFileSync } from 'node:fs';
import { compileDiagramYaml } from './diagram-author/compile.js';
function formatCompileErrors(errors, sourcePath) {
    const prefix = sourcePath ? `${sourcePath}: ` : '';
    return errors
        .map(error => `${prefix}${error.path ?? 'document'}: [${error.code}] ${error.message}`)
        .join('\n');
}
export function loadFrameYamlFromString(raw, sourcePath) {
    const result = compileDiagramYaml(raw, { sourcePath });
    if (result.raw.engine !== 'v3') {
        throw new Error(`${sourcePath ?? 'document'}: not a native frame YAML (missing engine: v3)`);
    }
    if (result.errors.length > 0) {
        throw new Error(formatCompileErrors(result.errors, sourcePath));
    }
    if (!result.frameDiagram) {
        throw new Error(`${sourcePath ?? 'document'}: compile succeeded without lowering output`);
    }
    return result.frameDiagram;
}
export function loadFrameYaml(path) {
    const raw = readFileSync(path, 'utf-8');
    return loadFrameYamlFromString(raw, path);
}
//# sourceMappingURL=frame-yaml-loader.js.map