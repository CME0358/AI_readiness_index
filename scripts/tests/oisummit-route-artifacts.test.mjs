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

test("Agent Readiness permanent landing route artifacts", () => {
  for (const route of routes) {
    assert.equal(fs.existsSync(path.join(root, route)), true, `source missing: ${route}`);
  }
  const permanentRoutes = [
    "agent-readiness/index.html",
    "agent-readiness/enterprise/index.html",
    "agent-readiness/public/index.html",
    "agent-readiness/tech/index.html",
  ];
  for (const route of permanentRoutes) {
    assert.equal(fs.existsSync(path.join(root, "public_build", route)), true, `artifact missing: ${route}`);
  }
  assert.equal(fs.existsSync(path.join(root, "public_build/oisummit/capture/index.html")), false, "legacy capture page must not be public");
  for (const asset of sharedAssets) {
    assert.equal(fs.existsSync(path.join(root, asset)), true, `source asset missing: ${asset}`);
    assert.equal(fs.existsSync(path.join(root, "public_build", asset)), true, `artifact asset missing: ${asset}`);
  }

  const publicPages = permanentRoutes.map((route) => fs.readFileSync(path.join(root, "public_build", route), "utf8")).join("\n");
  assert.match(publicPages, /AI AGENTS ARE BECOMING[\s\S]*THE NEW INTERFACE\./);
  assert.match(publicPages, /Agent Readiness/);
  assert.match(publicPages, /Municipal Agent Readiness|MAR/);
  assert.match(publicPages, /Agent Execution/);
  assert.match(publicPages, /abis\.coaretail\.com/);
  assert.doesNotMatch(publicPages, /OISUMMIT|OI SUMMIT|30分オンラインMTG/);
  const deployment = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  for (const [source, destination] of [
    ["/oisummit/", "/agent-readiness/"],
    ["/oisummit/enterprise/", "/agent-readiness/enterprise/"],
    ["/oisummit/public/", "/agent-readiness/public/"],
    ["/oisummit/tech/", "/agent-readiness/tech/"],
    ["/oisummit/capture/", "/agent-readiness/"],
  ]) {
    assert.ok(deployment.redirects.some((redirect) => redirect.source === source && redirect.destination === destination && redirect.permanent));
  }
  assert.ok(deployment.redirects.some((redirect) => redirect.source === "/oisummit/:path*" && redirect.destination === "/agent-readiness/" && redirect.permanent));
});
