/**
 * Shared leaf spatial helpers — measurement and render must agree.
 */
import { ICON_SIZE, INSET } from './tokens.js';
/** Width reserved for a right-aligned icon column (icon + inner gutter). */
export function leafIconColumnWidth(frame) {
    return frame.icon ? ICON_SIZE + INSET : 0;
}
//# sourceMappingURL=spatial.js.map