// =====================================================================
// utils/ui-helpers.js
// أدوات مساعدة عامة لواجهة المستخدم: طي/توسيع النماذج، إظهار/إخفاء
// كلمة المرور، حالة الاتصال بالإنترنت، صفوف التحميل/الفراغ في
// الجداول، وتعبئة قائمة المجرى المائي حسب الهندسة المختارة.
// =====================================================================

import { CANALS_DB } from '../data/canal-names-reference.js';
import { icon } from '../icons.js';

// ============ Debounce (لتخفيف إعادة رسم الجداول أثناء الكتابة) ============
// حقول البحث في المساقي/البلاغات/الترع/الأعضاء كانت تستدعي renderX()
// عند كل حرف (oninput مباشر)، فتُعاد بناء الجدول كله (innerHTML) في كل
// ضغطة — مع مئات السجلات (270+ ترعة مثلاً) هذا يسبب تهنيج ملحوظ على
// موبايلات ضعيفة في الميدان. debounce() تؤخر التنفيذ الفعلي حتى يتوقف
// المستخدم عن الكتابة لمدة قصيرة (افتراضي 250ms)، فيُعاد الرسم مرة
// واحدة بدل مرة لكل حرف، دون أي تغيير محسوس في تجربة الاستخدام.
export function debounce(fn, wait = 250) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
}

// ============ حماية من حقن أكواد HTML/JavaScript (XSS) ============
// أي نص يُدخله زائر أو مستخدم (اسم مزارع، وصف بلاغ، اسم عضو...) ثم
// يُعرض لاحقاً في جدول عبر innerHTML يجب تنقيته أولاً بهذه الدالة —
// وإلا يمكن لأي زائر (حتى بدون تسجيل دخول، عبر نموذج البلاغ العام
// مثلاً) إدخال كود HTML/JavaScript ينفَّذ في متصفح المدير عند عرضه.
export function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ============ تطبيع النصوص قبل المقارنة (فلاتر الهندسة إلخ) ============
// بيانات مستوردة من نسخ احتياطية قديمة (سُقيا/Firebase) أو ملفات Excel
// ممكن يكون فيها مسافات زايدة في الأول/الآخر، مسافات مزدوجة، أو نفس
// النص بترميز Unicode مختلف (NFC مقابل NFD) رغم إنه يبان مطابق تماماً
// للعين — فمقارنة `===` المباشرة بتفشل تفشل صامتة (الفلتر بيبان شغال
// بس ملوش أي تأثير). كل فلاتر "الهندسة" بتستخدم الدالة دي بدل المقارنة
// المباشرة عشان تتحمّل الفروق دي.
export function normalizeText(value) {
    return (value ?? "").toString().normalize("NFC").trim().replace(/\s+/g, " ");
}

// ============ مزامنة قائمة "الهندسة" في الفلتر مع البيانات الفعلية ============
// قائمة الفلتر بتتبني من نفس الـ 6 هندسات المعروفة (ثابتة في الـ HTML)،
// لكن سجلات قديمة (مستوردة من سُقيا الأصلية، أو مُستعادة من نسخة
// احتياطية قبل توحيد الأسماء) ممكن يكون فيها قيمة هندسة مش من ضمن الـ
// 6 دول أصلاً (اسم مختلف شوية أو ناقص "هندسة ري")، فالسجل ده مش هيتفلتر
// أبداً لأي هندسة تختارها لأنه مفيهوش خيار مطابق له في القائمة. الدالة
// دي بتضيف أي قيمة هندسة موجودة فعلياً في البيانات ومش موجودة في
// القائمة الثابتة، عشان أي سجل حقيقي يبقى قابل للفلترة بالظبط.
export function syncDirectorateFilterOptions(selectId, records, directorateKey = "directorate") {
    const select = document.getElementById(selectId);
    if (!select) return;
    const known = new Set(Array.from(select.options).map(o => normalizeText(o.value || o.textContent)));
    const extras = new Set();
    records.forEach(r => {
        const v = normalizeText(r[directorateKey]);
        if (v && !known.has(v)) extras.add(v);
    });
    if (extras.size === 0) return;
    const current = select.value;
    [...extras].sort((a, b) => a.localeCompare(b, "ar")).forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        select.appendChild(opt);
    });
    select.value = current;
}

// ============ منع الإرسال المزدوج لأزرار الحفظ ============
// تُستدعى فوراً عند بدء عملية حفظ (قبل انتظار Firestore)، وتُعاد حالة
// الزر الطبيعية بعد انتهاء العملية بنجاح أو فشل (resetButtonLoading).
export function setButtonLoading(btnId, loadingText) {
    const btn = document.getElementById(btnId);
    if (!btn || btn.disabled) return;
    btn.dataset.originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = loadingText;
}
export function resetButtonLoading(btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = false;
    if (btn.dataset.originalText) { btn.textContent = btn.dataset.originalText; delete btn.dataset.originalText; }
}

// ============ تمييز الحقول الناقصة/الخاطئة بصرياً ============
// بديل أوضح من نافذة تنبيه منبثقة فقط: يلوّن الحقول الناقصة بالأحمر
// ويمرّر الشاشة لأول حقل منها، وتُزال العلامة الحمراء تلقائياً بمجرد
// ما يبدأ المستخدم الكتابة فيه.
export function markInvalidFields(ids) {
    ids.forEach((id, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add("field-invalid");
        const clear = () => { el.classList.remove("field-invalid"); el.removeEventListener("input", clear); el.removeEventListener("change", clear); };
        el.addEventListener("input", clear, { once: true });
        el.addEventListener("change", clear, { once: true });
        if (i === 0) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
}
export function clearInvalidFields(ids) {
    ids.forEach(id => document.getElementById(id)?.classList.remove("field-invalid"));
}

// ============ الطي/التوسيع للنماذج (لتقليل الازدحام) ============
export function setCollapseState(key, open) {
    const card = document.getElementById("collapse-" + key);
    if (!card) return;
    const body = card.querySelector(".collapse-body");
    if (!body) { card.classList.toggle("open", open); return; }
    if (open) {
        card.classList.add("open");
        body.style.maxHeight = body.scrollHeight + "px";
        const onEnd = (e) => {
            if (e.propertyName === "max-height" && card.classList.contains("open")) {
                body.style.maxHeight = "none";
            }
            body.removeEventListener("transitionend", onEnd);
        };
        body.addEventListener("transitionend", onEnd);
    } else {
        body.style.maxHeight = body.scrollHeight + "px";
        void body.offsetHeight; // إعادة تدفق لضمان قيمة بداية صحيحة قبل التحريك
        card.classList.remove("open");
        body.style.maxHeight = "0px";
    }
}

export function toggleCollapse(key, forceClose) {
    const card = document.getElementById("collapse-" + key);
    if (!card) return;
    if (forceClose) { setCollapseState(key, false); return; }
    setCollapseState(key, !card.classList.contains("open"));
}

export function togglePasswordVisibility(id, btn) {
    const input = document.getElementById(id);
    if (!input) return;
    if (input.type === "password") { input.type = "text"; btn.innerHTML = icon("eyeOff", 16); }
    else { input.type = "password"; btn.innerHTML = icon("eye", 16); }
}

// ============ حالة الاتصال بالإنترنت ============
export function updateOnlineStatus() {
    const banner = document.getElementById("offline-banner");
    if (!banner) return;
    banner.classList.toggle("show", !navigator.onLine);
}
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);

// ============ دوال مساعدة لعرض الجداول ============
export function loadingRow(colspan) { return `<tr><td colspan="${colspan}" style="text-align:center;padding:28px;color:var(--text-muted);">⏳ جاري تحميل البيانات...</td></tr>`; }
export function emptyRow(colspan, msg) { return `<tr><td colspan="${colspan}" style="text-align:center;padding:28px;color:var(--text-muted);">${msg || "لا توجد بيانات لعرضها"}</td></tr>`; }

// ============ دوال مساعدة عامة ============
export function updateWatercourseDropdown(prefix) {
    const dirSelect = document.getElementById(prefix + "-directorate");
    const waterSelect = document.getElementById(prefix + "-watercourse") || document.getElementById(prefix + "-name");
    if (!dirSelect || !waterSelect) return;
    const selectedDir = dirSelect.value;
    let placeholder = "اختر المجرى المائي";
    if (prefix === "ms") placeholder = "اختر المسقى";
    else if (prefix === "cn") placeholder = "اختر الترعة";
    waterSelect.innerHTML = `<option value="">${placeholder}</option>`;
    if (selectedDir && CANALS_DB[selectedDir]) {
        CANALS_DB[selectedDir].forEach((canal) => {
            waterSelect.innerHTML += `<option value="${canal}">${canal}</option>`;
        });
    }
    if (prefix === "ms") {
        waterSelect.innerHTML += '<option value="__OTHER__">✏️ أخرى (كتابة يدوية)</option>';
    }
    const otherInput = document.getElementById("ms-name-other");
    if (otherInput) { otherInput.style.display = "none"; otherInput.value = ""; }
    if (waterSelect.tagName === "SELECT") waterSelect.style.display = "";
}

export function handleMsNameOther() {
    const waterSelect = document.getElementById("ms-name");
    const otherInput = document.getElementById("ms-name-other");
    if (!waterSelect || !otherInput) return;
    if (waterSelect.value === "__OTHER__") {
        waterSelect.style.display = "none";
        otherInput.style.display = "";
        otherInput.focus();
    } else {
        otherInput.style.display = "none";
        otherInput.value = "";
        waterSelect.style.display = "";
    }
}

// نفس فكرة handleMsNameOther أعلاه، لكن لحقل "الصفة" في نموذج الأعضاء —
// تحويل الحقل من <input list> (datalist بدائي المظهر) إلى <select> بنفس
// شكل باقي القوائم في المنصة، مع خيار "✏️ أخرى" لإدخال صفة غير موجودة بالقائمة.
export function handleMemberRoleOther() {
    const roleSelect = document.getElementById("m-role");
    const otherInput = document.getElementById("m-role-other");
    if (!roleSelect || !otherInput) return;
    if (roleSelect.value === "__OTHER__") {
        roleSelect.style.display = "none";
        otherInput.style.display = "";
        otherInput.focus();
    } else {
        otherInput.style.display = "none";
        otherInput.value = "";
        roleSelect.style.display = "";
    }
}
