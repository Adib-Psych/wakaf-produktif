"""Uji luring pemeriksa tayang = main; tanpa jaringan."""
import hashlib
import io
import os
import sys
import unittest
import urllib.error

sys.path.insert(0, os.path.dirname(__file__))
import periksa as P  # noqa: E402

H = lambda b: hashlib.sha256(b).hexdigest()  # noqa: E731


class Respon(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


def situs(isi_per_percobaan):
    """isi_per_percobaan: list of {path: bytes|int}; percobaan ke-i memakai elemen ke-i."""
    def buka(req, timeout=None):
        url = req.full_url
        path, _, tanda = url[len(P.SITUS):].partition('?periksa=')
        i = int(tanda.rsplit('-', 1)[1])
        isi = isi_per_percobaan[min(i, len(isi_per_percobaan) - 1)][path]
        if isinstance(isi, int):
            raise urllib.error.HTTPError(url, isi, 'x', {}, None)
        return Respon(isi)
    return buka


class UjiPeriksa(unittest.TestCase):
    def jalan(self, sumber, tayang, percobaan=3):
        jeda = []
        h = P.periksa('a' * 40, percobaan=percobaan, jeda=5, buka=situs(tayang), tidur=jeda.append,
                      daftar=list(sumber), sha_sumber=lambda p: H(sumber[p]))
        return h, jeda

    def test_cocok_langsung(self):
        h, jeda = self.jalan({'a.html': b'A', 'b.js': b'B'}, [{'a.html': b'A', 'b.js': b'B'}])
        self.assertEqual((h['beda'], h['cocok'], h['percobaan'], jeda), ([], 2, 1, []))

    def test_cdn_lama_lalu_cocok(self):
        h, jeda = self.jalan({'a.html': b'BARU'}, [{'a.html': b'LAMA'}, {'a.html': b'BARU'}])
        self.assertEqual((h['beda'], h['percobaan'], jeda), ([], 2, [5]))

    def test_tetap_beda_dilaporkan(self):
        h, jeda = self.jalan({'a.html': b'BARU', 'b.js': b'B'}, [{'a.html': b'LAMA', 'b.js': b'B'}])
        self.assertEqual((h['beda'], h['cocok'], h['percobaan'], len(jeda)), (['a.html'], 1, 3, 2))

    def test_404_dihitung_beda(self):
        h, _ = self.jalan({'baru.html': b'X'}, [{'baru.html': 404}], percobaan=2)
        self.assertEqual(h['beda'], ['baru.html'])


if __name__ == '__main__':
    unittest.main()
