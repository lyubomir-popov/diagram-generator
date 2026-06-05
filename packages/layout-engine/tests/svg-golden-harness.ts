import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectIconNames,
  createFsIconLoader,
  preloadIconMarkup,
} from '../src/icon-embed.js';
import { loadFrameYaml } from '../src/frame-yaml-loader.js';
import { layoutFrameTree } from '../src/layout.js';
import { HarfBuzzTextAdapter } from '../src/harfbuzz-text-adapter.js';
import { renderFrameDiagramToSvg } from '../src/svg-render.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
export const REPO_ROOT = join(__dirname, '../../..');
export const FRAMES_DIR = join(REPO_ROOT, 'scripts/diagrams/frames');
export const ICONS_DIR = join(REPO_ROOT, 'assets/icons');
export const SVG_GOLDEN_DIR = join(__dirname, 'fixtures/svg');

export interface SvgGoldenCase {
  slug: string;
  /** Structural markers checked before full golden compare. */
  markers: {
    hasIcon?: boolean;
    hasArrow?: boolean;
    hasHighlight?: boolean;
    hasHeading?: boolean;
  };
}

export const SVG_GOLDEN_CASES: SvgGoldenCase[] = [
  { slug: 'test-nested-containers', markers: { hasHeading: true, hasIcon: true } },
  { slug: 'test-box-styles', markers: { hasHighlight: true, hasIcon: true } },
  { slug: 'example-platform-architecture', markers: { hasArrow: true, hasHeading: true, hasIcon: true } },
];

let adapterPromise: Promise<HarfBuzzTextAdapter> | null = null;

export function getHarfBuzzAdapter(): Promise<HarfBuzzTextAdapter> {
  if (!adapterPromise) {
    adapterPromise = (async () => {
      const fontPath = join(REPO_ROOT, 'assets/UbuntuSans[wdth,wght].ttf');
      const fontBuffer = readFileSync(fontPath);
      const fontData = fontBuffer.buffer.slice(
        fontBuffer.byteOffset,
        fontBuffer.byteOffset + fontBuffer.byteLength,
      );
      return new HarfBuzzTextAdapter({ fontData });
    })();
  }
  return adapterPromise;
}

/** Normalize SVG text for stable golden comparison across platforms. */
export function normalizeSvg(svg: string): string {
  return svg.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

export async function renderSlugToSvg(slug: string): Promise<string> {
  const yamlPath = join(FRAMES_DIR, `${slug}.yaml`);
  const adapter = await getHarfBuzzAdapter();
  const diagram = loadFrameYaml(yamlPath);
  const result = layoutFrameTree(diagram.root, adapter, {
    gridCols: diagram.gridCols,
    gridColGap: diagram.gridColGap,
    gridRowGap: diagram.gridRowGap,
    gridOuterMargin: diagram.gridOuterMargin,
  });
  const iconLoader = createFsIconLoader(ICONS_DIR);
  const iconMarkupByName = preloadIconMarkup(iconLoader, collectIconNames(diagram.root));
  return renderFrameDiagramToSvg(diagram, result, adapter, { iconMarkupByName });
}

export function assertSvgMarkers(svg: string, markers: SvgGoldenCase['markers']): void {
  if (markers.hasIcon) {
    if (!svg.includes('class="dg-icon"')) {
      throw new Error('expected embedded icon markup (class="dg-icon")');
    }
  }
  if (markers.hasArrow) {
    if (!svg.includes('<polygon') || !svg.includes('#E95420')) {
      throw new Error('expected orange arrowhead polygon');
    }
  }
  if (markers.hasHighlight) {
    if (!svg.includes('data-component-id="highlight_leaf"')) {
      throw new Error('expected highlight_leaf frame in output');
    }
  }
  if (markers.hasHeading) {
    if (!svg.includes('__heading')) {
      throw new Error('expected synthetic __heading frame in output');
    }
  }
}
