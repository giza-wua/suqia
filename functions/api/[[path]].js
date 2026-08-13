var __defProp = Object.defineProperty;
var __export = (target, all2) => {
  for (var name in all2)
    __defProp(target, name, { get: all2[name], enumerable: true });
};

// ../zc/src/lib/db.js
function newId() {
  return crypto.randomUUID();
}
async function all(db, sql, ...params) {
  const { results } = await db.prepare(sql).bind(...params).all();
  return results;
}
async function first(db, sql, ...params) {
  return db.prepare(sql).bind(...params).first();
}
async function run(db, sql, ...params) {
  return db.prepare(sql).bind(...params).run();
}
function json(data, status2 = 200) {
  return new Response(JSON.stringify(data), {
    status: status2,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
function errorJson(message, status2 = 400) {
  return json({ error: message }, status2);
}

// ../zc/src/lib/auth.js
var PBKDF2_ITERATIONS = 1e4;
function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt);
  return { hash: toHex(hash), salt: toHex(salt) };
}
async function verifyPassword(password, hashHex, saltHex) {
  const hash = await pbkdf2(password, fromHex(saltHex));
  return toHex(hash) === hashHex;
}
async function pbkdf2(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
}
function b64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}
async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}
async function signSession(payload, secret, expiresInSeconds = 60 * 60 * 24 * 7) {
  const header = { alg: "HS256", typ: "JWT" };
  const body = { ...payload, iat: Math.floor(Date.now() / 1e3), exp: Math.floor(Date.now() / 1e3) + expiresInSeconds };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${b64url(sig)}`;
}
async function verifySession(token, secret) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, b64urlDecode(s), new TextEncoder().encode(`${h}.${p}`));
  if (!valid) return null;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1e3)) return null;
  return payload;
}

// ../zc/src/middleware/auth.js
var ROLE_RANK = { viewer: 1, editor: 2, admin: 3 };
function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}
async function getSessionUser(request, env) {
  const token = getCookie(request, "zimam_session");
  if (!token) return null;
  return verifySession(token, env.SESSION_SECRET);
}
async function requireRole(request, env, minRole = "viewer") {
  const user = await getSessionUser(request, env);
  if (!user) return unauthorized();
  if ((ROLE_RANK[user.role] || 0) < (ROLE_RANK[minRole] || 0)) return forbidden();
  return user;
}
function unauthorized() {
  return new Response(JSON.stringify({ error: "\u063A\u064A\u0631 \u0645\u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644" }), { status: 401, headers: { "content-type": "application/json" } });
}
function forbidden() {
  return new Response(JSON.stringify({ error: "\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0643\u0627\u0641\u064A\u0629" }), { status: 403, headers: { "content-type": "application/json" } });
}

// ../zc/src/routes/auth.js
var COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
async function login(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.username || !body.password) return errorJson("\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631.");
  const username = String(body.username).trim().toLowerCase();
  const user = await first(
    env.DB,
    "SELECT * FROM users WHERE username = ?1 LIMIT 1",
    username
  );
  if (!user) return errorJson("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629.", 401);
  const ok = await verifyPassword(body.password, user.password_hash, user.password_salt);
  if (!ok) return errorJson("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629.", 401);
  const token = await signSession(
    { sub: user.id, role: user.role, display_name: user.display_name, username: user.username },
    env.SESSION_SECRET,
    COOKIE_MAX_AGE
  );
  const res = json({ id: user.id, display_name: user.display_name, role: user.role, username: user.username });
  res.headers.append(
    "Set-Cookie",
    `zimam_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}`
  );
  return res;
}
async function logout() {
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", `zimam_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
  return res;
}
async function me(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return errorJson("\u063A\u064A\u0631 \u0645\u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644", 401);
  return json({ id: user.sub, role: user.role, display_name: user.display_name, username: user.username });
}
async function changePassword(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return errorJson("\u063A\u064A\u0631 \u0645\u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644", 401);
  const body = await request.json().catch(() => null);
  if (!body || !body.currentPassword || !body.newPassword) return errorJson("\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0648\u0627\u0644\u062C\u062F\u064A\u062F\u0629.");
  if (body.newPassword.length < 6) return errorJson("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0642\u0635\u064A\u0631\u0629 \u062C\u062F\u0627\u064B\u060C 6 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644.");
  const row = await first(env.DB, "SELECT password_hash, password_salt FROM users WHERE id = ?1", user.sub);
  if (!row) return errorJson("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.", 404);
  const ok = await verifyPassword(body.currentPassword, row.password_hash, row.password_salt);
  if (!ok) return errorJson("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629.", 401);
  const { hash, salt } = await hashPassword(body.newPassword);
  await run(env.DB, "UPDATE users SET password_hash = ?2, password_salt = ?3 WHERE id = ?1", user.sub, hash, salt);
  return json({ ok: true });
}

// ../zc/src/routes/setup.js
var COOKIE_MAX_AGE2 = 60 * 60 * 24 * 7;
var USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
async function isEmpty(env) {
  const row = await first(env.DB, "SELECT COUNT(*) as c FROM users");
  return row.c === 0;
}
async function status(request, env) {
  return json({ needsSetup: await isEmpty(env) });
}
async function create(request, env) {
  if (!await isEmpty(env)) return errorJson("\u0627\u0644\u0646\u0638\u0627\u0645 \u0645\u064F\u0639\u064E\u062F\u0651 \u0628\u0627\u0644\u0641\u0639\u0644\u060C \u0645\u0646 \u0641\u0636\u0644\u0643 \u0633\u062C\u0651\u0644 \u062F\u062E\u0648\u0644\u0643 \u0645\u0646 \u0635\u0641\u062D\u0629 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0639\u0627\u062F\u064A\u0629.", 403);
  const body = await request.json().catch(() => null);
  if (!body || !body.display_name || !body.username || !body.password) return errorJson("\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631.");
  const username = String(body.username).trim().toLowerCase();
  if (!USERNAME_RE.test(username)) return errorJson("\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0628\u062D\u0631\u0648\u0641 \u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0635\u063A\u064A\u0631\u0629/\u0623\u0631\u0642\u0627\u0645 \u0641\u0642\u0637 (3-30 \u062D\u0631\u0641\u0627\u064B)\u060C \u0628\u062F\u0648\u0646 \u0645\u0633\u0627\u0641\u0627\u062A.");
  if (body.password.length < 6) return errorJson("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0642\u0635\u064A\u0631\u0629 \u062C\u062F\u0627\u064B\u060C 6 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644.");
  const { hash, salt } = await hashPassword(body.password);
  const id = newId();
  await run(
    env.DB,
    `INSERT INTO users (id,username,phone,email,has_real_email,password_hash,password_salt,display_name,role)
         VALUES (?1,?2,NULL,?3,0,?4,?5,?6,'admin')`,
    id,
    username,
    `${username}@internal.zimam`,
    hash,
    salt,
    body.display_name
  );
  const token = await signSession({ sub: id, role: "admin", display_name: body.display_name, username }, env.SESSION_SECRET, COOKIE_MAX_AGE2);
  const res = json({ id, display_name: body.display_name, role: "admin", username }, 201);
  res.headers.append(
    "Set-Cookie",
    `zimam_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE2}`
  );
  return res;
}

// ../zc/src/routes/activity-log.js
async function list(request, env) {
  const user = await requireRole(request, env, "admin");
  if (user instanceof Response) return user;
  const rows = await all(env.DB, "SELECT * FROM activity_log ORDER BY at DESC LIMIT 100");
  return json(rows);
}

// ../zc/src/lib/activity-log.js
async function logActivity(env, user, module, action, description) {
  await env.DB.prepare(
    `INSERT INTO activity_log (id, module, action, username, display_name, role, description, at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))`
  ).bind(
    newId(),
    module,
    action,
    user?.username || null,
    user?.display_name || "\u0632\u0627\u0626\u0631 (\u0628\u0644\u0627\u063A \u0639\u0627\u0645)",
    user?.role || null,
    description
  ).run();
}

// ../zc/src/routes/wipe.js
var WIPEABLE_TABLES = ["masaqi", "canals", "bridges", "wells", "drains", "members", "news", "tickets"];
async function wipe(request, env, table) {
  const user = await requireRole(request, env, "admin");
  if (user instanceof Response) return user;
  if (!WIPEABLE_TABLES.includes(table)) return errorJson("\u0645\u062C\u0645\u0648\u0639\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629.", 400);
  const body = await request.json().catch(() => null);
  if (!body || body.confirm !== table) {
    return errorJson("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u062A\u0623\u0643\u064A\u062F \u0628\u0634\u0643\u0644 \u0635\u062D\u064A\u062D \u2014 \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0623\u064F\u0644\u063A\u064A\u062A \u0644\u062D\u0645\u0627\u064A\u062A\u0643.", 400);
  }
  await run(env.DB, `DELETE FROM ${table}`);
  await logActivity(env, user, table, "delete", `\u26A0\uFE0F \u0645\u0633\u062D \u062C\u0645\u064A\u0639 \u0633\u062C\u0644\u0627\u062A "${table}" \u0628\u0627\u0644\u0643\u0627\u0645\u0644`);
  return json({ ok: true });
}

// ../zc/src/routes/masaqi.js
var masaqi_exports = {};
__export(masaqi_exports, {
  create: () => create2,
  list: () => list2,
  remove: () => remove,
  update: () => update
});
async function list2(request, env) {
  const user = await requireRole(request, env, "viewer");
  if (user instanceof Response) return user;
  const rows = await all(env.DB, "SELECT * FROM masaqi ORDER BY created_at DESC");
  return json(rows);
}
async function create2(request, env) {
  const user = await requireRole(request, env, "editor");
  if (user instanceof Response) return user;
  const b = await request.json().catch(() => null);
  if (!b || !b.name || !b.directorate) return errorJson("\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u0642\u0649 \u0648\u0627\u0644\u0647\u0646\u062F\u0633\u0629.");
  const id = b.id || newId();
  await run(
    env.DB,
    `INSERT INTO masaqi (id, name, directorate, village, canal, status, gps, date, zamam, length)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, directorate=excluded.directorate, village=excluded.village,
         canal=excluded.canal, status=excluded.status, gps=excluded.gps, date=excluded.date, zamam=excluded.zamam,
         length=excluded.length, updated_at=datetime('now')`,
    id,
    b.name,
    b.directorate,
    b.village || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F",
    b.canal || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F",
    b.status || null,
    b.gps || null,
    b.date || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F",
    b.zamam || "0",
    b.length || "0"
  );
  await logActivity(env, user, "masaqi", "create", `\u0623\u0636\u0627\u0641 \u0645\u0633\u0642\u0649: ${b.name}`);
  return json({ id }, 201);
}
async function update(request, env, id) {
  const user = await requireRole(request, env, "editor");
  if (user instanceof Response) return user;
  const existing = await first(env.DB, "SELECT id FROM masaqi WHERE id = ?1", id);
  if (!existing) return errorJson("\u0627\u0644\u0633\u062C\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.", 404);
  const b = await request.json().catch(() => null);
  if (!b || !b.name || !b.directorate) return errorJson("\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u0642\u0649 \u0648\u0627\u0644\u0647\u0646\u062F\u0633\u0629.");
  await run(
    env.DB,
    `UPDATE masaqi SET name=?2, directorate=?3, village=?4, canal=?5, status=?6, gps=?7,
         date=?8, zamam=?9, length=?10, updated_at=datetime('now') WHERE id=?1`,
    id,
    b.name,
    b.directorate,
    b.village || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F",
    b.canal || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F",
    b.status || null,
    b.gps || null,
    b.date || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F",
    b.zamam || "0",
    b.length || "0"
  );
  await logActivity(env, user, "masaqi", "update", `\u0639\u062F\u0651\u0644 \u0645\u0633\u0642\u0649: ${b.name}`);
  return json({ ok: true });
}
async function remove(request, env, id) {
  const user = await requireRole(request, env, "editor");
  if (user instanceof Response) return user;
  const existing = await first(env.DB, "SELECT name FROM masaqi WHERE id = ?1", id);
  if (!existing) return errorJson("\u0627\u0644\u0633\u062C\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.", 404);
  await run(env.DB, "DELETE FROM masaqi WHERE id = ?1", id);
  await logActivity(env, user, "masaqi", "delete", `\u062D\u0630\u0641 \u0645\u0633\u0642\u0649: ${existing.name}`);
  return json({ ok: true });
}

// ../zc/src/routes/tickets.js
var COOLDOWN_SECONDS = 60;
async function create3(request, env) {
  const b = await request.json().catch(() => null);
  if (!b || !b.farmer_name || !b.watercourse) return errorJson("\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0645\u062C\u0631\u0649 \u0627\u0644\u0645\u0627\u0626\u064A.");
  if (b.hp) return json({ ok: true });
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const cacheKey = new Request(`https://zimam-ratelimit.internal/ticket/${ip}`);
  const cache = caches.default;
  if (await cache.match(cacheKey)) {
    return errorJson("\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0628\u0644\u0627\u063A \u0645\u0646 \u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632 \u0645\u0624\u062E\u0631\u0627\u064B\u060C \u0628\u0631\u062C\u0627\u0621 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0642\u0644\u064A\u0644\u0627\u064B \u0642\u0628\u0644 \u0625\u0631\u0633\u0627\u0644 \u0628\u0644\u0627\u063A \u0622\u062E\u0631.", 429);
  }
  await cache.put(cacheKey, new Response("1", { headers: { "Cache-Control": `max-age=${COOLDOWN_SECONDS}` } }));
  const id = newId();
  const dateString = (/* @__PURE__ */ new Date()).toLocaleDateString("ar-EG");
  await run(
    env.DB,
    `INSERT INTO tickets (id, farmer_name, phone, directorate, watercourse, issue_type, gps, description, status, date_string)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, '\u062C\u062F\u064A\u062F', ?9)`,
    id,
    b.farmer_name,
    b.phone || "\u063A\u064A\u0631 \u0645\u0633\u062C\u0644",
    b.directorate || null,
    b.watercourse,
    b.issue_type || null,
    b.gps || null,
    b.description || "\u0644\u0627 \u064A\u0648\u062C\u062F \u0648\u0635\u0641",
    dateString
  );
  await logActivity(env, null, "tickets", "create", `\u0628\u0644\u0627\u063A \u062C\u062F\u064A\u062F \u0645\u0646 \u0627\u0644\u0645\u0632\u0627\u0631\u0639 "${b.farmer_name}" \u0639\u0644\u0649 ${b.watercourse}`);
  return json({ id }, 201);
}
async function list3(request, env) {
  const user = await requireRole(request, env, "viewer");
  if (user instanceof Response) return user;
  const rows = await all(env.DB, "SELECT * FROM tickets ORDER BY created_at DESC");
  return json(rows);
}
async function updateStatus(request, env, id) {
  const user = await requireRole(request, env, "editor");
  if (user instanceof Response) return user;
  const b = await request.json().catch(() => null);
  if (!b || !b.status) return errorJson("\u0627\u0644\u0631\u062C\u0627\u0621 \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u062D\u0627\u0644\u0629.");
  await run(env.DB, "UPDATE tickets SET status = ?2 WHERE id = ?1", id, b.status);
  await logActivity(env, user, "tickets", "update", `\u062D\u062F\u0651\u062B \u062D\u0627\u0644\u0629 \u0628\u0644\u0627\u063A \u0625\u0644\u0649: ${b.status}`);
  return json({ ok: true });
}

// ../zc/src/routes/canals.js
function fromRow(r) {
  let sections = [];
  if (r.sections_json) {
    try {
      sections = JSON.parse(r.sections_json);
    } catch (e) {
      console.error(`sections_json \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0644\u0644\u062A\u0631\u0639\u0629 ${r.id}:`, e.message);
    }
  }
  return { ...r, sections, is_lined: !!r.is_lined };
}
async function list4(request, env) {
  const user = await requireRole(request, env, "viewer");
  if (user instanceof Response) return user;
  // نفس إصلاح باقي القائمة أعلاه: جدول canals مالوش created_at، والاستعلام
  // القديم كان بيفشل بـ 500 في كل استدعاء (راجع الشرح المفصَّل هناك).
  const rows = await all(env.DB, "SELECT * FROM canals ORDER BY updated_at DESC LIMIT 5000");
  return json(rows.map(fromRow));
}
async function count(request, env) {
  const user = await requireRole(request, env, "viewer");
  if (user instanceof Response) return user;
  const row = await first(env.DB, "SELECT COUNT(*) as c FROM canals");
  return json({ count: row.c });
}
async function create4(request, env) {
  const user = await requireRole(request, env, "editor");
  if (user instanceof Response) return user;
  const b = await request.json().catch(() => null);
  if (!b || !b.name || !b.directorate) return errorJson("\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0627\u0633\u0645 \u0627\u0644\u062A\u0631\u0639\u0629 \u0648\u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0647\u0646\u062F\u0633\u0629.");
  const id = b.id || newId();
  await run(
    env.DB,
    `INSERT INTO canals (id,name,directorate,feeder_canal,bank,length,command_area,discharge_rate,lat,lng,
         status,next_scheduled_date,last_dredging_date,sections_json,is_lined,lining_type,lined_length,notes)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, directorate=excluded.directorate, feeder_canal=excluded.feeder_canal,
         bank=excluded.bank, length=excluded.length, command_area=excluded.command_area, discharge_rate=excluded.discharge_rate,
         lat=excluded.lat, lng=excluded.lng, status=excluded.status, next_scheduled_date=excluded.next_scheduled_date,
         last_dredging_date=excluded.last_dredging_date, sections_json=excluded.sections_json, is_lined=excluded.is_lined,
         lining_type=excluded.lining_type, lined_length=excluded.lined_length, notes=excluded.notes, updated_at=datetime('now')`,
    id,
    b.name,
    b.directorate,
    b.feeder_canal || null,
    b.bank || null,
    b.length || null,
    b.command_area || null,
    b.discharge_rate || null,
    b.lat || null,
    b.lng || null,
    b.status || null,
    b.next_scheduled_date || null,
    b.last_dredging_date || null,
    JSON.stringify(b.sections || []),
    b.lining?.is_lined ? 1 : 0,
    b.lining?.lining_type || null,
    b.lining?.lined_length || null,
    b.notes || null
  );
  await logActivity(env, user, "canals", "create", `\u0623\u0636\u0627\u0641 \u062A\u0631\u0639\u0629: ${b.name}`);
  return json({ id }, 201);
}
async function update2(request, env, id) {
  const user = await requireRole(request, env, "editor");
  if (user instanceof Response) return user;
  const existing = await first(env.DB, "SELECT id FROM canals WHERE id = ?1", id);
  if (!existing) return errorJson("\u0627\u0644\u0633\u062C\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.", 404);
  const b = await request.json().catch(() => null);
  if (!b || !b.name || !b.directorate) return errorJson("\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0627\u0633\u0645 \u0627\u0644\u062A\u0631\u0639\u0629 \u0648\u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0647\u0646\u062F\u0633\u0629.");
  await run(
    env.DB,
    `UPDATE canals SET name=?2,directorate=?3,feeder_canal=?4,bank=?5,length=?6,command_area=?7,discharge_rate=?8,
         lat=?9,lng=?10,status=?11,next_scheduled_date=?12,last_dredging_date=?13,sections_json=?14,is_lined=?15,
         lining_type=?16,lined_length=?17,notes=?18,updated_at=datetime('now') WHERE id=?1`,
    id,
    b.name,
    b.directorate,
    b.feeder_canal || null,
    b.bank || null,
    b.length || null,
    b.command_area || null,
    b.discharge_rate || null,
    b.lat || null,
    b.lng || null,
    b.status || null,
    b.next_scheduled_date || null,
    b.last_dredging_date || null,
    JSON.stringify(b.sections || []),
    b.lining?.is_lined ? 1 : 0,
    b.lining?.lining_type || null,
    b.lining?.lined_length || null,
    b.notes || null
  );
  await logActivity(env, user, "canals", "update", `\u0639\u062F\u0651\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u062A\u0631\u0639\u0629: ${b.name}`);
  return json({ ok: true });
}
async function remove2(request, env, id) {
  const user = await requireRole(request, env, "editor");
  if (user instanceof Response) return user;
  const existing = await first(env.DB, "SELECT name FROM canals WHERE id = ?1", id);
  if (!existing) return errorJson("\u0627\u0644\u0633\u062C\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.", 404);
  await run(env.DB, "DELETE FROM canals WHERE id = ?1", id);
  await logActivity(env, user, "canals", "delete", `\u062D\u0630\u0641 \u062A\u0631\u0639\u0629: ${existing.name}`);
  return json({ ok: true });
}
async function listHistory(request, env, canalId) {
  const user = await requireRole(request, env, "viewer");
  if (user instanceof Response) return user;
  const rows = await all(env.DB, "SELECT * FROM canal_history WHERE canal_id = ?1 ORDER BY created_at DESC", canalId);
  return json(rows);
}
async function addHistory(request, env, canalId) {
  const user = await requireRole(request, env, "editor");
  if (user instanceof Response) return user;
  const canal = await first(env.DB, "SELECT id, name FROM canals WHERE id = ?1", canalId);
  if (!canal) return errorJson("\u0627\u0644\u062A\u0631\u0639\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.", 404);
  const b = await request.json().catch(() => null);
  if (!b || !b.date || !b.status) return errorJson("\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0648\u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u062D\u0627\u0644\u0629.");
  const id = b.id || newId();
  await run(
    env.DB,
    `INSERT INTO canal_history (id,canal_id,date,status_after,note,recorded_by) VALUES (?1,?2,?3,?4,?5,?6)
         ON CONFLICT(id) DO UPDATE SET date=excluded.date, status_after=excluded.status_after, note=excluded.note, recorded_by=excluded.recorded_by`,
    id,
    canalId,
    b.date,
    b.status,
    b.note || "\u0628\u062F\u0648\u0646 \u0645\u0644\u0627\u062D\u0638\u0627\u062A",
    b.recorded_by || user.display_name || "\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641"
  );
  const dredgeDate = b.status === "\u062A\u0645 \u0627\u0644\u062A\u0637\u0647\u064A\u0631" ? b.date : null;
  await run(
    env.DB,
    `UPDATE canals SET status=?2, last_dredging_date=COALESCE(?3, last_dredging_date), updated_at=datetime('now') WHERE id=?1`,
    canalId,
    b.status,
    dredgeDate
  );
  await logActivity(env, user, "canals", "update", `\u0633\u062C\u0651\u0644 \u062D\u062F\u062B \u062A\u0637\u0647\u064A\u0631 \u0644\u062A\u0631\u0639\u0629 ${canal.name} \u0628\u062A\u0627\u0631\u064A\u062E ${b.date} (${b.status})`);
  return json({ id }, 201);
}

// ../zc/src/routes/bridges.js
var bridges_exports = {};
__export(bridges_exports, {
  create: () => create5,
  list: () => list5,
  remove: () => remove3,
  update: () => update3
});

// ../zc/src/lib/simple-resource.js
function makeSimpleResource(config) {
  const { table, fields, requiredFields, nameField = "name", writeRole = "editor", labelSingular } = config;
  const cols = fields.join(",");
  const placeholders = fields.map((_, i) => `?${i + 2}`).join(",");
  const setClause = fields.map((f, i) => `${f}=?${i + 2}`).join(",");
  async function list11(request, env) {
    const user = await requireRole(request, env, "viewer");
    if (user instanceof Response) return user;
    const rows = await all(env.DB, `SELECT * FROM ${table} ORDER BY updated_at DESC`);
    return json(rows);
  }
  function validate(b) {
    for (const f of requiredFields) if (!b[f]) return false;
    return true;
  }
  async function create11(request, env) {
    const user = await requireRole(request, env, writeRole);
    if (user instanceof Response) return user;
    const b = await request.json().catch(() => null);
    if (!b || !validate(b)) return errorJson(`\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A ${labelSingular} \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629.`);
    const id = b.id || newId();
    const updateSet = fields.map((f) => `${f}=excluded.${f}`).join(",");
    await run(
      env.DB,
      `INSERT INTO ${table} (id,${cols}) VALUES (?1,${placeholders})
             ON CONFLICT(id) DO UPDATE SET ${updateSet}, updated_at=datetime('now')`,
      id,
      ...fields.map((f) => b[f] ?? null)
    );
    await logActivity(env, user, table, "create", `\u0623\u0636\u0627\u0641 ${labelSingular}: ${b[nameField]}`);
    return json({ id }, 201);
  }
  async function update8(request, env, id) {
    const user = await requireRole(request, env, writeRole);
    if (user instanceof Response) return user;
    const existing = await first(env.DB, `SELECT id FROM ${table} WHERE id = ?1`, id);
    if (!existing) return errorJson("\u0627\u0644\u0633\u062C\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.", 404);
    const b = await request.json().catch(() => null);
    if (!b || !validate(b)) return errorJson(`\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A ${labelSingular} \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629.`);
    await run(env.DB, `UPDATE ${table} SET ${setClause}, updated_at=datetime('now') WHERE id=?1`, id, ...fields.map((f) => b[f] ?? null));
    await logActivity(env, user, table, "update", `\u0639\u062F\u0651\u0644 ${labelSingular}: ${b[nameField]}`);
    return json({ ok: true });
  }
  async function remove9(request, env, id) {
    const user = await requireRole(request, env, writeRole);
    if (user instanceof Response) return user;
    const existing = await first(env.DB, `SELECT ${nameField} as name FROM ${table} WHERE id = ?1`, id);
    if (!existing) return errorJson("\u0627\u0644\u0633\u062C\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.", 404);
    await run(env.DB, `DELETE FROM ${table} WHERE id = ?1`, id);
    await logActivity(env, user, table, "delete", `\u062D\u0630\u0641 ${labelSingular}: ${existing.name}`);
    return json({ ok: true });
  }
  return { list: list11, create: create11, update: update8, remove: remove9 };
}

// ../zc/src/routes/bridges.js
var { list: list5, create: create5, update: update3, remove: remove3 } = makeSimpleResource({
  table: "bridges",
  fields: ["name", "bridge_type", "location", "canal_name", "span", "width", "load", "material", "build_year", "condition", "notes", "lat", "lng"],
  requiredFields: ["name"],
  labelSingular: "\u0643\u0628\u0631\u064A",
  writeRole: "editor"
});

// ../zc/src/routes/wells.js
var wells_exports = {};
__export(wells_exports, {
  create: () => create6,
  list: () => list6,
  remove: () => remove4,
  update: () => update4
});
var { list: list6, create: create6, update: update4, remove: remove4 } = makeSimpleResource({
  table: "wells",
  fields: ["name", "district", "location", "purpose", "depth", "diameter", "water_level", "design_capacity", "actual_capacity", "pump_type", "pump_power", "drill_year", "condition", "notes", "lat", "lng"],
  requiredFields: ["name"],
  labelSingular: "\u0628\u0626\u0631",
  writeRole: "editor"
});

// ../zc/src/routes/drains.js
var drains_exports = {};
__export(drains_exports, {
  create: () => create7,
  list: () => list7,
  remove: () => remove5,
  update: () => update5
});
var { list: list7, create: create7, update: update5, remove: remove5 } = makeSimpleResource({
  table: "drains",
  fields: ["name", "eng", "bank", "canal_name", "length", "zomam", "lat", "lng", "notes"],
  requiredFields: ["name", "eng"],
  labelSingular: "\u0645\u0635\u0631\u0641",
  writeRole: "editor"
});

// ../zc/src/routes/members.js
var members_exports = {};
__export(members_exports, {
  create: () => create8,
  list: () => list8,
  remove: () => remove6,
  update: () => update6
});
var { list: list8, create: create8, update: update6, remove: remove6 } = makeSimpleResource({
  table: "members",
  fields: ["name", "phone", "national_id", "directorate", "village", "role", "masqa", "holding"],
  requiredFields: ["name", "phone"],
  labelSingular: "\u0639\u0636\u0648",
  writeRole: "editor"
});

// ../zc/src/routes/news.js
var news_exports = {};
__export(news_exports, {
  create: () => create9,
  list: () => list9,
  remove: () => remove7,
  update: () => update7
});
async function list9(request, env) {
  const user = await requireRole(request, env, "viewer");
  if (user instanceof Response) return user;
  const rows = await all(env.DB, "SELECT * FROM news ORDER BY created_at DESC");
  return json(rows);
}
async function create9(request, env) {
  const user = await requireRole(request, env, "editor");
  if (user instanceof Response) return user;
  const b = await request.json().catch(() => null);
  if (!b || !b.title || !b.body) return errorJson("\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0639\u0646\u0648\u0627\u0646 \u0648\u0646\u0635 \u0627\u0644\u062E\u0628\u0631.");
  const id = b.id || newId();
  const dateString = b.date_string || (/* @__PURE__ */ new Date()).toLocaleDateString("ar-EG");
  await run(
    env.DB,
    `INSERT INTO news (id,title,body,type,date_string) VALUES (?1,?2,?3,?4,?5)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, body=excluded.body, type=excluded.type, updated_at=datetime('now')`,
    id,
    b.title,
    b.body,
    b.type || "\u0639\u0627\u0645",
    dateString
  );
  await logActivity(env, user, "news", "create", `\u0646\u0634\u0631 \u062E\u0628\u0631: ${b.title}`);
  return json({ id }, 201);
}
async function update7(request, env, id) {
  const user = await requireRole(request, env, "editor");
  if (user instanceof Response) return user;
  const existing = await first(env.DB, "SELECT id FROM news WHERE id = ?1", id);
  if (!existing) return errorJson("\u0627\u0644\u0633\u062C\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.", 404);
  const b = await request.json().catch(() => null);
  if (!b || !b.title || !b.body) return errorJson("\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0639\u0646\u0648\u0627\u0646 \u0648\u0646\u0635 \u0627\u0644\u062E\u0628\u0631.");
  await run(env.DB, `UPDATE news SET title=?2, body=?3, type=?4, updated_at=datetime('now') WHERE id=?1`, id, b.title, b.body, b.type || "\u0639\u0627\u0645");
  await logActivity(env, user, "news", "update", `\u0639\u062F\u0651\u0644 \u062E\u0628\u0631: ${b.title}`);
  return json({ ok: true });
}
async function remove7(request, env, id) {
  const user = await requireRole(request, env, "editor");
  if (user instanceof Response) return user;
  const existing = await first(env.DB, "SELECT title FROM news WHERE id = ?1", id);
  if (!existing) return errorJson("\u0627\u0644\u0633\u062C\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.", 404);
  await run(env.DB, "DELETE FROM news WHERE id = ?1", id);
  await logActivity(env, user, "news", "delete", `\u062D\u0630\u0641 \u062E\u0628\u0631: ${existing.title}`);
  return json({ ok: true });
}

// ../zc/src/routes/users.js
var ROLE_LABEL = { admin: "\u0645\u062F\u064A\u0631 \u0639\u0627\u0645", editor: "\u0645\u062F\u062E\u0644 \u0628\u064A\u0627\u0646\u0627\u062A", viewer: "\u0645\u0634\u0627\u0647\u062F \u0641\u0642\u0637" };
var USERNAME_RE2 = /^[a-z0-9._-]{3,30}$/;
var AUTH_EMAIL_DOMAIN = "internal.zimam";
async function list10(request, env) {
  const user = await requireRole(request, env, "admin");
  if (user instanceof Response) return user;
  const rows = await all(env.DB, "SELECT id, username, phone, email, has_real_email, display_name, role, created_at FROM users ORDER BY created_at DESC");
  return json(rows);
}
async function create10(request, env) {
  const user = await requireRole(request, env, "admin");
  if (user instanceof Response) return user;
  const b = await request.json().catch(() => null);
  if (!b || !b.name || !b.username || !b.password || !b.role) return errorJson("\u0645\u0646 \u0641\u0636\u0644\u0643 \u0623\u0643\u0645\u0644 \u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0648\u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629.");
  const username = String(b.username).trim().toLowerCase();
  if (!USERNAME_RE2.test(username)) return errorJson("\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0628\u062D\u0631\u0648\u0641 \u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0635\u063A\u064A\u0631\u0629/\u0623\u0631\u0642\u0627\u0645 \u0641\u0642\u0637 (3-30 \u062D\u0631\u0641\u0627\u064B)\u060C \u0628\u062F\u0648\u0646 \u0645\u0633\u0627\u0641\u0627\u062A.");
  if (b.password.length < 6) return errorJson("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0642\u0635\u064A\u0631\u0629 \u062C\u062F\u0627\u064B\u060C 6 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644.");
  if (!["admin", "editor", "viewer"].includes(b.role)) return errorJson("\u0635\u0644\u0627\u062D\u064A\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629.");
  const phone = b.phone ? String(b.phone).trim() : null;
  const hasRealEmail = !!b.email;
  const email = hasRealEmail ? String(b.email).trim().toLowerCase() : `${username}@${AUTH_EMAIL_DOMAIN}`;
  const dupUsername = await first(env.DB, "SELECT id FROM users WHERE username = ?1", username);
  if (dupUsername) return errorJson("\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0647\u0630\u0627 \u0645\u064F\u0633\u062A\u062E\u062F\u064E\u0645 \u0628\u0627\u0644\u0641\u0639\u0644\u060C \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0633\u0645 \u0622\u062E\u0631.");
  if (phone) {
    const dupPhone = await first(env.DB, "SELECT id FROM users WHERE phone = ?1", phone);
    if (dupPhone) return errorJson("\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0628\u0627\u064A\u0644 \u0647\u0630\u0627 \u0645\u0633\u062C\u064E\u0651\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0622\u062E\u0631.");
  }
  const { hash, salt } = await hashPassword(b.password);
  const id = newId();
  await run(
    env.DB,
    `INSERT INTO users (id,username,phone,email,has_real_email,password_hash,password_salt,display_name,role)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`,
    id,
    username,
    phone,
    email,
    hasRealEmail ? 1 : 0,
    hash,
    salt,
    b.name,
    b.role
  );
  await logActivity(env, user, "team", "create", `\u0623\u0636\u0627\u0641 \u0645\u0633\u062A\u062E\u062F\u0627\u064B \u062C\u062F\u064A\u062F\u0627\u064B: ${b.name} (${username}) - ${ROLE_LABEL[b.role] || b.role}`);
  return json({ id }, 201);
}
async function updateRole(request, env, id) {
  const user = await requireRole(request, env, "admin");
  if (user instanceof Response) return user;
  const b = await request.json().catch(() => null);
  if (!b || !["admin", "editor", "viewer"].includes(b.role)) return errorJson("\u0635\u0644\u0627\u062D\u064A\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629.");
  const target = await first(env.DB, "SELECT display_name FROM users WHERE id = ?1", id);
  if (!target) return errorJson("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.", 404);
  await run(env.DB, "UPDATE users SET role = ?2 WHERE id = ?1", id, b.role);
  await logActivity(env, user, "team", "update", `\u063A\u064A\u0651\u0631 \u0635\u0644\u0627\u062D\u064A\u0629 "${target.display_name}" \u0625\u0644\u0649 ${ROLE_LABEL[b.role] || b.role}`);
  return json({ ok: true });
}
async function resetPassword(request, env, id) {
  const user = await requireRole(request, env, "admin");
  if (user instanceof Response) return user;
  const b = await request.json().catch(() => null);
  if (!b || !b.password || b.password.length < 6) return errorJson("\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u062C\u062F\u064A\u062F\u0629 (6 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644) \u0645\u0637\u0644\u0648\u0628\u0629.");
  const target = await first(env.DB, "SELECT display_name FROM users WHERE id = ?1", id);
  if (!target) return errorJson("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.", 404);
  const { hash, salt } = await hashPassword(b.password);
  await run(env.DB, "UPDATE users SET password_hash = ?2, password_salt = ?3 WHERE id = ?1", id, hash, salt);
  await logActivity(env, user, "team", "update", `\u0623\u0639\u0627\u062F \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631: ${target.display_name}`);
  return json({ ok: true });
}
async function remove8(request, env, id) {
  const user = await requireRole(request, env, "admin");
  if (user instanceof Response) return user;
  const target = await first(env.DB, "SELECT display_name, role FROM users WHERE id = ?1", id);
  if (!target) return errorJson("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.", 404);
  if (target.role === "admin") {
    const adminsCount = (await first(env.DB, "SELECT COUNT(*) as c FROM users WHERE role = 'admin'")).c;
    if (adminsCount <= 1) return errorJson("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0622\u062E\u0631 \u0645\u062F\u064A\u0631 \u0639\u0627\u0645 \u0641\u064A \u0627\u0644\u0645\u0646\u0635\u0629. \u0623\u0636\u0641 \u0645\u062F\u064A\u0631\u0627\u064B \u0622\u062E\u0631 \u0623\u0648\u0644\u0627\u064B.");
  }
  await run(env.DB, "DELETE FROM users WHERE id = ?1", id);
  await logActivity(env, user, "team", "delete", `\u062D\u0630\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645: ${target.display_name}`);
  return json({ ok: true });
}

// ../zc/src/index.js
var STANDARD_RESOURCES = { masaqi: masaqi_exports, bridges: bridges_exports, wells: wells_exports, drains: drains_exports, members: members_exports, news: news_exports };
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    try {
      if (path === "/api/auth/login" && method === "POST") return login(request, env);
      if (path === "/api/auth/logout" && method === "POST") return logout();
      if (path === "/api/auth/me" && method === "GET") return me(request, env);
      if (path === "/api/auth/change-password" && method === "PUT") return changePassword(request, env);
      if (path === "/api/setup/status" && method === "GET") return status(request, env);
      if (path === "/api/setup" && method === "POST") return create(request, env);
      if (path === "/api/activity-log" && method === "GET") return list(request, env);
      let wp = path.match(/^\/api\/([a-z]+)\/wipe$/);
      if (wp && method === "POST") return wipe(request, env, wp[1]);
      for (const [name, mod] of Object.entries(STANDARD_RESOURCES)) {
        if (path === `/api/${name}` && method === "GET") return mod.list(request, env);
        if (path === `/api/${name}` && method === "POST") return mod.create(request, env);
        const m = path.match(new RegExp(`^/api/${name}/([^/]+)$`));
        if (m && method === "PUT") return mod.update(request, env, m[1]);
        if (m && method === "DELETE") return mod.remove(request, env, m[1]);
      }
      if (path === "/api/canals/count" && method === "GET") return count(request, env);
      if (path === "/api/canals" && method === "GET") return list4(request, env);
      if (path === "/api/canals" && method === "POST") return create4(request, env);
      let c = path.match(/^\/api\/canals\/([^/]+)$/);
      if (c && method === "PUT") return update2(request, env, c[1]);
      if (c && method === "DELETE") return remove2(request, env, c[1]);
      let ch = path.match(/^\/api\/canals\/([^/]+)\/history$/);
      if (ch && method === "GET") return listHistory(request, env, ch[1]);
      if (ch && method === "POST") return addHistory(request, env, ch[1]);
      if (path === "/api/tickets" && method === "GET") return list3(request, env);
      if (path === "/api/tickets" && method === "POST") return create3(request, env);
      let t = path.match(/^\/api\/tickets\/([^/]+)\/status$/);
      if (t && method === "PUT") return updateStatus(request, env, t[1]);
      if (path === "/api/users" && method === "GET") return list10(request, env);
      if (path === "/api/users" && method === "POST") return create10(request, env);
      let ur = path.match(/^\/api\/users\/([^/]+)\/role$/);
      if (ur && method === "PUT") return updateRole(request, env, ur[1]);
      let up = path.match(/^\/api\/users\/([^/]+)\/reset-password$/);
      if (up && method === "PUT") return resetPassword(request, env, up[1]);
      let ud = path.match(/^\/api\/users\/([^/]+)$/);
      if (ud && method === "DELETE") return remove8(request, env, ud[1]);
      if (!path.startsWith("/api/") && env.ASSETS) return env.ASSETS.fetch(request);
      return errorJson("Not found", 404);
    } catch (e) {
      console.error(e);
      return errorJson(`\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645: ${e.message || e}`, 500);
    }
  }
};

// ../pages-entry.js
async function onRequest(context) {
  return src_default.fetch(context.request, context.env);
}
export {
  onRequest
};
