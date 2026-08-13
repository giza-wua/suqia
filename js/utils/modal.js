// =====================================================================
// utils/modal.js
// نافذة منبثقة عامة (Modal) تُستخدم لعرض تنبيه / تأكيد / إدخال نصي،
// بديلاً عن alert/confirm/prompt الافتراضية في المتصفح.
// =====================================================================

function _openModal(title, message, buttons) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-message").textContent = message;
    const actions = document.getElementById("modal-actions");
    actions.innerHTML = "";
    buttons.forEach((b) => {
        const btn = document.createElement("button");
        btn.textContent = b.label;
        btn.className = "btn-submit" + (b.primary ? "" : " modal-btn-secondary") + (b.danger ? " modal-btn-danger" : "");
        btn.style.flex = "1";
        btn.onclick = b.onClick;
        actions.appendChild(btn);
    });
    document.getElementById("modal-overlay").classList.add("show");
}

function _closeModal() { document.getElementById("modal-overlay").classList.remove("show"); }

export function showAlert(message, title) {
    return new Promise((resolve) => {
        _openModal(title || "تنبيه", message, [{ label: "حسناً", primary: true, onClick: () => { _closeModal(); resolve(); } }]);
    });
}

export function showConfirm(message, title) {
    return new Promise((resolve) => {
        _openModal(title || "تأكيد", message, [
            { label: "إلغاء", onClick: () => { _closeModal(); resolve(false); } },
            { label: "تأكيد", primary: true, danger: true, onClick: () => { _closeModal(); resolve(true); } },
        ]);
    });
}
