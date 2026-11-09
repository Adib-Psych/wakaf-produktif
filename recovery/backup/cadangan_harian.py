#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
 CADANGAN HARIAN FIRESTORE — Wakaf Produktif (resep resmi v2, 9 Nov 2026)
================================================================================
Pengganti `Paket Konsolidasi 26 Sep 2026/Backup Firestore/firestore_backup.py`
(v1, 24 Jun 2026, 14 koleksi). Menjawab Keluhan #37: koleksi payroll, entri,
perangkat, operasi dan pemrosesan upah yang lahir sesudah Juni belum tercakup.

APA YANG DICADANGKAN
  Daftar INKLUSI eksplisit (KOLEKSI) = semua koleksi yang dapat dibaca publik
  menurut firestore.rules, yaitu sumber data aplikasi saat ini. Daftar EKSKLUSI
  eksplisit (TERKUNCI) = penyimpanan kapabilitas/kebijakan/turunan yang memang
  ditutup Rules; isinya TIDAK pernah disimpan. Koleksi itu hanya DIPERIKSA: bila
  suatu hari terbaca publik, itu alarm keamanan (keluar 3) dan isinya dibuang.
  Daftar keduanya juga ditulis di CADANGAN_HARIAN.md.

KELUARAN (format v1 dipertahankan supaya pembaca lama tetap jalan)
  snapshots/<YYYY-MM-DD_HHMM>/raw/<koleksi>.json     bentuk asli REST (lossless)
                             /clean/<koleksi>.json   nilai ter-decode
                             /snapshot_combined.json
                             /README_SCHEMA.md
                             /Ringkasan_Audit_<tgl>.xlsx   (bila openpyxl ada)
                             /_status.json
                             /MANIFEST.json   BARU: jumlah dok + SHA-256 tiap berkas
  snapshots/LATEST.txt, backup_log.csv

KODE KELUAR
  0  lengkap dan terverifikasi
  2  ada koleksi inklusi yang gagal dibaca / di bawah jumlah minimum
  3  penyimpanan TERKUNCI ternyata terbaca publik (alarm keamanan)
  4  berkas yang ditulis tidak cocok dengan hash manifest
  5  cadangan tersimpan, tetapi ada PENYUSUTAN besar dibanding cadangan sebelumnya
  Selain 0 = pelaksana wajib mengirim notifikasi gagal kepada pemilik.

MODE LAIN
  --verifikasi <folder_snapshot>      cek ulang manifest (sebelum memakai untuk pulih)
  --latih-pulih <folder_snapshot> --emulator http://127.0.0.1:8080
                                      latihan pulih ke EMULATOR saja; produksi ditolak

TIDAK ADA KREDENSIAL. apiKey Firebase publik by-design; keamanan ada di Rules.
Cadangan berisi data operasional (nama pekerja, upah) — simpan hanya di Luna/Mac
atau tujuan pribadi yang disetujui pemilik, JANGAN di GitHub.
Pembacaan berurutan, bukan snapshot atomik: dokumen yang berubah selama proses
dicatat di _status.json (berubah_saat_cadangan).
================================================================================
"""
import argparse
import csv
import datetime
import hashlib
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

VERSI_RESEP = "2.0"
PROJECT_ID = "wakaf-ngantang"
API_KEY = "AIzaSyARd7KlzNLaRumTtdqR0j-jOnt6aZHyFKA"   # publik — sama dengan firebase-config.js
BASE_PRODUKSI = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

# ---------------------------------------------------------------------------
# INKLUSI — koleksi -> (deskripsi, kelompok, minimal dokumen)
# Minimal 1 = dokumen inti yang tidak boleh lenyap; 0 = boleh kosong (mis. belum dipakai).
# ---------------------------------------------------------------------------
KOLEKSI = {
    # data inti (v1)
    "laporan":            ("Laporan harian pekerja dan input Wakif (multi-dokumen).", "inti", 1),
    "workers":            ("Jejak last_active per pekerja.", "inti", 0),
    "upah":               ("Singleton active: daftar upah legacy per aktivitas.", "inti", 1),
    "cashbook":           ("Singleton active: arus kas.", "inti", 1),
    "opt_observations":   ("Singleton active: observasi OPT/hama.", "inti", 1),
    "panen_data":         ("Singleton active: data panen siklus berjalan.", "inti", 1),
    "panen_lots":         ("Singleton active: lot panen.", "inti", 1),
    "panen_sampling":     ("Sampling cherry per pohon (riset).", "inti", 1),
    "sop_status":         ("Status compliance SOP per bulan + buku riwayat harian.", "inti", 1),
    "distribusi_pic":     ("Singleton active: distribusi tugas per fase.", "inti", 1),
    "sop_master":         ("Singleton active: SOP Kalender (aktivitas_per_bulan).", "inti", 1),
    "worker_defs_custom": ("Singleton active: roster pekerja (aktif/pensiun).", "inti", 1),
    "milestones":         ("Singleton active: milestone publik Living Lab.", "inti", 1),
    "invoices":           ("Bukti pembayaran upah e-sign.", "inti", 1),
    # upah sesudah Okt 2026 (ADR-048/050)
    "wage_entitlements":    ("Hak upah yang terbentuk dari laporan.", "upah", 0),
    "wage_processing":      ("Status pemrosesan laporan menjadi hak upah.", "upah", 0),
    "wage_worker_bindings": ("Pengikatan pekerja untuk pemrosesan upah.", "upah", 0),
    "payroll_states":       ("Status bayar per hak upah.", "upah", 0),
    "payroll_events":       ("Peristiwa bayar (append-only), pasangan payroll_states.", "upah", 0),
    # entri, perangkat, operasi
    "report_heads":       ("Kepala versi laporan (koreksi).", "entri", 0),
    "entry_receipts":     ("Tanda terima entri staf.", "entri", 0),
    "device_reports":     ("Laporan dari perangkat pekerja (belum diverifikasi).", "entri", 0),
    "device_receipts":    ("Tanda terima laporan perangkat.", "entri", 0),
    "cabut_state":        ("Status inventarisasi cabut.", "entri", 0),
    "operation_events":   ("Peristiwa operasi berversi.", "operasi", 0),
    "operation_receipts": ("Tanda terima operasi berversi.", "operasi", 0),
}

# ---------------------------------------------------------------------------
# EKSKLUSI — ditutup Rules; hanya diperiksa, isinya tidak pernah disimpan.
# ---------------------------------------------------------------------------
TERKUNCI = {
    "audit_log":            "jejak audit append-only, baca dikunci Rules",
    "worker_tokens":        "token kapabilitas pekerja (rahasia akses)",
    "entry_grants":         "izin akun entri per uid (kapabilitas)",
    "payroll_grants":       "izin akun pembayaran per uid (kapabilitas)",
    "reader_grants":        "izin baca privat per uid (kapabilitas)",
    "payroll_targets":      "atestasi preflight pembayaran, hanya untuk sesi bayar",
    "payroll_policy":       "kebijakan sakelar pembayaran",
    "entry_policy":         "kebijakan sakelar entri",
    "device_entry_policy":  "kebijakan sakelar entri perangkat",
    "reader_policy":        "kebijakan pembaca privat",
    "operation_policy":     "kebijakan operasi berversi",
    "entry_roster":         "roster entri perangkat (diturunkan dari worker_defs_custom)",
    "operational_snapshot": "turunan publik yang dibangun ulang penerbit tepercaya",
}

AMBANG_SUSUT = 0.20    # penyusutan > 20% dibanding cadangan sebelumnya = alarm (keluar 5)
EXCEL_ORDER = ["laporan", "upah", "cashbook", "panen_data", "panen_lots", "panen_sampling",
               "opt_observations", "milestones", "distribusi_pic", "sop_status", "sop_master",
               "worker_defs_custom", "wage_entitlements", "payroll_states"]


# ---------------------------------------------------------------- dekode
def decode_value(v):
    if not isinstance(v, dict):
        return v
    if "stringValue" in v:    return v["stringValue"]
    if "integerValue" in v:   return int(v["integerValue"])
    if "doubleValue" in v:    return v["doubleValue"]
    if "booleanValue" in v:   return v["booleanValue"]
    if "timestampValue" in v: return v["timestampValue"]
    if "nullValue" in v:      return None
    if "referenceValue" in v: return v["referenceValue"]
    if "geoPointValue" in v:  return v["geoPointValue"]
    if "bytesValue" in v:     return v["bytesValue"]
    if "arrayValue" in v:
        return [decode_value(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v:
        return {k: decode_value(x) for k, x in v["mapValue"].get("fields", {}).items()}
    return v


def decode_doc(doc):
    out = {"_id": doc.get("name", "").split("/")[-1]}
    for k, v in doc.get("fields", {}).items():
        out[k] = decode_value(v)
    return out


def jumlah_rekaman(clean_docs):
    """Singleton active.data = daftar -> jumlah baris; selain itu jumlah dokumen."""
    for d in clean_docs:
        if d.get("_id") == "active" and isinstance(d.get("data"), list):
            return len(d["data"])
    return len(clean_docs)


# ---------------------------------------------------------------- jaringan
def _buka(url):
    req = urllib.request.Request(url, headers={"User-Agent": "wakaf-cadangan/2.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def ambil_koleksi(base, col):
    """-> (dokumen_mentah, galat_atau_None, kode_http). Semua halaman, atau galat."""
    docs, tok = [], None
    while True:
        url = f"{base}/{col}?key={API_KEY}&pageSize=300"
        if tok:
            url += "&pageToken=" + urllib.parse.quote(tok)
        try:
            body = _buka(url)
        except urllib.error.HTTPError as e:
            try:
                msg = json.loads(e.read().decode("utf-8")).get("error", {}).get("message", str(e))
            except Exception:
                msg = str(e)
            return docs, msg, e.code
        except Exception as e:
            return docs, str(e), 0
        docs.extend(body.get("documents", []))
        tok = body.get("nextPageToken")
        if not tok:
            return docs, None, 200


# ---------------------------------------------------------------- berkas
def sha256_berkas(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for blok in iter(lambda: f.read(1 << 20), b""):
            h.update(blok)
    return h.hexdigest()


def baca_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def tulis_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def verifikasi_manifest(run_dir):
    """-> daftar masalah (kosong = semua berkas cocok)."""
    mp = os.path.join(run_dir, "MANIFEST.json")
    if not os.path.exists(mp):
        return ["MANIFEST.json tidak ada"]
    man = baca_json(mp)
    masalah = []
    for rel, info in man.get("berkas", {}).items():
        p = os.path.join(run_dir, rel)
        if not os.path.exists(p):
            masalah.append(f"hilang: {rel}")
        elif sha256_berkas(p) != info["sha256"]:
            masalah.append(f"hash beda: {rel}")
    for col, info in man.get("koleksi", {}).items():
        p = os.path.join(run_dir, "raw", col + ".json")
        if os.path.exists(p):
            n = len(baca_json(p))
            if n != info["dokumen"]:
                masalah.append(f"jumlah dokumen {col}: {n}, manifest {info['dokumen']}")
    return masalah


def cadangan_sebelumnya(snap_root, stamp_sekarang):
    try:
        runs = sorted(d for d in os.listdir(snap_root)
                      if d < stamp_sekarang and os.path.exists(os.path.join(snap_root, d, "_status.json")))
    except FileNotFoundError:
        return None
    for d in reversed(runs):
        st = baca_json(os.path.join(snap_root, d, "_status.json"))
        if st.get("rekaman_per_koleksi"):
            return d, st["rekaman_per_koleksi"]
        # cadangan v1: hitung dari clean/
        rek = {}
        for col in KOLEKSI:
            p = os.path.join(snap_root, d, "clean", col + ".json")
            if os.path.exists(p):
                rek[col] = jumlah_rekaman(baca_json(p))
        if rek:
            return d, rek
    return None


# ---------------------------------------------------------------- README + Excel
def tulis_readme(path, now, all_clean, rekaman, gagal):
    L = ["# README — Cadangan Firestore Wakaf Produktif (resep v%s)\n" % VERSI_RESEP,
         "**Waktu (UTC):** %s  " % now.strftime("%Y-%m-%d %H:%M:%S"),
         "**Project:** `%s` · database `(default)`\n" % PROJECT_ID,
         "Folder `raw/` = bentuk asli REST (lossless, untuk pulih). `clean/` = nilai ter-decode "
         "untuk migrasi/analisis. Integritas: `MANIFEST.json` (SHA-256 setiap berkas).\n",
         "| Koleksi | Kelompok | Dokumen | Rekaman | Status | Deskripsi |", "|---|---|---|---|---|---|"]
    for col, (desc, grup, _m) in KOLEKSI.items():
        if col in all_clean:
            L.append("| `%s` | %s | %d | %d | OK | %s |" % (col, grup, len(all_clean[col]), rekaman[col], desc))
        else:
            L.append("| `%s` | %s | 0 | 0 | ⚠️ %s | %s |" % (col, grup, gagal.get(col, "gagal"), desc))
    L.append("\n## Dikecualikan dengan sengaja (ditutup Rules, isinya tidak disimpan)\n")
    for col, alasan in TERKUNCI.items():
        L.append("- `%s` — %s" % (col, alasan))
    L.append("\n> apiKey Firebase publik by-design; cadangan tidak memuat rahasia akses. Isinya tetap data "
             "operasional (nama pekerja, upah): simpan secara amanah, jangan diunggah ke GitHub.\n")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(L))


def tulis_excel(path, now, all_clean, rekaman):
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill
    except ImportError:
        return False, "openpyxl tidak terpasang (JSON tetap lengkap)"
    try:
        wb = Workbook()
        ws = wb.active
        ws.title = "INFO"
        ws["A1"] = "CADANGAN FIRESTORE — WAKAF PRODUKTIF"
        ws["A1"].font = Font(bold=True, size=14, color="2E5A34")
        ws["A3"], ws["B3"] = "Waktu (UTC)", now.strftime("%Y-%m-%d %H:%M:%S")
        ws["A4"], ws["B4"] = "Catatan", "JSON = jalur pulih resmi. Excel hanya untuk audit terbaca."
        fill, font = PatternFill("solid", fgColor="2E5A34"), Font(color="FFFFFF", bold=True)
        for i, h in enumerate(("Koleksi", "Kelompok", "Rekaman"), 1):
            c = ws.cell(6, i, h); c.fill = fill; c.font = font
        for r, (col, (_d, grup, _m)) in enumerate(KOLEKSI.items(), 7):
            ws.cell(r, 1, col); ws.cell(r, 2, grup); ws.cell(r, 3, rekaman.get(col, 0))
        for col in EXCEL_ORDER:
            docs = all_clean.get(col) or []
            recs = next((d["data"] for d in docs if d.get("_id") == "active" and isinstance(d.get("data"), list)), docs)
            recs = [x for x in recs if isinstance(x, dict)]
            if not recs:
                continue
            kol = []
            for x in recs:
                kol += [k for k in x if k not in kol]
            sh = wb.create_sheet(col[:31])
            for ci, k in enumerate(kol, 1):
                c = sh.cell(1, ci, k); c.fill = fill; c.font = font
            for ri, x in enumerate(recs, 2):
                for ci, k in enumerate(kol, 1):
                    v = x.get(k, "")
                    sh.cell(ri, ci, json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v)
            sh.freeze_panes = "A2"
        wb.save(path)
        return True, None
    except Exception as e:
        return False, "Excel gagal: %s (JSON tetap lengkap)" % e


# ---------------------------------------------------------------- utama
def cadangkan(base, base_dir, now=None):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    snap_root = os.path.join(base_dir, "snapshots")
    stamp = now.strftime("%Y-%m-%d_%H%M")
    run_dir = os.path.join(snap_root, stamp)
    if os.path.exists(run_dir):
        stamp += now.strftime("%S")
        run_dir = os.path.join(snap_root, stamp)
    os.makedirs(os.path.join(run_dir, "raw"))
    os.makedirs(os.path.join(run_dir, "clean"))
    mulai = now.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    print("=" * 64)
    print("CADANGAN FIRESTORE WAKAF v%s — %s UTC" % (VERSI_RESEP, now.strftime("%Y-%m-%d %H:%M:%S")))
    print("=" * 64)
    all_raw, all_clean, rekaman, gagal, kurang = {}, {}, {}, {}, []
    for col, (_desc, _grup, minimal) in KOLEKSI.items():
        docs, err, code = ambil_koleksi(base, col)
        if err:
            gagal[col] = "HTTP %s: %s" % (code, err[:160])
            print("  [!!] %-22s GAGAL %s" % (col, gagal[col]))
            continue
        all_raw[col] = docs
        all_clean[col] = [decode_doc(d) for d in docs]
        rekaman[col] = jumlah_rekaman(all_clean[col])
        if len(docs) < minimal:
            kurang.append(col)
            print("  [!!] %-22s hanya %d dokumen (minimal %d)" % (col, len(docs), minimal))
        else:
            print("  [ok] %-22s %4d dok / %d rekaman" % (col, len(docs), rekaman[col]))

    terbuka = []
    for col in TERKUNCI:
        docs, err, code = ambil_koleksi(base, col)
        if err and code == 403:
            continue
        if err:
            gagal["_periksa_" + col] = "HTTP %s: %s" % (code, err[:160])
            print("  [!]  %-22s pemeriksaan terkunci gagal: %s" % (col, gagal["_periksa_" + col]))
            continue
        terbuka.append(col)          # isinya sengaja TIDAK disimpan
        print("  [!!!] %-21s TERBACA PUBLIK — alarm keamanan, isi tidak disimpan" % col)
    selesai = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    berubah = sorted({f"{c}/{d['name'].split('/')[-1]}" for c, ds in all_raw.items() for d in ds
                      if d.get("updateTime", "") > mulai})

    for col in all_raw:
        tulis_json(os.path.join(run_dir, "raw", col + ".json"), all_raw[col])
        tulis_json(os.path.join(run_dir, "clean", col + ".json"), all_clean[col])
    tulis_json(os.path.join(run_dir, "snapshot_combined.json"),
               {"_meta": {"backup_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "project": PROJECT_ID,
                          "resep": VERSI_RESEP, "collections_ok": list(all_clean), "warnings": gagal},
                "data": all_clean})
    tulis_readme(os.path.join(run_dir, "README_SCHEMA.md"), now, all_clean, rekaman, gagal)
    xlsx = "Ringkasan_Audit_%s.xlsx" % now.strftime("%Y-%m-%d")
    ok_xlsx, err_xlsx = tulis_excel(os.path.join(run_dir, xlsx), now, all_clean, rekaman)
    if not ok_xlsx:
        print("  [!]  " + err_xlsx)

    sebelum = cadangan_sebelumnya(snap_root, stamp)
    susut = []
    if sebelum:
        for col, n_lama in sebelum[1].items():
            n = rekaman.get(col)
            if n is not None and n_lama and (n_lama - n) / n_lama > AMBANG_SUSUT:
                susut.append({"koleksi": col, "sebelumnya": n_lama, "sekarang": n, "pembanding": sebelum[0]})

    berkas = {}
    for akar, _dirs, files in os.walk(run_dir):
        for fn in sorted(files):
            p = os.path.join(akar, fn)
            berkas[os.path.relpath(p, run_dir)] = {"sha256": sha256_berkas(p), "bytes": os.path.getsize(p)}
    manifest = {"resep": VERSI_RESEP, "project": PROJECT_ID, "mulai_utc": mulai, "selesai_utc": selesai,
                "koleksi": {c: {"dokumen": len(all_raw[c]), "rekaman": rekaman[c],
                                "sha256_raw": berkas[os.path.join("raw", c + ".json")]["sha256"],
                                "update_terakhir": max((d.get("updateTime", "") for d in all_raw[c]), default="")}
                            for c in all_raw},
                "dikecualikan": TERKUNCI, "berkas": berkas}
    tulis_json(os.path.join(run_dir, "MANIFEST.json"), manifest)
    rusak = verifikasi_manifest(run_dir)

    if gagal and any(not k.startswith("_periksa_") for k in gagal) or kurang:
        kode = 2
    elif terbuka:
        kode = 3
    elif rusak:
        kode = 4
    elif susut:
        kode = 5
    else:
        kode = 0
    status = {
        "backup_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "resep": VERSI_RESEP, "run_dir": run_dir,
        "kode_keluar": kode, "collections_ok": len(all_clean), "collections_total_readable": len(KOLEKSI),
        "total_documents": sum(len(v) for v in all_raw.values()),
        "rekaman_per_koleksi": rekaman, "warnings": gagal, "di_bawah_minimal": kurang,
        "EARLY_WARNING_access_blocked": [c for c in gagal if not c.startswith("_periksa_")],
        "TERKUNCI_TERBACA_PUBLIK": terbuka, "manifest_rusak": rusak, "penyusutan": susut,
        "berubah_saat_cadangan": berubah, "excel_ok": ok_xlsx,
        "manifest_sha256": sha256_berkas(os.path.join(run_dir, "MANIFEST.json")),
    }
    tulis_json(os.path.join(run_dir, "_status.json"), status)
    if kode in (0, 5):                         # cadangan utuh; penyusutan tetap layak jadi LATEST
        with open(os.path.join(snap_root, "LATEST.txt"), "w", encoding="utf-8") as f:
            f.write(stamp + "\n")
    log = os.path.join(base_dir, "backup_log.csv")
    baru = not os.path.exists(log)
    with open(log, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if baru:
            w.writerow(["backup_utc", "collections_ok", "total_documents", "early_warning", "excel_ok"])
        w.writerow([status["backup_utc"], len(all_clean), status["total_documents"],
                    ";".join(status["EARLY_WARNING_access_blocked"] + kurang + terbuka) or "none", ok_xlsx])

    print("-" * 64)
    print("Folder : %s" % run_dir)
    print("Hasil  : %d/%d koleksi, %d dokumen, manifest %s" % (
        len(all_clean), len(KOLEKSI), status["total_documents"], status["manifest_sha256"][:12]))
    if berubah:
        print("Catatan: %d dokumen berubah selama proses (bukan snapshot atomik)" % len(berubah))
    pesan = {0: "LENGKAP dan terverifikasi.",
             2: "TIDAK LENGKAP: %s" % ", ".join(list(status["EARLY_WARNING_access_blocked"]) + kurang),
             3: "ALARM KEAMANAN: penyimpanan terkunci terbaca publik: %s" % ", ".join(terbuka),
             4: "BERKAS RUSAK: %s" % "; ".join(rusak[:5]),
             5: "PENYUSUTAN BESAR: %s" % "; ".join(f"{s['koleksi']} {s['sebelumnya']}->{s['sekarang']}" for s in susut)}
    print(("OK     : " if kode == 0 else "!!!    : ") + pesan[kode])
    return kode, run_dir


def latih_pulih(run_dir, emulator):
    """Pulihkan raw/ ke EMULATOR lalu bandingkan dokumen demi dokumen. Produksi ditolak."""
    host = urllib.parse.urlparse(emulator).hostname
    if host not in ("127.0.0.1", "localhost", "::1"):
        print("DITOLAK: latihan pulih hanya ke emulator lokal, bukan %s" % emulator)
        return 2
    masalah = verifikasi_manifest(run_dir)
    if masalah:
        print("DITOLAK: manifest tidak cocok — %s" % "; ".join(masalah[:5]))
        return 4
    base = emulator.rstrip("/") + f"/v1/projects/{PROJECT_ID}/databases/(default)/documents"
    op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    total, beda = 0, []
    for fn in sorted(os.listdir(os.path.join(run_dir, "raw"))):
        col = fn[:-5]
        for d in baca_json(os.path.join(run_dir, "raw", fn)):
            did = d["name"].split("/")[-1]
            url = f"{base}/{col}/{urllib.parse.quote(did, safe='')}"
            req = urllib.request.Request(url, method="PATCH", data=json.dumps({"fields": d.get("fields", {})}).encode(),
                                         headers={"Content-Type": "application/json", "Authorization": "Bearer owner"})
            op.open(req).read()
            back = json.loads(op.open(urllib.request.Request(url, headers={"Authorization": "Bearer owner"})).read())
            if decode_doc(back) != decode_doc(d):
                beda.append(f"{col}/{did}")
            total += 1
    print("Latihan pulih ke emulator: %d dokumen, %d berbeda" % (total, len(beda)))
    for b in beda[:10]:
        print("  beda: " + b)
    return 0 if not beda else 4


def main(argv=None):
    ap = argparse.ArgumentParser(description="Cadangan harian Firestore Wakaf (resep v2)")
    ap.add_argument("--folder", default=os.path.dirname(os.path.abspath(__file__)),
                    help="folder induk 'snapshots' dan backup_log.csv (bawaan: lokasi skrip)")
    ap.add_argument("--verifikasi", metavar="FOLDER_SNAPSHOT")
    ap.add_argument("--latih-pulih", metavar="FOLDER_SNAPSHOT")
    ap.add_argument("--emulator", default="http://127.0.0.1:8080")
    a = ap.parse_args(argv)
    if a.verifikasi:
        m = verifikasi_manifest(a.verifikasi)
        print("Manifest COCOK" if not m else "Manifest TIDAK COCOK:\n  " + "\n  ".join(m))
        return 0 if not m else 4
    if a.latih_pulih:
        return latih_pulih(a.latih_pulih, a.emulator)
    base = os.environ.get("WAKAF_FS_BASE") or BASE_PRODUKSI
    return cadangkan(base, a.folder)[0]


if __name__ == "__main__":
    sys.exit(main())
