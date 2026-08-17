#!/usr/bin/env node
import { millisecondsUntilPublishTarget } from './lib/publish-window.mjs';

const targetIso = process.argv[2] || '';
const waitMs = millisecondsUntilPublishTarget(targetIso);
if (waitMs > 0) {
  console.log(`Waiting ${Math.ceil(waitMs / 1000)}s for publish target ${targetIso}`);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
}
console.log(`Publish target reached: ${targetIso || 'immediate'}`);
