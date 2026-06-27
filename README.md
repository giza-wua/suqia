# سُقيا 💧
### منصة إدارة أصول ري الجيزة

---

## هيكل المشروع

```
suqia/
├── index.html              ← صفحة الدخول
├── css/
│   └── style.css           ← كل التصميم
├── js/
│   ├── firebase-config.js  ← الاتصال بـ Firebase + Auth + CRUD
│   └── shared.js           ← مكونات مشتركة (جدول، modal، toast)
└── pages/
    ├── dashboard.html      ← لوحة التحكم
    ├── specs.html          ← الأورنيك الهندسي
    ├── bridges.html        ← الكباري
    ├── canals.html         ← الترع المبطنة
    ├── wells.html          ← الآبار الجوفية
    └── settings.html       ← إدارة المستخدمين (admin فقط)
```

---

## خطوات الإعداد

### 1 — Firebase

1. افتح [console.firebase.google.com](https://console.firebase.google.com)
2. **Add project** → اكتب اسم → Continue × 2 → Create
3. **Authentication** → Get started → Email/Password → **لا تفعّل** (مش محتاجها)
4. **Firestore Database** → Create database → **Start in test mode** → Enable
5. ⚙️ Project Settings → Your apps → `</>` Web → Register
6. انسخ الـ config في `js/firebase-config.js`

### 2 — إضافة أول مدير (مرة واحدة فقط)

في **Firestore Console**:
- اضغط **Start collection** → ID: `users`
- Document ID: `admin` (أو أي اسم مستخدم تريده)
- أضف الحقول:

```
name         → (string) → ماجد محمد
role         → (string) → admin
passwordHash → (string) → [انظر تعليمات الهاش أدناه]
```

#### إزاي تعمل الهاش للباسورد؟

افتح المتصفح → Developer Tools (F12) → Console، واكتب:

```javascript
async function hash(p) {
  const data = new TextEncoder().encode(p + "suqia_salt_giza_2025");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}
hash("باسورد_هنا").then(console.log)
```

انسخ الناتج وحطه في حقل `passwordHash` في Firestore.

### 3 — Firestore Rules (مهم للأمان)

في Firestore → Rules، ضع:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> ملاحظة: ده للتطوير. للإنتاج تقدر تضيق الصلاحيات لاحقاً.

### 4 — التشغيل المحلي

```bash
cd suqia
python3 -m http.server 8000
```

افتح: `http://localhost:8000`

### 5 — رفع على GitHub Pages

```bash
git init
git add .
git commit -m "سُقيا v1.0"
git remote add origin https://github.com/USERNAME/suqia.git
git push -u origin main
```

في GitHub: Settings → Pages → Source: main → / (root) → Save

الموقع هيكون على:
`https://USERNAME.github.io/suqia/`

---

## المستخدمون

| الدور | الصلاحيات |
|-------|-----------|
| `admin` | عرض + إضافة + تعديل + حذف + إدارة المستخدمين |
| `viewer` | عرض فقط |

---

## البيانات في Firestore

| Collection | المحتوى |
|------------|---------|
| `users` | المستخدمون (username = document ID) |
| `specs` | الأورنيك الهندسي |
| `bridges` | الكباري |
| `linedCanals` | الترع المبطنة |
| `wells` | الآبار الجوفية |
