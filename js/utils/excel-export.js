// =====================================================================
// utils/excel-export.js
// تصدير أي جدول HTML إلى ملف Excel (.xlsx)، وتنزيل قوالب Excel جاهزة
// لاستيراد بيانات المساقي والأعضاء — يُستخدم في كل أقسام البيانات
// (المساقي، البلاغات، الأعضاء، الأخبار، الترع).
// يعتمد على مكتبة XLSX المُحمّلة كـ <script> عادي في index.html.
// =====================================================================

import { showToast } from './toast.js';

// أسماء عناوين الأعمدة التي تُعتبر "إجراءات" ولا تُصدَّر إلى Excel،
// لأنها مجرد أزرار تعديل/حذف ولا تمثل بيانات فعلية مفيدة في التقرير.
const ACTIONS_COLUMN_LABELS = ["إجراءات", "إجراء"];

// تفعيل اتجاه الورقة بالكامل من اليمين لليسار (وليس فقط محاذاة النص)،
// بحيث تُفتح كل ملفات Excel المُصدَّرة من المنصة بشكل عربي سليم تلقائياً.
function applyRtlSheetView(workbook) {
    workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        if (sheet) sheet["!views"] = [{ RTL: true }];
    });
}

export function exportTableToExcel(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;

    // نعمل على نسخة من الجدول فقط (بدون التأثير على الجدول المعروض على الشاشة)
    // لحذف عمود "الإجراءات" منها قبل التصدير، لأنه مجرد أزرار تعديل/حذف.
    const clone = table.cloneNode(true);
    const headerCells = Array.from(clone.querySelectorAll("thead th"));
    const actionsIndex = headerCells.findIndex((th) => ACTIONS_COLUMN_LABELS.includes(th.textContent.trim()));
    if (actionsIndex !== -1) {
        clone.querySelectorAll("tr").forEach((row) => {
            const cell = row.children[actionsIndex];
            if (cell) cell.remove();
        });
    }

    const wb = XLSX.utils.table_to_book(clone, { sheet: "Sheet1" });
    applyRtlSheetView(wb);
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast("📥 تم التصدير.");
}

// ============ قوالب Excel جاهزة للاستيراد ============
// عناوين كل قالب مطابقة تماماً للأعمدة التي تقرأها دوال الاستيراد
// (handleExcelImport في data/masaqi.js وhandleExcelImportMembers في
// data/members.js)، لضمان عدم حدوث أي مشكلة عند تعبئة القالب وإعادة
// استيراده مرة أخرى.
const EXCEL_TEMPLATES = {
    masaqi: {
        headers: ["المسقى", "الهندسة", "القرية", "الترعة", "الزمام", "الطول", "الحالة", "تاريخ التطهير", "الموقع"],
        filename: "قالب_استيراد_المساقي",
    },
    members: {
        headers: ["الاسم", "الهاتف", "الرقم القومي", "الهندسة", "القرية", "الصفة", "المسقى", "الحيازة"],
        filename: "قالب_استيراد_الأعضاء",
    },
    canals: {
        headers: ["الترعة", "الهندسة", "الترعة المغذية", "البر", "الطول", "الزمام", "القنن المائي", "الحالة", "آخر تطهير", "الموعد القادم", "خط العرض", "خط الطول", "ملاحظات"],
        filename: "قالب_استيراد_الترع",
    },
    bridges: {
        headers: ["اسم الكبري", "النوع", "الموقع", "الترعة/المصرف", "الفتحة", "العرض", "الحمل", "مادة الإنشاء", "سنة الإنشاء", "الحالة", "خط العرض", "خط الطول", "ملاحظات"],
        filename: "قالب_استيراد_الكباري",
    },
    drains: {
        headers: ["اسم المصرف", "الهندسة", "البر", "المصرف المغذي", "الطول", "الزمام", "خط العرض", "خط الطول", "ملاحظات"],
        filename: "قالب_استيراد_المصارف",
    },
    wells: {
        headers: ["اسم البئر", "المركز", "الموقع", "الغرض", "العمق", "القطر", "المنسوب الحرج", "الطاقة التصميمية", "الطاقة الفعلية", "نوع الطلمبة", "قدرة الطلمبة", "سنة الحفر", "الحالة", "خط العرض", "خط الطول", "ملاحظات"],
        filename: "قالب_استيراد_الآبار",
    },
};

export function downloadExcelTemplate(type) {
    const template = EXCEL_TEMPLATES[type];
    if (!template) return;
    const ws = XLSX.utils.aoa_to_sheet([template.headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    applyRtlSheetView(wb);
    XLSX.writeFile(wb, `${template.filename}.xlsx`);
    showToast("📋 تم تنزيل القالب، يرجى تعبئته ثم استيراده من نفس الصفحة.");
}
