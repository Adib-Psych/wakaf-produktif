"""Uji luring alarm laporan berhenti; tanpa jaringan produksi."""
import contextlib
import datetime as dt
import io
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import alarm_laporan_berhenti as A  # noqa: E402

UTC = dt.timezone.utc


class Respon(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


def palsu(halaman):
    """halaman: {koleksi: [daftar halaman, tiap halaman = (createTimes, token)]}"""
    urutan = {k: list(v) for k, v in halaman.items()}
    dipanggil = []

    def buka(url, timeout=None):
        dipanggil.append(url)
        assert 'firestore.googleapis.com' in url and ':runQuery' not in url
        k = url.split('/documents/')[1].split('?')[0]
        waktu, token = urutan[k].pop(0)
        isi = {'documents': [{'name': f'x/{i}', 'createTime': t} for i, t in enumerate(waktu)]}
        if token:
            isi['nextPageToken'] = token
        return Respon(json.dumps(isi).encode())
    buka.dipanggil = dipanggil
    return buka


def jalankan(halaman, sekarang, argv=()):
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        kode = A.main(list(argv), buka=palsu(halaman), sekarang=sekarang)
    return kode, out.getvalue().strip()


SEKARANG = dt.datetime(2026, 11, 14, 12, 0, tzinfo=UTC)


class UjiAlarm(unittest.TestCase):
    def test_normal_diam(self):
        kode, out = jalankan({'device_reports': [(['2026-11-13T00:50:51.661898Z'], '')],
                              'laporan': [(['2026-10-15T02:49:21.307994Z'], '')]}, SEKARANG)
        self.assertEqual((kode, out), (0, ''))

    def test_berhenti_berbunyi_dengan_waktu_wib(self):
        kode, out = jalankan({'device_reports': [(['2026-11-11T00:50:53.980836Z'], '')],
                              'laporan': [(['2026-10-15T02:49:21Z'], '')]}, SEKARANG)
        self.assertEqual(kode, 0)
        self.assertIn('selama 3 hari', out)
        self.assertIn('11-11-2026 07.50 WIB', out)
        self.assertIn('#isi-laporan', out)

    def test_paginasi_dan_ambil_terbaru_lintas_koleksi(self):
        kode, out = jalankan({'device_reports': [(['2026-11-01T00:00:00Z'], 'T2'), (['2026-11-02T00:00:00Z'], '')],
                              'laporan': [(['2026-11-13T10:00:00Z'], '')]}, SEKARANG)
        self.assertEqual((kode, out), (0, ''))

    def test_batas_hari_bisa_diatur(self):
        h = {'device_reports': [(['2026-11-12T11:00:00Z'], '')], 'laporan': [([], '')]}
        self.assertEqual(jalankan(h, SEKARANG)[1], '')
        h = {'device_reports': [(['2026-11-12T11:00:00Z'], '')], 'laporan': [([], '')]}
        self.assertIn('selama 2 hari', jalankan(h, SEKARANG, ['--batas-hari', '2'])[1])

    def test_kosong_total_berbunyi(self):
        kode, out = jalankan({'device_reports': [([], '')], 'laporan': [([], '')]}, SEKARANG)
        self.assertIn('belum ada satu pun', out)

    def test_sumber_gagal_tidak_diam(self):
        def gagal(url, timeout=None):
            raise OSError('jaringan')
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            kode = A.main([], buka=gagal, sekarang=SEKARANG)
        self.assertEqual(kode, 3)
        self.assertIn('tidak bisa membaca server', out.getvalue())

    def test_tidak_ada_jalur_tulis(self):
        sumber = open(A.__file__, encoding='utf-8').read()
        for kata in ('PATCH', 'POST', 'DELETE', ':commit', 'batchWrite', 'Request('):
            self.assertNotIn(kata, sumber)


if __name__ == '__main__':
    unittest.main()
