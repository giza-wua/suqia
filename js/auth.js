// =====================================================================
// auth.js — نفس الأسماء والسلوك المُصدَّرة بالظبط (isAdmin, isDataEditor,
// loginUser, logoutUser, requireAuth) عشان باقي الكود (data/*.js
// والصفحات) ميحتاجش أي تعديل. الفرق الداخلي فقط: الجلسة بقت عبر
// /api/auth/* بدل Firebase Auth SDK.
// =====================================================================

import { apiGet, apiPost, apiPut } from "./services/api.js";

export function isAdmin() { return window.currentRole === "admin"; }
export function isDataEditor() { return window.currentRole === "admin" || window.currentRole === "editor"; }

// تُستخدَم من admin/login.html — اسم المستخدم فقط (قرار نهائي: طريقة دخول واحدة موحَّدة، الموبايل بيانات تواصل فقط)
export async function loginUser(username, password) {
    return apiPost("/auth/login", { username, password }); // برجّع {id, display_name, role, username} أو يرمي Error برسالة عربية جاهزة
}

// أول مرة بيتفتح فيها الموقع (قاعدة بيانات فاضية من المستخدمين):
// checkNeedsSetup() بترجع true، ولازم نوجّه المستخدم لصفحة setup.html.
export async function checkNeedsSetup() {
    try {
        const { needsSetup } = await apiGet("/setup/status");
        return needsSetup;
    } catch {
        return false; // في حالة أي خطأ اتصال، ماتحولش لسِتب غصب — سيب المستخدم في صفحة الدخول العادية
    }
}

export async function completeSetup(displayName, username, password) {
    return apiPost("/setup", { display_name: displayName, username, password });
}

// أي مستخدم (أي صلاحية) يقدر يغيّر كلمة مروره بنفسه — مهم جداً أول
// حساب مدير عام بيتزرع مباشرة في D1 بكلمة مرور مؤقتة، وده الطريق
// الوحيد لتغييرها لواحدة نهائية من غير الرجوع للـ D1 تاني.
export async function changeMyPassword(currentPassword, newPassword) {
    return apiPut("/auth/change-password", { currentPassword, newPassword });
}

export async function logoutUser() {
    try { await apiPost("/auth/logout"); } catch { /* حتى لو فشل الطلب، حوّل المستخدم بره برضه */ }
    window.location.href = "login.html";
}

// حارس الدخول: يُستدعى في أول سطر من كل صفحة إدارة (عدا login.html).
export function requireAuth(minRole = null) {
    return new Promise((resolve) => {
        apiGet("/auth/me").then((profile) => {
            window.currentUid = profile.id;
            window.currentUsername = profile.username;
            window.currentRole = profile.role;
            window.currentUserDisplayName = profile.display_name || profile.username;

            if (minRole === "admin" && profile.role !== "admin") {
                document.body.innerHTML = `<div style="padding:60px 20px; text-align:center; font-family:Cairo,sans-serif;">
                    <h2 style="color:var(--danger,#9c3b2c);">🚫 لا تملك صلاحية الوصول لهذه الصفحة</h2>
                    <a href="dashboard.html" style="color:var(--nile-light,#1b6e64); font-weight:700;">الرجوع للوحة التحكم</a>
                </div>`;
                return;
            }
            resolve({ uid: profile.id, ...profile });
        }).catch(() => {
            window.location.href = `login.html?redirect=${encodeURIComponent(location.pathname.split("/").pop())}`;
        });
    });
}
