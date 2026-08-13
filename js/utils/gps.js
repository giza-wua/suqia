// =====================================================================
// utils/gps.js
// التقاط الموقع الجغرافي (GPS) من متصفح الجهاز وتعبئته في حقل نصي.
// =====================================================================

import { showAlert } from './modal.js';
import { showToast } from './toast.js';

export function captureGPS(inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (!navigator.geolocation) { showAlert("متصفحك لا يدعم تحديد الموقع GPS."); return; }
    btn.textContent = "⏳ جاري...";
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            input.value = `${pos.coords.latitude.toFixed(7)}, ${pos.coords.longitude.toFixed(7)}`;
            btn.textContent = "✅ تم";
            btn.classList.add("success");
            btn.disabled = false;
            setTimeout(() => { btn.textContent = "📍 التقاط"; btn.classList.remove("success"); }, 3000);
            showToast("📍 تم التقاط الموقع!");
        },
        () => { showAlert("تعذر تحديد الموقع، تأكد من تفعيل خدمة الموقع على جهازك."); btn.textContent = "📍 التقاط"; btn.disabled = false; },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// نفس الفكرة، لكن للنماذج اللي فيها خط عرض/طول في حقلين منفصلين (الترع،
// الكباري، الآبار، المصارف) بدل حقل نصي واحد مجمَّع.
export function captureGPSSeparate(latId, lngId, btnId) {
    const latInput = document.getElementById(latId);
    const lngInput = document.getElementById(lngId);
    const btn = document.getElementById(btnId);
    if (!navigator.geolocation) { showAlert("متصفحك لا يدعم تحديد الموقع GPS."); return; }
    const original = btn.innerHTML;
    btn.textContent = "⏳ جاري...";
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            latInput.value = pos.coords.latitude.toFixed(7);
            lngInput.value = pos.coords.longitude.toFixed(7);
            btn.textContent = "✅ تم";
            btn.classList.add("success");
            btn.disabled = false;
            setTimeout(() => { btn.innerHTML = original; btn.classList.remove("success"); }, 3000);
            showToast("📍 تم التقاط الموقع!");
        },
        () => { showAlert("تعذر تحديد الموقع، تأكد من تفعيل خدمة الموقع على جهازك."); btn.innerHTML = original; btn.disabled = false; },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}
