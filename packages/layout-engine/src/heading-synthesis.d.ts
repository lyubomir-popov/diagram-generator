/**
 * Convert frame `heading:` into synthetic __heading / __body children.
 *
 * ## Propagation contract (spec 005 WS3)
 *
 * Authored headed containers expose **one** author-facing `gap` on the parent:
 * spacing between the title row and the content stack. Do not add separate
 * header/body gap controls.
 *
 * | Field        | Authored parent | __heading | __body |
 * |--------------|-----------------|-----------|--------|
 * | gap          | title gap       | —         | derived content gap |
 * | align        | —               | —         | yes    |
 * | direction    | may become VERTICAL when parent was HORIZONTAL | — | preserves horizontal body when parent was horizontal |
 * | wrap         | parent only     | no        | **no** (not inherited) |
 * | justify      | parent only (heading vs body) | no | **no** (packed default) |
 * | fill_weight  | parent only     | no        | **no** (default 1) |
 *
 * The body stack derives gap from child composition. The authored parent
 * `gap` remains the single control for title-to-body spacing.
 */
import { Frame, type Line } from './frame-model.js';
export declare function deriveContentGap(children: Frame[], options?: {
    isRoot?: boolean;
}): number;
export declare function findSyntheticBody(frame: Frame): Frame | undefined;
export declare function applyHeadingAsChild(frame: Frame, heading: Line, options?: {
    icon?: string;
    iconFill?: string;
}): void;
//# sourceMappingURL=heading-synthesis.d.ts.map