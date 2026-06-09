import { parse as parseYaml } from 'yaml';
export function parseYamlDocument(raw, _options = {}) {
    const parsed = parseYaml(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Diagram authoring document must be a YAML mapping.');
    }
    return parsed;
}
//# sourceMappingURL=parse-yaml.js.map