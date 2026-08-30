import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const page = fs.readFileSync(path.join(root, "oisummit/capture/index.html"), "utf8");
const api = fs.readFileSync(path.join(root, "api/oisummit-capture.js"), "utf8");

test("capture UI contract", () => {
  for (const token of ["sagamihara","biprogy","pacific_consultants","yokohama","goodpatch","hyogo","shizuoka_city","toyama","salesforce_japan","nssol","kanagawa","eiicon","shizuoka","gifu","daido_life","nara","yamanashi","mori_building","seino_holdings","tokyo"]) assert.match(page, new RegExp(token));
  for (const token of ["HOT","WARM","CONTACT","MISS","oisummit_capture_token_v1","oisummit_capture_queue_v1","SAVED ✓","CONFIG_REQUIRED","flushQueue","state.pending","QUEUED LOCALLY","RETRY","CAPTURE NEXT","その他の企業・団体を入力","ADHOC_","data-adhoc-type","data-adhoc-route","target_name_and_result_required"]) assert.match(page + api, new RegExp(token.replace(/[✓]/g, "\\✓")));
  assert.match(page, /sessionStorage/);
  assert.doesNotMatch(page, /localStorage\.(?:getItem|setItem|removeItem)\([^)]*token/i);
  assert.doesNotMatch(page, /[?&](?:token|access_token)=/i);
  assert.doesNotMatch(page, /gtag\s*\(/);
});

test("API contract is protected and dedicated", () => {
  assert.match(api, /OISUMMIT_CAPTURE_ACCESS_TOKEN/);
  assert.match(api, /OISUMMIT_CAPTURE_WRITE_ENABLED/);
  assert.match(api, /OISUMMIT_CAPTURES_TABLE_NAME/);
  assert.match(api, /capture_id/);
  assert.match(api, /duplicate/);
  assert.match(api, /CONFIG_REQUIRED/);
  assert.match(api, /timingSafeEqual/);
  assert.doesNotMatch(api, /AIRTABLE_TABLE_NAME\s*\|\|/);
});
