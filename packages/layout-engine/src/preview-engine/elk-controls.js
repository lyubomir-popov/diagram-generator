import { ELK_LAYERED_PARAM_SPECS } from '@diagram-generator/graph-layout-elk';
export function elkParamToPreviewControl(spec) {
    return {
        key: spec.key,
        label: spec.label,
        group: spec.group,
        kind: spec.kind,
        defaultValue: spec.defaultValue,
        description: spec.description,
        min: spec.min,
        max: spec.max,
        step: spec.step,
        enumValues: spec.enumValues,
        persistNamespace: 'meta.elk',
    };
}
export function elkLayeredPreviewControlSpecs() {
    return ELK_LAYERED_PARAM_SPECS.map(elkParamToPreviewControl);
}
//# sourceMappingURL=elk-controls.js.map