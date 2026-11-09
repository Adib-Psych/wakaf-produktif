"""Uji resep cadangan harian v2 (Keluhan #37). Tanpa jaringan produksi: server HTTP palsu lokal.

Jalankan dari akar repo:  python3 -B -m unittest recovery/backup/test_cadangan_harian.py
"""
import contextlib
import io
import json
import os
import re
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cadangan_harian as C  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
PREFIX = "/v1/projects/wakaf-ngantang/databases/(default)/documents/"


def dok(col, did, **fields):
    enc = {k: ({"integerValue": str(v)} if isinstance(v, int) else {"stringValue": v}) for k, v in fields.items()}
    return {"name": f"projects/wakaf-ngantang/databases/(default)/documents/{col}/{did}",
            "fields": enc, "updateTime": "2026-11-01T00:00:00Z"}


def singleton(col, n):
    return {"name": f"projects/wakaf-ngantang/databases/(default)/documents/{col}/active",
            "fields": {"data": {"arrayValue": {"values": [{"mapValue": {"fields": {"i": {"integerValue": str(i)}}}}
                                                          for i in range(n)]}}},
            "updateTime": "2026-11-01T00:00:00Z"}


def data_dasar():
    d = {c: [singleton(c, 10)] for c in C.KOLEKSI}
    d["laporan"] = [dok("laporan", f"lap{i}", pelapor="X", tgl="2026-11-01") for i in range(5)]
    d["workers"] = []
    d["payroll_events"] = []
    return d


class Palsu(BaseHTTPRequestHandler):
    data, terbuka, tolak = {}, set(), set()

    def log_message(self, *a):
        pass

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        col = u.path[len(PREFIX):]
        q = urllib.parse.parse_qs(u.query)
        if col in self.tolak or (col in C.TERKUNCI and col not in self.terbuka) or (
                col not in self.data and col not in C.TERKUNCI):
            self.send_response(403); self.end_headers()
            self.wfile.write(b'{"error":{"message":"Missing or insufficient permissions."}}')
            return
        docs = self.data.get(col, [dok(col, "rahasia", token="JANGAN-DISIMPAN")])
        mulai = int(q.get("pageToken", ["0"])[0])
        body = {"documents": docs[mulai:mulai + 2]}          # halaman kecil supaya paginasi teruji
        if mulai + 2 < len(docs):
            body["nextPageToken"] = str(mulai + 2)
        out = json.dumps(body).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(out)


class UjiCadangan(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), Palsu)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.srv.server_port}{PREFIX[:-1]}"
        os.environ["NO_PROXY"] = os.environ["no_proxy"] = "127.0.0.1,localhost"

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        Palsu.data, Palsu.terbuka, Palsu.tolak = data_dasar(), set(), set()

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def jalan(self):
        with contextlib.redirect_stdout(io.StringIO()):
            return C.cadangkan(self.base, self.tmp)

    def test_lengkap_dan_manifest_cocok(self):
        kode, run = self.jalan()
        self.assertEqual(kode, 0)
        self.assertEqual(sorted(f[:-5] for f in os.listdir(os.path.join(run, "raw"))), sorted(C.KOLEKSI))
        self.assertEqual(C.verifikasi_manifest(run), [])
        st = json.load(open(os.path.join(run, "_status.json")))
        self.assertEqual(st["collections_ok"], len(C.KOLEKSI))
        self.assertEqual(st["rekaman_per_koleksi"]["upah"], 10)
        lap = json.load(open(os.path.join(run, "raw", "laporan.json")))
        self.assertEqual(len(lap), 5, "semua halaman ikut")
        man = json.load(open(os.path.join(run, "MANIFEST.json")))
        self.assertEqual(man["koleksi"]["laporan"]["dokumen"], 5)
        self.assertEqual(open(os.path.join(self.tmp, "snapshots", "LATEST.txt")).read().strip(),
                         os.path.basename(run))

    def test_koleksi_inklusi_ditolak_gagal(self):
        Palsu.tolak = {"payroll_states"}
        kode, run = self.jalan()
        self.assertEqual(kode, 2)
        self.assertFalse(os.path.exists(os.path.join(self.tmp, "snapshots", "LATEST.txt")))

    def test_dokumen_inti_hilang_gagal(self):
        Palsu.data["upah"] = []
        self.assertEqual(self.jalan()[0], 2)

    def test_penyimpanan_terkunci_terbuka_alarm_tanpa_menyimpan(self):
        Palsu.terbuka = {"worker_tokens"}
        kode, run = self.jalan()
        self.assertEqual(kode, 3)
        semua = "".join(open(os.path.join(a, f), errors="ignore").read()
                        for a, _d, fs in os.walk(run) for f in fs if not f.endswith(".xlsx"))
        self.assertNotIn("JANGAN-DISIMPAN", semua)

    def test_berkas_diubah_terdeteksi(self):
        _k, run = self.jalan()
        with open(os.path.join(run, "raw", "cashbook.json"), "a") as f:
            f.write(" ")
        self.assertTrue(any("cashbook" in m for m in C.verifikasi_manifest(run)))
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(C.main(["--verifikasi", run]), 4)

    def test_penyusutan_besar_alarm(self):
        self.jalan()
        Palsu.data["panen_lots"] = [singleton("panen_lots", 2)]       # 10 -> 2 baris
        import time; time.sleep(1.1)
        kode, run = self.jalan()
        self.assertEqual(kode, 5)
        st = json.load(open(os.path.join(run, "_status.json")))
        self.assertEqual(st["penyusutan"][0]["koleksi"], "panen_lots")

    def test_latih_pulih_menolak_produksi(self):
        _k, run = self.jalan()
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(C.latih_pulih(run, "https://firestore.googleapis.com"), 2)


class UjiDaftarSesuaiRules(unittest.TestCase):
    """Koleksi baru di firestore.rules tanpa keputusan cadangan = CI gagal."""

    def test_inklusi_dan_eksklusi_menutup_seluruh_rules(self):
        rules = open(os.path.join(ROOT, "firestore.rules"), encoding="utf-8").read()
        publik = set(re.findall(r"'([a-z_]+)'", re.search(r"publicCollection in \[([^\]]*)\]", rules).group(1)))
        for blok in re.finditer(r"match /([a-z_]+)/\{[a-z]+\}\s*\{\s*allow read:if true", rules):
            publik.add(blok.group(1))
        semua = (set(re.findall(r"match /([a-z_]+)/", rules)) - {"databases"}) | publik
        privat_lama = set(re.findall(r'"([a-z_]+)"', re.search(r'match /\{collection\}/\{id\} \{allow read:if collection in \[([^\]]*)\]', rules).group(1)))
        semua |= privat_lama
        self.assertEqual(publik, set(C.KOLEKSI), "inklusi harus = koleksi yang terbaca publik")
        tanpa_keputusan = semua - set(C.KOLEKSI) - set(C.TERKUNCI)
        self.assertEqual(tanpa_keputusan, set(), "koleksi di rules belum masuk inklusi atau eksklusi")
        self.assertFalse(set(C.KOLEKSI) & set(C.TERKUNCI))


if __name__ == "__main__":
    unittest.main()
