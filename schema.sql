PRAGMA foreign_keys = ON;
CREATE TABLE users (
    id              TEXT PRIMARY KEY,
    username        TEXT NOT NULL UNIQUE,
    phone           TEXT UNIQUE,
    email           TEXT NOT NULL,
    has_real_email  INTEGER NOT NULL DEFAULT 0,
    password_hash   TEXT NOT NULL,
    password_salt   TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    role            TEXT NOT NULL CHECK(role IN ('admin','editor','viewer')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE masaqi (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    directorate     TEXT NOT NULL,
    village         TEXT DEFAULT 'غير محدد',
    canal           TEXT DEFAULT 'غير محدد',
    status          TEXT,
    gps             TEXT,
    date            TEXT DEFAULT 'غير محدد',
    zamam           TEXT DEFAULT '0',
    length          TEXT DEFAULT '0',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_masaqi_directorate ON masaqi(directorate);
CREATE TABLE canals (
    id                   TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    directorate          TEXT NOT NULL,
    feeder_canal         TEXT,
    bank                 TEXT,
    length               TEXT,
    command_area         TEXT,
    discharge_rate       TEXT,
    lat                  TEXT,
    lng                  TEXT,
    status               TEXT,
    next_scheduled_date  TEXT,
    last_dredging_date   TEXT,
    sections_json        TEXT,
    is_lined             INTEGER NOT NULL DEFAULT 0,
    lining_type          TEXT,
    lined_length         TEXT,
    notes                TEXT,
    updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_canals_directorate ON canals(directorate);
CREATE TABLE canal_history (
    id            TEXT PRIMARY KEY,
    canal_id      TEXT NOT NULL REFERENCES canals(id) ON DELETE CASCADE,
    date          TEXT NOT NULL,
    status_after  TEXT NOT NULL,
    note          TEXT,
    recorded_by   TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_canal_history_canal ON canal_history(canal_id, created_at DESC);
CREATE TABLE bridges (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    bridge_type  TEXT,
    location     TEXT,
    canal_name   TEXT,
    span         TEXT,
    width        TEXT,
    load         TEXT,
    material     TEXT,
    build_year   TEXT,
    condition    TEXT,
    notes        TEXT,
    lat          TEXT,
    lng          TEXT,
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE wells (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    district          TEXT,
    location          TEXT,
    purpose           TEXT,
    depth             TEXT,
    diameter          TEXT,
    water_level       TEXT,
    design_capacity   TEXT,
    actual_capacity   TEXT,
    pump_type         TEXT,
    pump_power        TEXT,
    drill_year        TEXT,
    condition         TEXT,
    notes             TEXT,
    lat               TEXT,
    lng               TEXT,
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE drains (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    eng          TEXT NOT NULL,
    bank         TEXT,
    canal_name   TEXT,
    length       TEXT,
    zomam        TEXT,
    lat          TEXT,
    lng          TEXT,
    notes        TEXT,
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE members (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    phone         TEXT NOT NULL,
    national_id   TEXT,
    directorate   TEXT NOT NULL,
    village       TEXT DEFAULT 'غير محدد',
    role          TEXT,
    masqa         TEXT DEFAULT 'غير محدد',
    holding       TEXT DEFAULT '0',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_members_directorate ON members(directorate);
CREATE TABLE news (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    body         TEXT,
    type         TEXT,
    date_string  TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE tickets (
    id           TEXT PRIMARY KEY,
    farmer_name  TEXT NOT NULL,
    phone        TEXT DEFAULT 'غير مسجل',
    directorate  TEXT,
    watercourse  TEXT NOT NULL,
    issue_type   TEXT,
    gps          TEXT,
    description  TEXT DEFAULT 'لا يوجد وصف',
    status       TEXT NOT NULL DEFAULT 'جديد',
    date_string  TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE TABLE activity_log (
    id            TEXT PRIMARY KEY,
    module        TEXT NOT NULL,
    action        TEXT NOT NULL,
    username      TEXT,
    display_name  TEXT,
    role          TEXT,
    description   TEXT,
    at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_activity_at ON activity_log(at DESC);
