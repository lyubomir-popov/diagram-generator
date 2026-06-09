/**
 * Catalog of ELK layered layout options exposed to preview UI and YAML meta.elk.
 * Keys match elkjs / Eclipse ELK (prefix `elk.`).
 */
export type ElkParamKind = 'number' | 'enum' | 'boolean' | 'text';
export interface ElkParamSpec {
    /** Full ELK option key, e.g. elk.spacing.nodeNode */
    key: string;
    label: string;
    group: string;
    kind: ElkParamKind;
    defaultValue: string;
    description?: string;
    min?: number;
    max?: number;
    step?: number;
    enumValues?: {
        value: string;
        label: string;
    }[];
}
/** All layered options we wire today — defaults match buildLayeredLayoutOptions(). */
export declare const ELK_LAYERED_PARAM_SPECS: ElkParamSpec[];
export declare function elkParamDefaults(): Record<string, string>;
export declare function elkParamSpecByKey(): Map<string, ElkParamSpec>;
/** Merge family defaults + YAML/session overrides into ELK layoutOptions map. */
export declare function resolveElkLayoutOptions(baseOptions: Record<string, string>, userOverrides?: Record<string, string | null | undefined>): Record<string, string>;
//# sourceMappingURL=elk-param-registry.d.ts.map