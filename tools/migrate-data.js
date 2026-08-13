#!/usr/bin/env node
// =====================================================================
// tools/migrate-data.js — منصة زمام الجيزة (v0.8.4)
// يدمج نسخة احتياطية قديمة من زمام + نسخة احتياطية قديمة من سُقيا في
// ملف واحد يطابق شكل النسخة الاحتياطية الجديدة الموحَّدة (نفس الشكل
// اللي exportDatabaseBackup() في js/data/backup.js بيطلعه بالظبط)،
// جاهز يتاخد ويتحمَّل مباشرة عبر restoreDatabaseBackup() في صفحة
// الإعدادات على قاعدة البيانات الجديدة.
//
// الاستخدام:
//   node migrate-data.js <زمام-backup.json> <سُقيا-backup.json> <ناتج.json>
//
// من أين تجيب الملفين المدخلين:
//   - زمام: زرار "⬇️ تنزيل نسخة احتياطية كاملة" في صفحة الإعدادات
//     بالتطبيق القديم — بيطلع ملف واحد فيه كل المجموعات.
//   - سُقيا: زرار "📤 تصدير الكل (JSON)" في صفحة الإعدادات بالتطبيق
//     القديم — بيطلع ملف واحد فيه specs/bridges/linedCanals/wells/drains.
//
// أهم حاجة بتعملها الأداة دي: دمج canal_tracking (من زمام) مع
// specs + linedCanals (من سُقيا) في مجموعة "canals" الموحَّدة الجديدة —
// بمطابقة كل ترعة بالاسم (بعد تطبيع الاسم بنفس منطق سُقيا الأصلي
// coreName، عشان "ترعة X" و"فرع X" و"X" يتطابقوا صح). أي ترعة من غير
// تطابق (موجودة في مصدر واحد بس) بتتحفظ برضه، مفيش أي بيانات بتضيع.
// =====================================================================

const fs = require("fs");

// ---- نفس دالة تطبيع اسم الترعة المستخدمة في سُقيا الأصلية (coreName) ----
function coreName(n) {
    let x = (n || "").trim();
    x = x.replace(/^(ترعة|فرع|مسقة|وصلة|دليل|ذيل|إمتداد|مغذى)\s+/, "");
    x = x.replace(/^["']?\d+["']?\s*/, "");
    x = x.replace(/^من\s+["']?\d+["']?\s+/, "");
    x = x.replace(/^["']/, "");
    return x.trim().replace(/\s+/g, " ");
}

// ---- تطبيع الطوابع الزمنية من كل الأشكال المحتملة (Zimam compat SDK،
// Suqia modular SDK، أو نص ISO عادي) إلى شكل واحد موحَّد { __ts } ----
function normalizeTimestamp(v) {
    if (!v) return v;
    if (typeof v === "string") return { __ts: v };
    if (v.__ts) return v; // بالفعل بالشكل الصحيح (من نسخة زمام الاحتياطية)
    if (typeof v.seconds === "number") return { __ts: new Date(v.seconds * 1000).toISOString() };
    return v;
}

function readJson(path) {
    return JSON.parse(fs.readFileSync(path, "utf-8"));
}

function main() {
    const [, , zimamPath, suqiaPath, outPath] = process.argv;
    if (!zimamPath || !suqiaPath || !outPath) {
        console.error("الاستخدام: node migrate-data.js <زمام-backup.json> <سُقيا-backup.json> <ناتج.json>");
        process.exit(1);
    }

    const zimam = readJson(zimamPath);
    const suqia = readJson(suqiaPath);
    const zc = zimam.collections || {};
    const sc = suqia.collections || {};

    const output = {
        app: "منصة زمام الجيزة",
        version: "0.8.4",
        exported_at: new Date().toISOString(),
        migration_note: "تم إنشاؤه بواسطة tools/migrate-data.js من دمج نسخة زمام + نسخة سُقيا الاحتياطيتين.",
        collections: {},
    };

    // ---- مجموعات زمام التي لا تحتاج أي تحويل (نفس الاسم والحقول) ----
    output.collections.masaqi = zc.masaqi || [];
    output.collections.tickets = zc.tickets || [];
    output.collections.members = zc.members || [];
    output.collections.news = zc.news || [];

    // ---- team (زمام) → users (اسم موحَّد جديد فقط، بدون تغيير الحقول) ----
    output.collections.users = (zc.team || []).map(u => ({ ...u }));

    // ---- bridges / wells / drains (سُقيا) → نفس الاسم، مع تطبيع _id→id
    // وupdatedAt→updated_at ----
    function migrateSimpleSuqiaCollection(name) {
        return (sc[name] || []).map(r => {
            const { _id, updatedAt, ...rest } = r;
            const out = { id: _id || r.id, ...rest };
            if (updatedAt) out.updated_at = normalizeTimestamp(updatedAt);
            return out;
        });
    }
    output.collections.bridges = migrateSimpleSuqiaCollection("bridges");
    output.collections.wells = migrateSimpleSuqiaCollection("wells");
    output.collections.drains = migrateSimpleSuqiaCollection("drains");

    // ---- الدمج الأهم: canal_tracking (زمام) + specs + linedCanals (سُقيا)
    // → canals واحدة، بمطابقة الاسم عبر coreName() ----
    const canalTracking = zc.canal_tracking || [];
    const specs = sc.specs || [];
    const linedCanals = sc.linedCanals || [];

    // فهرس التبطين بالاسم المطبَّع، لسهولة المطابقة (نفس منطق سُقيا الأصلي)
    const liningByCore = new Map();
    linedCanals.forEach(l => {
        const key = coreName(l.name || "");
        if (key) liningByCore.set(key, l);
    });

    const canalsByCore = new Map(); // core name → السجل الموحَّد قيد البناء
    const usedTrackingIds = new Set();

    function buildLiningField(specOrTracking) {
        const key = coreName(specOrTracking.name || "");
        const lined = liningByCore.get(key);
        if (!lined) return { is_lined: false, lining_type: "", lined_length: "" };
        return {
            is_lined: true,
            lining_type: lined.liningType || "",
            lined_length: lined.linedLength || lined.totalLength || "",
        };
    }

    // 1) نبدأ من سجلات التطهير (canal_tracking) — هي الأساس لأنها الأكثر
    // ثراءً من ناحية حالة العمل الميداني (الحالة، تواريخ التطهير، السجل).
    canalTracking.forEach(c => {
        const key = coreName(c.name || "");
        const matchingSpec = specs.find(s => coreName(s.name || "") === key);
        const merged = {
            id: c.id,
            name: c.name,
            directorate: c.directorate,
            village: c.village || "",
            status: c.status,
            next_scheduled_date: c.next_scheduled_date || "",
            last_dredging_date: c.last_dredging_date || "",
            notes: c.notes || matchingSpec?.notes || "",
            updated_at: normalizeTimestamp(c.updated_at),
            // من الأورنيك الهندسي (سُقيا) لو فيه تطابق بالاسم:
            feeder_canal: matchingSpec?.canalName || matchingSpec?.feeder || "",
            bank: matchingSpec?.bank || "",
            length: matchingSpec?.length || "",
            command_area: matchingSpec?.zomam || "",
            discharge_rate: matchingSpec?.discharge || "",
            sections: Array.isArray(matchingSpec?.sections) ? matchingSpec.sections : [],
            lining: buildLiningField(matchingSpec || c),
            lat: matchingSpec?.lat || liningByCore.get(key)?.lat || "",
            lng: matchingSpec?.lng || liningByCore.get(key)?.lng || "",
            __history: c.__history || [],
        };
        canalsByCore.set(key, merged);
        if (matchingSpec) usedTrackingIds.add(coreName(matchingSpec.name || ""));
    });

    // 2) أي ترعة موجودة في الأورنيك الهندسي (سُقيا) بس مالهاش سجل تطهير
    // في زمام أصلاً (ترعة جديدة لسُقيا وحدها) — تتضاف كسجل جديد، بحالة
    // افتراضية "لا تحتاج لتطهير" لعدم وجود أي تاريخ عمل ميداني عليها.
    specs.forEach(s => {
        const key = coreName(s.name || "");
        if (canalsByCore.has(key)) return; // اتضافت بالفعل من الخطوة 1
        canalsByCore.set(key, {
            id: s._id || s.id,
            name: s.name,
            directorate: s.eng || "",
            village: "",
            status: "لا تحتاج لتطهير",
            next_scheduled_date: "",
            last_dredging_date: "",
            notes: s.notes || "",
            updated_at: normalizeTimestamp(s.updatedAt),
            feeder_canal: s.canalName || s.feeder || "",
            bank: s.bank || "",
            length: s.length || "",
            command_area: s.zomam || "",
            discharge_rate: s.discharge || "",
            sections: Array.isArray(s.sections) ? s.sections : [],
            lining: buildLiningField(s),
            lat: s.lat || "",
            lng: s.lng || "",
            __history: [],
        });
    });

    output.collections.canals = [...canalsByCore.values()];

    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

    const total = Object.values(output.collections).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`✅ تم الدمج بنجاح: ${outPath}`);
    console.log(`   المساقي: ${output.collections.masaqi.length} | الترع الموحَّدة: ${output.collections.canals.length} | البلاغات: ${output.collections.tickets.length}`);
    console.log(`   الأعضاء: ${output.collections.members.length} | الأخبار: ${output.collections.news.length} | المستخدمون: ${output.collections.users.length}`);
    console.log(`   الكباري: ${output.collections.bridges.length} | الآبار: ${output.collections.wells.length} | المصارف: ${output.collections.drains.length}`);
    console.log(`   الإجمالي: ${total} سجل.`);
    console.log(`\n⚠️ راجع الملف الناتج يدوياً قبل الاستيراد — خصوصاً الترع اللي اتدمجت من مصدرين (تأكد إن المطابقة بالاسم صحّت فعلاً ومفيش ترعتين مختلفتين اتدمجوا غلط في سجل واحد).`);
}

main();
