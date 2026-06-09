/**
 * Component tree for preview sidebar — port of layout_v3._build_component_tree.
 */
import { Frame } from './frame-model.js';
export interface ComponentInfo {
    id: string;
    type: 'panel' | 'box';
    x: number;
    y: number;
    width: number;
    height: number;
    children: ComponentInfo[];
    layout: string;
    layout_gap: number;
    layout_col_gap: number;
    layout_row_gap: number;
    layout_header_gap: number;
    pad: number;
    sizing_w: string;
    sizing_h: string;
    fill_weight: number;
    align: string;
    wrap: boolean;
    padding_top: number;
    padding_right: number;
    padding_bottom: number;
    padding_left: number;
    level: number | null;
    fill: string;
    border: string;
    heading_text: string;
    label_text: string[];
    min_width?: number;
    max_width?: number;
    max_width_chars?: number;
    min_height?: number;
    max_height?: number;
}
export declare function buildComponentTree(root: Frame): ComponentInfo[];
//# sourceMappingURL=component-tree.d.ts.map