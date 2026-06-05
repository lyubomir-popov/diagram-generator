#!/usr/bin/env node
/** Smoke: run ELK layered on a small pipeline graph. */
import { layoutLayeredForFamily } from '../dist/index.js';

const result = await layoutLayeredForFamily('process_and_workflow', {
  id: 'pipeline',
  nodes: [
    { id: 'define', width: 192, height: 64 },
    { id: 'build', width: 192, height: 64 },
    { id: 'deploy', width: 192, height: 64 },
  ],
  edges: [
    { id: 'e1', source: 'define', target: 'build' },
    { id: 'e2', source: 'build', target: 'deploy' },
  ],
});

console.log(JSON.stringify(result, null, 2));
