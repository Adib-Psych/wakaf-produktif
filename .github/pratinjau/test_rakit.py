"""Uji rakit.py tanpa jaringan: repo git sementara dengan ref refs/pull/N/head buatan."""
import hashlib, json, os, subprocess, sys, tempfile, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rakit  # noqa: E402


def sh(cwd, *a):
    subprocess.run(a, cwd=cwd, check=True, capture_output=True)


def tulis(akar, jalur, isi):
    p = os.path.join(akar, jalur)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'wb') as f:
        f.write(isi if isinstance(isi, bytes) else isi.encode())


def baca(p, mode='r'):
    with open(p, mode, **({} if 'b' in mode else {'encoding': 'utf-8'})) as f:
        return f.read()


def sha(p):
    return hashlib.sha256(baca(p, 'rb')).hexdigest()


class UjiRakit(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        r = self.repo = os.path.join(self.tmp.name, 'repo')
        os.makedirs(r)
        sh(r, 'git', 'init', '-q', '-b', 'main')
        sh(r, 'git', 'config', 'user.email', 'uji@contoh'); sh(r, 'git', 'config', 'user.name', 'uji')
        tulis(r, 'index.html', '<!doctype html><html><head><meta charset="utf-8"><title>Live</title></head><body data-x="1"><p>halo é</p></body></html>')
        tulis(r, 'ringkasan.html', '<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head><body>x</body></html>')
        tulis(r, 'app.js', 'console.log(1)')
        tulis(r, 'images/gallery/besar.jpg', b'\xff' * 1000)
        tulis(r, 'images/logo.png', b'\x89PNG')
        sh(r, 'git', 'add', '-A'); sh(r, 'git', 'commit', '-qm', 'main')
        sh(r, 'git', 'checkout', '-qb', 'claude/coba')
        tulis(r, 'index.html', '<!doctype html><html><head><meta charset="utf-8"><title>Baru</title></head><body><p>baru</p></body></html>')
        tulis(r, 'images/gallery/baru.jpg', b'\x01\x02')
        sh(r, 'git', 'add', '-A'); sh(r, 'git', 'commit', '-qm', 'pr')
        sh(r, 'git', 'update-ref', 'refs/pull/7/head', 'HEAD')
        self.sha_pr = subprocess.run(['git', '-C', r, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
        sh(r, 'git', 'checkout', '-q', 'main')
        self.daftar = os.path.join(self.tmp.name, 'daftar.json')
        with open(self.daftar, 'w') as f:
          json.dump([
            {'number': 7, 'headRefName': 'claude/coba', 'headRefOid': self.sha_pr, 'isCrossRepository': False, 'isDraft': True, 'title': 'Coba <b>'},
            {'number': 8, 'headRefName': 'fitur/lain', 'headRefOid': 'x', 'isCrossRepository': False, 'isDraft': False, 'title': 'bukan claude'},
            {'number': 9, 'headRefName': 'claude/fork', 'headRefOid': 'x', 'isCrossRepository': True, 'isDraft': False, 'title': 'fork'},
        ], f)
        self.keluar = os.path.join(self.tmp.name, 'situs')
        self.hasil = rakit.main(['--keluar', self.keluar, '--repo-dir', r, '--remote', r, '--daftar-json', self.daftar]) or None

    def tearDown(self):
        self.tmp.cleanup()

    def test_main_persis_sama(self):
        for f in ('index.html', 'ringkasan.html', 'app.js', 'images/gallery/besar.jpg', 'images/logo.png'):
            self.assertEqual(sha(os.path.join(self.keluar, f)), sha(os.path.join(self.repo, f)), f)
        self.assertFalse(os.path.exists(os.path.join(self.keluar, '.git')))

    def test_pratinjau_hanya_claude_repo_ini(self):
        dirs = sorted(os.listdir(os.path.join(self.keluar, 'pratinjau')))
        self.assertEqual(dirs, ['index.html', 'pr-7'])
        info = json.loads(baca(os.path.join(self.keluar, 'pratinjau/pr-7/PRATINJAU.json')))
        self.assertEqual(info['sha'], self.sha_pr)
        self.assertTrue(info['draft'])
        idx = baca(os.path.join(self.keluar, 'pratinjau/index.html'))
        self.assertIn('Coba &lt;b&gt;', idx)
        self.assertIn('noindex', idx)

    def test_suntikan_dan_isi_pr(self):
        t = baca(os.path.join(self.keluar, 'pratinjau/pr-7/index.html'))
        self.assertIn('<p>baru</p>', t)
        self.assertEqual(t.count('window.__PRATINJAU__='), 1)
        self.assertLess(t.index('<meta charset="utf-8">'), t.index('window.__PRATINJAU__'))
        self.assertLess(t.index('window.__PRATINJAU__'), t.index('<title>'))
        self.assertIn('id="pratinjau-pita"', t)
        self.assertLess(t.index('<body>'), t.index('id="pratinjau-pita"'))
        self.assertIn('"pr": 7', t)
        c = baca(os.path.join(self.keluar, 'pratinjau/pr-7/ringkasan.html'))
        self.assertIn('id="pratinjau-pita"', c)   # pita HTML tetap tampil walau CSP menolak skrip

    def test_galeri_hanya_yang_diubah(self):
        g = os.path.join(self.keluar, 'pratinjau/pr-7/images/gallery')
        self.assertEqual(os.listdir(g), ['baru.jpg'])
        self.assertTrue(os.path.exists(os.path.join(self.keluar, 'pratinjau/pr-7/images/logo.png')))

    def test_utf8_utuh(self):
        t = baca(os.path.join(self.keluar, 'index.html'))
        self.assertIn('halo é', t)


if __name__ == '__main__':
    unittest.main()
