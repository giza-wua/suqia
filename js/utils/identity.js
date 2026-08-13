// =====================================================================
// utils/identity.js
// دوال توحيد صيغة "اسم المستخدم" و"رقم الموبايل" — تُستخدم في كل من
// تسجيل الدخول (auth.js) وإضافة مستخدم جديد (data/team.js)، لضمان أن
// نفس القيمة تُطابق نفسها دائماً بغض النظر عن طريقة كتابتها (حروف
// كبيرة/صغيرة، مسافات، صيغة الرقم الدولي +20 أو 0020 أو محلي).
// =====================================================================

export function normalizeUsername(u) {
    return (u || "").trim().toLowerCase().replace(/\s+/g, "");
}

// يُرجع دائماً صيغة محلية مصرية موحّدة: 01XXXXXXXXX (11 رقم)، أو null
// إن لم يكن الإدخال يشبه رقم موبايل مصري على الإطلاق.
export function normalizePhone(p) {
    let digits = (p || "").replace(/[^\d]/g, "");
    if (digits.startsWith("0020")) digits = digits.slice(4);
    else if (digits.startsWith("20") && digits.length >= 12) digits = digits.slice(2);
    if (digits.length === 10 && digits.startsWith("1")) digits = "0" + digits;
    if (/^01[0-9]{9}$/.test(digits)) return digits;
    return null;
}
