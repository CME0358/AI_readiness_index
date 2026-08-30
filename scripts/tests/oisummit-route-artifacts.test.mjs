import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const routes = [
  "oisummit/index.html",
  "oisummit/enterprise/index.html",
  "oisummit/public/index.html",
  "oisummit/tech/index.html",
  "oisummit/capture/index.html",
];
const sharedAssets = [
  "assets/agent-demo-scenarios.js",
  "assets/oisummit.css",
  "assets/oisummit-config.js",
];

test("OISUMMIT five-route artifact regression", () => {
  for (const route of routes) {
    assert.equal(fs.existsSync(path.join(root, route)), true, `source missing: ${route}`);
    assert.equal(fs.existsSync(path.join(root, "public_build", route)), true, `artifact missing: ${route}`);
  }
  for (const asset of sharedAssets) {
    assert.equal(fs.existsSync(path.join(root, asset)), true, `source asset missing: ${asset}`);
    assert.equal(fs.existsSync(path.join(root, "public_build", asset)), true, `artifact asset missing: ${asset}`);
  }

  const publicPages = routes.slice(0, 4).map((route) => fs.readFileSync(path.join(root, route), "utf8")).join("\n");
  assert.match(publicPages, /AI AGENTS ARE BECOMING[\s\S]*THE NEW INTERFACE\./);
  assert.match(publicPages, /Agent Readiness/);
  assert.match(publicPages, /Municipal Agent Readiness|MAR/);
  assert.match(publicPages, /Agent Execution/);
  assert.doesNotMatch(publicPages, /ABIS|Agent Business Interaction Standard|Family [BD]|M[1-8]|R[1-7]/);
});
