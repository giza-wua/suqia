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
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);
// تطبيق ثانوي منفصل: بيسمح للمسؤول ينشئ حساب مستخدم جديد بكلمة مرور حقيقية
// من غير ما جلسة دخول المسؤول الحالية تتأثر أو تتقفل
const secondaryApp = initializeApp(FIREBASE_CONFIG, "SuqiaSecondary");
const secondaryAuth = getAuth(secondaryApp);

// نطاق وهمي غير قابل للتوصيل — Firebase Auth محتاج شكل إيميل، والمستخدم مش هيشوفه أو يكتبه أبداً
const AUTH_EMAIL_DOMAIN = "suqia.local";
function usernameToEmail(username) {
  return `${username.toLowerCase().trim()}@${AUTH_EMAIL_DOMAIN}`;
}

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
  signOut(auth).catch(() => {}); // اقفل الجلسة الحقيقية في Firebase Auth كمان
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

// ══ Password hashing (SHA-256 + salt) ════
// ⚠️ دي بقت تُستخدم فقط للتحقق من حسابات قديمة لسه ما تنقلتش لـ Firebase Auth الحقيقي
// (شوف loginUser تحت — أول ما أي مستخدم قديم يسجّل دخول بنجاح، بيترحّل تلقائياً)
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

// ══ Auth (Firebase Authentication حقيقي) ══
// المستخدم بيكتب اسم مستخدم وكلمة مرور عادي زي ما هو دايماً —
// من تحت بنحوّل اسم المستخدم لإيميل وهمي (مش حقيقي ومش هيتبعت له أي حاجة)
// ونستخدم Firebase Auth الرسمي، عشان قواعد Firestore تقدر تتحقق من الهوية فعلياً
// بدل ما الحماية تبقى شكلية بس على مستوى الواجهة.
async function loginUser(username, password) {
  const uid = username.toLowerCase().trim();
  const email = usernameToEmail(uid);
  try {
    try {
      // 1) المسار العادي: حساب Firebase Auth حقيقي موجود بالفعل
      await signInWithEmailAndPassword(auth, email, password);
      const profileSnap = await getDoc(doc(db, "users", uid));
      if (!profileSnap.exists()) {
        await signOut(auth);
        return { ok: false, error: "الحساب غير مكتمل — تواصل مع المسؤول" };
      }
      const profile = profileSnap.data();
      return { ok: true, user: { id: uid, username: uid, name: profile.name, role: profile.role } };
    } catch (authErr) {
      if (authErr.code !== "auth/user-not-found" && authErr.code !== "auth/invalid-credential") {
        if (authErr.code === "auth/wrong-password") return { ok: false, error: "كلمة المرور غير صحيحة" };
        if (authErr.code === "auth/too-many-requests") return { ok: false, error: "محاولات كتير غلط — حاول تاني بعد شوية" };
        if (authErr.code === "auth/operation-not-allowed") return { ok: false, error: "⚠️ لازم تفعّل Email/Password من Firebase Console ← Authentication ← Sign-in method أولاً (راجع SETUP.md)" };
        if (authErr.code === "auth/network-request-failed") return { ok: false, error: "تعذّر الاتصال بالإنترنت — تحقق من الشبكة" };
        if (authErr.code === "permission-denied" || authErr.code === "auth/permission-denied") return { ok: false, error: "⚠️ قواعد Firestore لسه مش منشورة صح — راجع ملف firestore.rules في SETUP.md" };
        return { ok: false, error: `خطأ (${authErr.code || authErr.name || "غير معروف"}): ${authErr.message || ""}` };
      }
      // 2) لسه مفيش حساب Firebase Auth بالإيميل ده — يمكن مستخدم قديم لسه ما اتنقلش.
      // ⚠️ ملحوظة أمان: قاعدة users/{uid} بقت تتطلب تسجيل دخول (isSignedIn) — وده يعني
      // إن القراءة هنا (والمستخدم لسه مش مسجّل دخول أصلاً) هترجع permission-denied لأي
      // حساب لسه فعلاً محتاج ترحيل يدوي، بدل ما كانت متاحة للجميع زي الإصدارات القديمة.
      // ده تصرف مقصود لسد ثغرة كانت بتعرّض passwordHash لأي حد على الإنترنت.
      let legacySnap;
      try {
        legacySnap = await getDoc(doc(db, "users", uid));
      } catch (legacyReadErr) {
        if (legacyReadErr.code === "permission-denied") {
          return { ok: false, error: "هذا الحساب لسه محتاج ترحيل يدوي من المسؤول — تواصل معه لإعادة تفعيله" };
        }
        throw legacyReadErr;
      }
      if (!legacySnap.exists()) return { ok: false, error: "اسم المستخدم غير موجود" };
      const legacy = legacySnap.data();
      if (!legacy.passwordHash || !(await verifyPassword(password, legacy.passwordHash))) {
        return { ok: false, error: "كلمة المرور غير صحيحة" };
      }
      // كلمة المرور صح على النظام القديم — رحّل الحساب لـ Firebase Auth الحقيقي دلوقتي، بصمت
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        // امسح passwordHash القديم فوراً بعد الترحيل — من غير داعي يفضل متخزّن أبداً
        updateDoc(doc(db, "users", uid), { passwordHash: null }).catch(() => {});
        return { ok: true, user: { id: uid, username: uid, name: legacy.name, role: legacy.role } };
      } catch (migrateErr) {
        return { ok: false, error: `تعذّر ترقية الحساب (${migrateErr.code || migrateErr.message || "خطأ غير معروف"})` };
      }
    }
  } catch (fatalErr) {
    // شبكة توقف هنا: أي خطأ غير متوقع تماماً بيتصيد هنا بدل ما يوصل للواجهة كخطأ غامض
    if (fatalErr.code === "permission-denied") {
      return { ok: false, error: "⚠️ قواعد Firestore لسه مش منشورة صح — انسخ محتوى ملف firestore.rules وانشره من Firebase Console (راجع SETUP.md)" };
    }
    return { ok: false, error: `خطأ غير متوقع: ${fatalErr.code || fatalErr.name || ""} ${fatalErr.message || ""}`.trim() };
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
  const uid = username.toLowerCase().trim();
  const email = usernameToEmail(uid);
  const existing = await getDoc(doc(db, "users", uid));
  if (existing.exists()) throw new Error("اسم المستخدم موجود بالفعل");
  // بننشئ حساب Firebase Auth حقيقي على التطبيق الثانوي عشان جلسة المسؤول
  // الحالية متتأثرش أو تتقفل من غير قصد
  await createUserWithEmailAndPassword(secondaryAuth, email, password);
  await signOut(secondaryAuth);
  await setDoc(doc(db, "users", uid), { name, role, createdAt: serverTimestamp() });
  clearCache("users");
}

// تعديل بيانات مستخدم (اسم/صلاحية). تغيير كلمة المرور منفصل — شوف changeMyPassword تحت،
// لأن Firebase Auth (بدون خادم Admin) بيسمح بس للمستخدم يغيّر كلمة مروره هو نفسه وهو مسجّل دخول.
async function updateUser(uid, data) {
  await updateDoc(doc(db, "users", uid), data);
  clearCache("users");
}

// تغيير كلمة مرور المستخدم الحالي نفسه فقط (بيطلب كلمة المرور الحالية للتأكيد)
async function changeMyPassword(currentPassword, newPassword) {
  if (!auth.currentUser) throw new Error("يجب تسجيل الدخول أولاً");
  const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
  await reauthenticateWithCredential(auth.currentUser, cred);
  await updatePassword(auth.currentUser, newPassword);
}

// حذف مستخدم: بيشيل ملفه الشخصي (الاسم/الصلاحية) من Firestore، وده كافٍ عملياً لمنعه
// من الدخول (loginUser بيرفض أي حساب من غير ملف شخصي). حساب Firebase Auth نفسه
// بيفضل موجود تقنياً (حذفه فعلياً محتاج صلاحيات Admin SDK من سيرفر، مش متاحة في تطبيق
// بدون خادم زي ده) — لكن من غير ملف شخصي في Firestore، المستخدم ميقدرش يستخدم التطبيق خالص.
// ⚠️ ملاحظة: بسبب كده، لو حاولت تنشئ مستخدم جديد بنفس اسم المستخدم القديم بعد حذفه،
// هيفشل (لأن حساب Firebase Auth القديم لسه موجود) — استخدم اسم مستخدم مختلف، أو
// راجع SETUP.md لخطوة Cloud Function الاختيارية لو محتاج حذف كامل أو إعادة تعيين كلمة مرور.
async function deleteUser(uid) {
  await deleteDoc(doc(db, "users", uid));
  clearCache("users");
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
    ["specs", "bridges", "linedCanals", "wells", "drains"].forEach((c) => {
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

async function getCollection(col) {
  // 1. Cache أولاً
  const cached = getCache(col);
  if (cached) return cached;

  // 2. Firebase مع timeout 10 ثواني
  try {
    const snap = await Promise.race([
      getDocs(collection(db, col)),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Firebase timeout — تحقق من صلاحيات Firestore أو الاتصال")), 10000)
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
  const COLS = ['specs', 'bridges', 'linedCanals', 'wells', 'drains'];
  const result = { version: '1.4.0', exportedAt: new Date().toISOString(), collections: {} };
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
  const COLS = ['specs', 'bridges', 'linedCanals', 'wells', 'drains'];
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
  addRecord, changeMyPassword, clearCache, clearSession, createUser, deleteRecord, deleteUser,
  checkFirebaseHealth, deleteAllCollectionData, exportAllData, exportCollectionData, forceSyncAll, getActivityLog, getCollection, getCollectionCount, getLastSync, getLastSyncAll, getSession, getUsers, importCollectionData, logActivity, loginUser, requireAuth, saveSession, updateRecord, updateUser
};

