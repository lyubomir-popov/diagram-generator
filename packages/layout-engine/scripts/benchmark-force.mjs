import { distImport } from './_dist-import.mjs';

const DEFAULT_TICKS = 300;
const DEFAULT_SIZES = [10, 50, 100, 200, 500];
const SEED = 42;

function parseArgs(argv) {
  const args = { ticks: DEFAULT_TICKS, sizes: DEFAULT_SIZES };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--ticks' && argv[index + 1]) {
      args.ticks = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }
    if (arg.startsWith('--ticks=')) {
      args.ticks = Number.parseInt(arg.slice('--ticks='.length), 10);
      continue;
    }
    if (arg === '--sizes' && argv[index + 1]) {
      args.sizes = argv[index + 1].split(',').map((value) => Number.parseInt(value, 10)).filter(Number.isFinite);
      index += 1;
      continue;
    }
    if (arg.startsWith('--sizes=')) {
      args.sizes = arg.slice('--sizes='.length).split(',').map((value) => Number.parseInt(value, 10)).filter(Number.isFinite);
    }
  }
  args.ticks = Number.isFinite(args.ticks) && args.ticks > 0 ? args.ticks : DEFAULT_TICKS;
  args.sizes = Array.isArray(args.sizes) && args.sizes.length > 0 ? args.sizes : DEFAULT_SIZES;
  return args;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomChoice(rng, values) {
  const index = Math.floor(rng() * values.length);
  return values[index];
}

function makeGraphSpec(nodeCount, rng) {
  const nodes = [];
  for (let index = 0; index < nodeCount; index += 1) {
    nodes.push({
      id: `n${index}`,
      label: [`Node ${index}`],
      width: randomChoice(rng, [128, 160, 192]),
      height: randomChoice(rng, [48, 64, 80]),
      x: 200 + rng() * 1600,
      y: 200 + rng() * 1600,
    });
  }

  const links = [];
  for (let index = 0; index < nodeCount; index += 1) {
    const source = Math.floor(rng() * nodeCount);
    let target = Math.floor(rng() * nodeCount);
    while (target === source) {
      target = Math.floor(rng() * nodeCount);
    }
    links.push({ source: `n${source}`, target: `n${target}` });
  }

  return {
    title: `Benchmark ${nodeCount}`,
    reference_image: 'force/IMG_3229.jpg',
    canvas: { width: 2000, height: 2000 },
    render: {
      curve_handle_ratio: 0.35,
      curve_handle_min: 24,
      curve_handle_max: 72,
    },
    simulation: {
      ticks_per_frame: 1,
      max_iterations: Math.max(DEFAULT_TICKS, nodeCount),
      charge_strength: -150,
      link_distance: 100,
      collision_padding: 8,
      collision_iterations: 1,
      velocity_decay: 0.4,
      alpha_min: 0.001,
      center: [1000, 1000],
    },
    nodes,
    links,
  };
}

async function main() {
  const { createInitialForceSnapshot, tickForceSimulation } = await distImport('index.js');
  const args = parseArgs(process.argv);
  const rng = mulberry32(SEED);

  console.log(`Force runtime benchmark (TypeScript, ${args.ticks} ticks)`);
  console.log('==========================================================');
  console.log(`${'nodes'.padStart(6)} | ${'links'.padStart(6)} | ${'time (s)'.padStart(10)} | ${'ticks/s'.padStart(10)}`);
  console.log('----------------------------------------------------------');

  for (const nodeCount of args.sizes) {
    const spec = makeGraphSpec(nodeCount, rng);
    let snapshot = createInitialForceSnapshot(spec);
    const start = process.hrtime.bigint();
    for (let tick = 0; tick < args.ticks; tick += 1) {
      snapshot = tickForceSimulation(snapshot, 1);
    }
    const elapsedSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const ticksPerSecond = elapsedSeconds > 0 ? args.ticks / elapsedSeconds : Number.POSITIVE_INFINITY;
    console.log(`${String(nodeCount).padStart(6)} | ${String(spec.links.length).padStart(6)} | ${elapsedSeconds.toFixed(4).padStart(10)} | ${ticksPerSecond.toFixed(1).padStart(10)}`);
  }

  console.log('\nDone.');
}

await main();