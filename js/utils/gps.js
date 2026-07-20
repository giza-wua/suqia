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
