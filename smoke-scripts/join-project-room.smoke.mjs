// Harness-owned smoke walkthrough for the join-project-room skill.
// A scripted agent follows SKILL.md step by step against a local room and
// asserts every claim the skill makes. Emits PASS/FAIL lines for the harness
// runner to parse. Smoke scripts live in the HARNESS repo, never in the
// skill itself, so a skill cannot ship its own passing test.
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";

const HERE = dirname(fileURLToPath(import.meta.url));
// NOTE: the checkout is used READ-ONLY as a module source (imports only);
// the walkthrough never checks out branches or writes to it.
function defaultRoomCheckout() {
  const cands = [
    `${process.env.HOME}/workspace/room-checkout-main`, // harness-pinned worktree at origin/main
    `${process.env.HOME}/workspace/project-room`,       // shared checkout (verify it is on main!)
  ];
  for (const c of cands) {
    try { if (existsSync(join(c, "server", "agent-card-signing.mjs"))) return c; } catch {}
  }
  return cands[1];
}
const ROOM = process.env.HARNESS_ROOM_CHECKOUT || defaultRoomCheckout();
const SKILL = process.env.HARNESS_SKILL_DIR || `${process.env.HOME}/workspace/agent-skills/skills/join-project-room`;

const { RoomStore } = await import(`${ROOM}/server/store.mjs`);
const { createRoomServer } = await import(`${ROOM}/server/http.mjs`);
const { initialRoom } = await import(`${ROOM}/server/bootstrap.mjs`);
const { generateKeyPair, verifyCardSignature } = await import(`${ROOM}/server/agent-card-signing.mjs`);

const results = [];
const step = (name, fn) => Promise.resolve()
  .then(fn)
  .then(() => { results.push(`PASS ${name}`); console.log(`PASS ${name}`); })
  .catch(err => { results.push(`FAIL ${name}: ${err.message}`); console.error(`FAIL ${name}: ${err.message}`); process.exitCode = 1; });

const directory = mkdtempSync(join(tmpdir(), "skill-walkthrough-"));
const store = new RoomStore(join(directory, "room.sqlite"), { now: () => Date.now() });
store.initialize(initialRoom());
const ownerKey = store.issueAccessKey("commons", "owner");
const server = createRoomServer({ store });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
// NOTE: no Origin header anywhere below — the skill says bearer clients are exempt.
const call = (path, { method = "GET", data, token } = {}) => fetch(origin + path, {
  method,
  headers: {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(data === undefined ? {} : { "Content-Type": "application/json" }),
  },
  ...(data === undefined ? {} : { body: JSON.stringify(data) }),
});

// --- Skill Step 1: discovery ---
await step("1a: agent-card.json served", async () => {
  const r = await call("/.well-known/agent-card.json");
  assert.equal(r.status, 200);
});
await step("1b: llms.txt served", async () => {
  const r = await call("/llms.txt");
  assert.equal(r.status, 200);
});
await step("1c: public guest-invite contract", async () => {
  const r = await call("/api/guest-invites");
  assert.equal(r.status, 200);
  const c = await r.json();
  assert.equal(c.invitePrefix, "GX-");
  assert.equal(c.maxActiveGuestsPerRoom, 5);
});

// --- Skill Step 2: mint identity ---
let identityId, identitySecret;
await step("2: identity-create returns ai_ id + pri_ secret", async () => {
  const r = await call("/api/agent-identities", { method: "POST", data: { displayName: "Walkthrough Agent" } });
  assert.equal(r.status, 201);
  const j = await r.json();
  identityId = j.identityId; identitySecret = j.secret;
  assert.match(identityId, /^ai_/);
  assert.match(identitySecret, /^pri_/);
});

// --- Skill Steps 3+4: keypair + sign via the SKILL's bundled script ---
let card;
await step("3/4: skill sign-card.mjs produces a server-verifiable signature", async () => {
  const kp = generateKeyPair();
  card = { name: "Walkthrough Agent", description: "Cold-walkthrough test agent.", capabilities: ["chat"] };
  writeFileSync(join(directory, "card.json"), JSON.stringify(card));
  const sig = execFileSync("node", [`${SKILL}/scripts/sign-card.mjs`, "--agent-id", identityId, "--card", join(directory, "card.json"), "--out", join(directory, "signed-card.json")],
    { env: { ...process.env, CARD_SEED: kp.privateKey }, encoding: "utf8" }).trim();
  assert.match(sig, /^[A-Za-z0-9+/=]{86,88}$/);
  const signed = JSON.parse((await import("node:fs")).readFileSync(join(directory, "signed-card.json"), "utf8"));
  assert.equal(signed.publicKey, kp.publicKey);
  // The room's own verifier must accept the script's output.
  assert.equal(verifyCardSignature({ agentId: identityId, card: signed, publicKey: signed.publicKey, signature: signed.signature }), true);
  card = signed;
});

// --- Owner mints the GX- code (the walkthrough's "given") ---
let inviteCode, roomId = "commons";
const ownerRevision = () => store.room(roomId).state.members.owner.revision;
const mintInvite = async label => {
  const r = await call(`/api/rooms/${roomId}/guest-invites`, {
    method: "POST", token: ownerKey,
    data: { requestId: randomUUID(), guestLabel: label, expectedOwnerRevision: ownerRevision() },
  });
  assert.equal(r.status, 201, `mint ${label}`);
  return (await r.json()).code;
};
await step("owner mint issues GX- code", async () => {
  inviteCode = await mintInvite("walkthrough");
  assert.match(inviteCode, /^GX-[A-Za-z0-9_-]{32}$/);
});
const errCode = async r => (await r.json()).error.code;

// --- Skill Step 5: redeem (no Origin header — bearer exemption) ---
let guestToken;
await step("5: redeem with signed card, bearer pri_, no Origin → 201", async () => {
  const r = await call("/api/guest-invites/redeem", {
    method: "POST", token: identitySecret, data: { inviteCode, card },
  });
  assert.equal(r.status, 201);
  const j = await r.json();
  guestToken = j.token;
  assert.match(guestToken, /^ga1\./);
  assert.match(j.member.displayName, / \(guest\)$/);
  assert.equal(j.room.id, roomId);
  assert.deepEqual(j.scopes, ["guest:read", "guest:post"]);
});
await step("5b: double redeem is idempotent (duplicate:true, 200)", async () => {
  // fresh code for the same identity
  const code2 = await mintInvite("walk2");
  const r = await call("/api/guest-invites/redeem", { method: "POST", token: identitySecret, data: { inviteCode: code2, card } });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).duplicate, true);
});
await step("5c: bad code → 410 invite_unavailable", async () => {
  const r = await call("/api/guest-invites/redeem", {
    method: "POST", token: identitySecret,
    data: { inviteCode: "GX-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", card },
  });
  assert.equal(r.status, 410);
  assert.equal(await errCode(r), "invite_unavailable");
});
await step("5d: tampered card → 422 card_invalid", async () => {
  const code3 = await mintInvite("walk3");
  const bad = { ...card, description: "tampered after signing" };
  const r = await call("/api/guest-invites/redeem", { method: "POST", token: identitySecret, data: { inviteCode: code3, card: bad } });
  assert.equal(r.status, 422);
  assert.equal(await errCode(r), "card_invalid");
});

// --- Skill Step 6: read + chat ---
const chatMessageId = randomUUID();
await step("6a: guest reads events/bounties/work-claims → 200", async () => {
  for (const p of [`/api/rooms/${roomId}/events`, `/api/rooms/${roomId}/bounties`, `/api/rooms/${roomId}/work-claims`]) {
    const r = await call(p, { token: guestToken });
    assert.equal(r.status, 200, p);
  }
});
await step("6b: guest posts chat via commands → 201", async () => {
  const id = randomUUID();
  const r = await call(`/api/rooms/${roomId}/commands`, {
    method: "POST", token: guestToken,
    data: { id, type: "message.posted", data: { messageId: chatMessageId, body: "Hello from the walkthrough." } },
  });
  assert.equal(r.status, 201);
});
await step("6c: guest reacts → 201", async () => {
  const r = await call(`/api/rooms/${roomId}/commands`, {
    method: "POST", token: guestToken,
    data: { id: randomUUID(), type: "message.reaction_set", data: { messageId: chatMessageId, reaction: "like", active: true } },
  });
  assert.ok([200, 201].includes(r.status));
});
await step("6d: guest rotate → fresh token", async () => {
  const r = await call("/api/guest-invites/rotate", { method: "POST", token: guestToken, data: { roomId } });
  assert.equal(r.status, 200);
  guestToken = (await r.json()).token;
  assert.match(guestToken, /^ga1\./);
});
await step("6e: guest collab mutation is 403 (boundary holds)", async () => {
  const r = await call(`/api/rooms/${roomId}/collab/draft-locks/acquire`, {
    method: "POST", token: guestToken, data: {},
  });
  assert.equal(r.status, 403);
  assert.equal(await errCode(r), "guest_scope_denied");
});

if (server.closeStreams) server.closeStreams();
if (server.closeAllConnections) server.closeAllConnections();
await new Promise(r => server.close(r)); store.close();
rmSync(directory, { recursive: true, force: true });
console.log(`\n${results.filter(x => x.startsWith("PASS")).length}/${results.length} walkthrough steps passed`);
