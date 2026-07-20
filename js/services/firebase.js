// =====================================================================
// services/firebase.js
// إعدادات Firebase والاتصال بـ Firestore و Firebase Authentication.
// يعتمد على مكتبة Firebase (compat v8) المُحمّلة كـ <script> عادي في
// index.html (وليس كـ ES Module)، لذلك نستخدم المتغير العام `firebase`
// مباشرة هنا بدون استيراد (import).
//
// تطبيق ثانوي (secondaryApp): يُستخدم فقط عند إنشاء المدير العام لحساب
// مستخدم جديد (Firebase Auth) — لأن إنشاء مستخدم بواسطة SDK العميل
// يُسجِّل دخول تلقائيًا بالحساب الجديد على نفس الـ app، وهو ما يُخرج
// المدير من جلسته الحالية. باستخدام تطبيق Firebase ثانٍ منفصل تمامًا،
// يظل المدير مسجّلاً دخوله بحسابه، بينما يُنشأ الحساب الجديد على
// التطبيق الثانوي، ثم نسجّل خروجه من هناك فورًا.
// =====================================================================

const firebaseConfig = {
    apiKey: "AIzaSyBX80GV9q0_KfkNrFnC62bLLZtab2gT2wY",
    authDomain: "zimam-giza.firebaseapp.com",
    projectId: "zimam-giza",
    storageBucket: "zimam-giza.firebasestorage.app",
    messagingSenderId: "128915979107",
    appId: "1:128915979107:web:5da00ffd26d6e3afb7b156",
    measurementId: "G-30D8Q0892P",
};

firebase.initializeApp(firebaseConfig);

export const db = firebase.firestore();
export const auth = firebase.auth();

// جلسة الدخول تبقى محفوظة على الجهاز بين الزيارات (نفس سلوك التطبيق
// السابق)، ما لم يسجّل المستخدم الخروج يدويًا.
// استمرارية الجلسة SESSION (وليس LOCAL): الجلسة تبقى محفوظة طوال ما
// التبويب/التطبيق مفتوح (بما في ذلك تحديث الصفحة Refresh)، لكنها تنتهي
// تلقائياً بمجرد إغلاق التطبيق فعلياً (تسجيل خروج تلقائي) — توازن بين
// راحة الاستخدام اليومي وعدم ترك جلسة مفتوحة للأبد على جهاز قد يُشارَك.
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch((err) => console.warn("Auth persistence:", err.code));

// تفعيل التخزين المؤقت لدعم العمل بدون اتصال إنترنت في الميدان
db.enablePersistence({ synchronizeTabs: true }).catch((err) => console.warn("Offline persistence:", err.code));

// التطبيق الثانوي — يُنشأ مرة واحدة فقط عند أول استخدام (Lazy) لتفادي
// أي تكلفة إضافية غير ضرورية إن لم تُستخدم ميزة "إضافة مستخدم" أصلاً.
let secondaryAppInstance = null;
export function getSecondaryAuth() {
    if (!secondaryAppInstance) {
        secondaryAppInstance = firebase.initializeApp(firebaseConfig, "Secondary");
    }
    return secondaryAppInstance.auth();
}
