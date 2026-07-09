// ══════════════════════════════════════════
//  سُقيا — firebase-config.js
//  🔥 ضع بيانات Firebase بتاعتك هنا
// ══════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA_sYTYy0Qij0LpBHLAKAySKTFev9bjRKc",
  authDomain: "suqia-giza.firebaseapp.com",
  projectId: "suqia-giza",
  storageBucket: "suqia-giza.firebasestorage.app",
  messagingSenderId: "601238083730",
  appId: "1:601238083730:web:cf59116d9c005e335c2e4b",
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc, writeBatch,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

// ══ Session ══════════════════════════════
const SESSION_KEY = "suqia_user";
function saveSession(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}
function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}
function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function requireAuth() {
  const u = getSession();
  if (!u) {
    const depth = window.location.pathname.includes("/pages/") ? "../" : "./";
    window.location.href = depth + "index.html";
    return null;
  }
  return u;
}
function requireAdmin() {
  const u = requireAuth();
  if (u && u.role !== "admin") {
    window.location.href = "dashboard.html";
    return null;
  }
  return u;
}

// ══ Password hashing (SHA-256 + salt) ════
async function hashPassword(password) {
  const data = new TextEncoder().encode(password + "suqia_salt_giza_2025");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function verifyPassword(first, second) {
  if (/^[0-9a-f]{64}$/.test(second)) {
    return (await hashPassword(first)) === second;
  }
  try {
    const snap = await getDoc(doc(db, "users", first));
    if (!snap.exists()) return false;
    const storedHash = snap.data().passwordHash;
    return (await hashPassword(second)) === storedHash;
  } catch { return false; }
}

// ══ Auth ══════════════════════════════════
async function loginUser(username, password) {
  try {
    const snap = await getDoc(doc(db, "users", username.toLowerCase().trim()));
    if (!snap.exists()) return { ok: false, error: "اسم المستخدم غير موجود" };
    const data = snap.data();
    if (!(await verifyPassword(password, data.passwordHash)))
      return { ok: false, error: "كلمة المرور غير صحيحة" };
    const uid = username.toLowerCase().trim();
    return { ok: true, user: { id: uid, username: uid, name: data.name, role: data.role } };
  } catch (e) {
    return { ok: false, error: "خطأ في الاتصال بالخادم" };
  }
}

// ══ سجل النشاط (Activity Log) ══════════════
async function logActivity(action, meta = {}) {
  try {
    const session = getSession();
    await addDoc(collection(db, "activityLog"), {
      username: session?.id || session?.username || "—",
      name: session?.name || "—",
      action,
      meta,
      ts: serverTimestamp(),
    });
  } catch (e) {
    // لا نوقف تدفق التطبيق لو فشل تسجيل النشاط
    console.warn("logActivity failed:", e.message);
  }
}
async function getActivityLog(count = 100) {
  const q = query(collection(db, "activityLog"), orderBy("ts", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ══ Users CRUD ════════════════════════════
async function getUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function createUser(username, password, name, role) {
  const hash = await hashPassword(password);
  const ref = doc(db, "users", username.toLowerCase().trim());
  await setDoc(ref, {
    name,
    role,
    passwordHash: hash,
    createdAt: serverTimestamp(),
  });
}
async function updateUser(username, data) {
  await updateDoc(doc(db, "users", username), data);
}
async function deleteUser(username) {
  await deleteDoc(doc(db, "users", username));
}

// ══════════════════════════════════════════
//  CACHE SYSTEM
//  - يخزن البيانات في sessionStorage
//  - سريع جداً بعد أول تحميل
//  - بيتمسح أوتوماتيك لما حد يضيف/يعدل/يحذف
// ══════════════════════════════════════════
const CACHE_TTL = 5 * 60 * 1000; // 5 دقايق بالـ ms

function cacheKey(col) {
  return `suqia_cache_${col}`;
}
function cacheTime(col) {
  return `suqia_cache_${col}_time`;
}

function getCache(col) {
  try {
    const ts = parseInt(sessionStorage.getItem(cacheTime(col)) || "0");
    if (Date.now() - ts > CACHE_TTL) return null; // انتهت صلاحية الـ cache
    const raw = sessionStorage.getItem(cacheKey(col));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCache(col, data) {
  try {
    sessionStorage.setItem(cacheKey(col), JSON.stringify(data));
    sessionStorage.setItem(cacheTime(col), Date.now().toString());
  } catch (e) {
    // لو sessionStorage ممتلي — امسح قديم وحاول تاني
    clearCache();
    try {
      sessionStorage.setItem(cacheKey(col), JSON.stringify(data));
      sessionStorage.setItem(cacheTime(col), Date.now().toString());
    } catch {
      /* مش هيحصل حاجة، هيجيب من Firebase */
    }
  }
}

function clearCache(col) {
  if (col) {
    sessionStorage.removeItem(cacheKey(col));
    sessionStorage.removeItem(cacheTime(col));
  } else {
    // امسح كل الـ cache
    ["specs", "bridges", "linedCanals", "wells"].forEach((c) => {
      sessionStorage.removeItem(cacheKey(c));
      sessionStorage.removeItem(cacheTime(c));
    });
  }
}

// ══ Collections CRUD (مع Cache) ══════════
// ══════════════════════════════════════════
//  IndexedDB — نسخة احتياطية دائمة (تدعم العمل بدون إنترنت)
//  - sessionStorage فوق: سريع لكن بيتمسح لما التاب يتقفل
//  - IndexedDB تحت: أبطأ شوية لكن باقي حتى بعد إعادة فتح المتصفح،
//    وده اللي بيخلي التطبيق يقدر يعرض آخر بيانات معروفة لما مفيش إنترنت
// ══════════════════════════════════════════
const IDB_NAME = "suqia-offline";
const IDB_VERSION = 1;
const IDB_STORE = "collections";

function openIDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) { reject(new Error("IndexedDB غير مدعوم")); return; }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains(IDB_STORE)) idb.createObjectStore(IDB_STORE, { keyPath: "col" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSetCollection(col, data) {
  try {
    const idb = await openIDB();
    await new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put({ col, data, ts: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* IndexedDB مش متاح — تجاهل بصمت، مش حرج */ }
}
async function idbGetCollection(col) {
  try {
    const idb = await openIDB();
    return await new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(col);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch { return null; }
}
function isOnline() { return typeof navigator !== "undefined" ? navigator.onLine : true; }
async function getOfflineTimestamp(col) {
  const rec = await idbGetCollection(col);
  return rec ? rec.ts : null;
}

async function getCollection(col) {
  // 1. Cache أولاً
  const cached = getCache(col);
  if (cached) return cached;

  // 2. Firebase مع timeout 10 ثواني
  try {
    const snap = await Promise.race([
      getDocs(collection(db, col)),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Firebase timeout — تحقق من صلاحيات Firestore أو الاتصال")), 6000)
      ),
    ]);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
    setCache(col, data);
    idbSetCollection(col, data); // نسخة احتياطية دائمة — من غير ما ننتظرها
    return data;
  } catch (e) {
    // 3. مفيش اتصال أو فشل الطلب؟ جرّب آخر نسخة محفوظة محلياً
    const offline = await idbGetCollection(col);
    if (offline) return offline.data;
    throw e;
  }
}

async function addRecord(col, data) {
  await addDoc(collection(db, col), { ...data, updatedAt: serverTimestamp() });
  clearCache(col); // امسح الـ cache عشان يجيب البيانات الجديدة
}

async function updateRecord(col, id, data) {
  await updateDoc(doc(db, col, id), { ...data, updatedAt: serverTimestamp() });
  clearCache(col);
}

async function deleteRecord(col, id) {
  await deleteDoc(doc(db, col, id));
  clearCache(col);
}

// ══ قاعدة البيانات — تصدير/استيراد/صحة ══════════

const LAST_SYNC_KEY = 'suqia_last_sync';

function setLastSync(col) {
  try {
    const data = JSON.parse(localStorage.getItem(LAST_SYNC_KEY) || '{}');
    data[col] = new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(data));
  } catch {}
}
function getLastSync(col) {
  try {
    const data = JSON.parse(localStorage.getItem(LAST_SYNC_KEY) || '{}');
    return data[col] || null;
  } catch { return null; }
}
function getLastSyncAll() {
  try { return JSON.parse(localStorage.getItem(LAST_SYNC_KEY) || '{}'); }
  catch { return {}; }
}

async function exportCollectionData(col) {
  const snap = await getDocs(collection(db, col));
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
}

async function exportAllData() {
  const COLS = ['specs', 'bridges', 'linedCanals', 'wells'];
  const result = { version: '1.1.7', exportedAt: new Date().toISOString(), collections: {} };
  for (const col of COLS) {
    const snap = await getDocs(collection(db, col));
    result.collections[col] = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    setLastSync(col);
  }
  return result;
}

async function importCollectionData(col, docs, clearFirst = false) {
  if (clearFirst) {
    const snap = await getDocs(collection(db, col));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  let count = 0;
  for (const item of docs) {
    const { _id, id, ...data } = item;
    const docId = _id || id;
    if (docId) {
      await setDoc(doc(db, col, docId), { ...data, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, col), { ...data, updatedAt: serverTimestamp() });
    }
    count++;
  }
  clearCache(col);
  setLastSync(col);
  return count;
}

async function checkFirebaseHealth() {
  const start = Date.now();
  try {
    await getDocs(collection(db, 'users'));
    return { ok: true, latency: Date.now() - start, error: null };
  } catch(e) {
    if (e.code === 'permission-denied') {
      return { ok: true, latency: Date.now() - start, error: 'permission-denied' };
    }
    return { ok: false, latency: Date.now() - start, error: e.message };
  }
}

async function getCollectionCount(col) {
  try {
    const snap = await getDocs(collection(db, col));
    setLastSync(col);
    clearCache(col);
    return snap.size;
  } catch { return -1; }
}

async function forceSyncAll() {
  const COLS = ['specs', 'bridges', 'linedCanals', 'wells'];
  COLS.forEach(c => clearCache(c));
  const counts = {};
  for (const col of COLS) {
    try {
      const snap = await getDocs(collection(db, col));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a,b) => String(a.name||'').localeCompare(String(b.name||''),'ar'));
      setCache(col, data);
      setLastSync(col);
      counts[col] = data.length;
    } catch { counts[col] = -1; }
  }
  return counts;
}

async function deleteAllCollectionData(col) {
  const snap = await getDocs(collection(db, col));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  clearCache(col);
}

export {
  addRecord, clearCache, clearSession, createUser, db, deleteRecord, deleteUser,
  checkFirebaseHealth, deleteAllCollectionData, exportAllData, exportCollectionData, forceSyncAll, getActivityLog, getCollection, getCollectionCount, getLastSync, getLastSyncAll, getOfflineTimestamp, getSession, getUsers, hashPassword, importCollectionData, isOnline, logActivity, loginUser, requireAdmin, requireAuth, saveSession, setLastSync, updateRecord, updateUser, verifyPassword
};

