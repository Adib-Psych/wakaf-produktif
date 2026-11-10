#!/usr/bin/env python3
"""Rakit situs GitHub Pages: main persis apa adanya + pratinjau/pr-N/ untuk PR Claude yang terbuka.

ADR-053. Dipanggil oleh .github/workflows/terbitkan-pages.yml pada konteks cabang main.
Isi PR hanya diperlakukan sebagai DATA (git archive + sisip teks); tidak ada kode PR yang dijalankan.

Pemakaian:
  rakit.py --keluar DIR [--repo-dir .] [--remote origin] [--daftar-json BERKAS] [--dasar main]
  rakit.py --suntik-satu MASUK KELUAR --pr N --sha SHA        (untuk uji)
"""
import argparse, datetime, html, json, os, re, shutil, subprocess, sys, tarfile, io

BATAS_MB = 950            # batas situs GitHub Pages = 1 GB
TANPA_SALIN = ('images/gallery/',)   # berat dan jarang berubah; disalin hanya bila diubah PR
MODE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mode-pratinjau.js'), encoding='utf-8').read()
if '</script' in MODE.lower():
    sys.exit('mode-pratinjau.js tidak boleh memuat penutup tag script')

HEAD_RE = re.compile(r'<head(\s[^>]*)?>', re.I)
CHARSET_RE = re.compile(r'<meta\s+charset\s*=[^>]*>', re.I)
BODY_RE = re.compile(r'<body(\s[^>]*)?>', re.I)


def git(repo, *args, data=False):
    r = subprocess.run(['git', '-C', repo, *args], capture_output=True, check=True)
    return r.stdout if data else r.stdout.decode().strip()


def ekstrak(repo, ref, tujuan, jalur=None, kecuali=()):
    os.makedirs(tujuan, exist_ok=True)
    arsip = git(repo, 'archive', '--format=tar', ref, *(jalur or []), data=True)
    with tarfile.open(fileobj=io.BytesIO(arsip)) as t:
        anggota = [m for m in t.getmembers()
                   if not any(m.name == k.rstrip('/') or m.name.startswith(k) for k in kecuali)]
        for m in anggota:
            if m.issym() or m.islnk():
                raise SystemExit('tautan simbolik tidak didukung: ' + m.name)
        t.extractall(tujuan, members=anggota, filter='data') if sys.version_info >= (3, 12) else t.extractall(tujuan, members=anggota)


def suntik(teks, pr, sha, cabang=''):
    """Sisipkan konfigurasi + mode-pratinjau di awal <head> dan pita di awal <body>."""
    cfg = json.dumps({'pr': pr, 'sha': sha, 'cabang': cabang}).replace('<', '\\u003c')
    skrip = ('<script>window.__PRATINJAU__=' + cfg + ';</script><script>' + MODE + '</script>'
             '<meta name="robots" content="noindex">')
    m = HEAD_RE.search(teks)
    if m:
        c = CHARSET_RE.search(teks, m.end(), m.end() + 2000)
        pos = c.end() if c else m.end()
    else:
        pos = 0
    teks = teks[:pos] + skrip + teks[pos:]
    pita = ('<div id="pratinjau-pita" style="position:fixed;left:8px;bottom:8px;z-index:2147483647;'
            'max-width:92vw;background:#FAEEDA;color:#633806;border:1px solid #BA7517;border-radius:8px;'
            'padding:6px 10px;font:12px/1.4 system-ui,sans-serif">PRATINJAU PR #' + html.escape(str(pr)) +
            ' · revisi ' + html.escape(sha) + ' · data live hanya-baca<span id="pratinjau-hitung"></span></div>')
    b = BODY_RE.search(teks, pos + len(skrip))
    if b:
        return teks[:b.end()] + pita + teks[b.end():]
    return teks + pita


def suntik_folder(akar, pr, sha, cabang):
    n = 0
    for d, _, fs in os.walk(akar):
        for f in fs:
            if f.lower().endswith(('.html', '.htm')):
                p = os.path.join(d, f)
                with open(p, 'rb') as fh:
                    teks = fh.read().decode('utf-8', 'surrogateescape')
                with open(p, 'wb') as fh:
                    fh.write(suntik(teks, pr, sha, cabang).encode('utf-8', 'surrogateescape'))
                n += 1
    return n


def daftar_pr(args):
    if args.daftar_json:
        with open(args.daftar_json, encoding='utf-8') as f:
            return json.load(f)
    repo = os.environ['GITHUB_REPOSITORY']
    out = subprocess.run(['gh', 'pr', 'list', '--repo', repo, '--state', 'open', '--limit', '50', '--json',
                          'number,headRefName,headRefOid,isCrossRepository,isDraft,title'],
                         capture_output=True, check=True)
    return json.loads(out.stdout)


def ukuran_mb(akar):
    return sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(akar) for f in fs) / 1e6


def rakit(args):
    keluar = os.path.abspath(args.keluar)
    if os.path.exists(keluar):
        shutil.rmtree(keluar)
    dasar_sha = git(args.repo_dir, 'rev-parse', args.dasar)
    ekstrak(args.repo_dir, dasar_sha, keluar)                     # main persis apa adanya
    if os.path.exists(os.path.join(keluar, 'pratinjau')):
        raise SystemExit('main memuat folder pratinjau/ — bentrok dengan alamat pratinjau')
    hasil = {'main': dasar_sha, 'dibuat': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
             'pratinjau': [], 'dilewati': []}
    for pr in sorted(daftar_pr(args), key=lambda x: x['number']):
        nomor, cabang = int(pr['number']), pr.get('headRefName', '')
        if pr.get('isCrossRepository') or not cabang.startswith('claude/'):
            hasil['dilewati'].append({'pr': nomor, 'alasan': 'bukan cabang claude/* di repo ini'})
            continue
        ref = 'refs/pratinjau/pr-%d' % nomor
        try:
            git(args.repo_dir, 'fetch', '--quiet', '--no-tags', args.remote, '+refs/pull/%d/head:%s' % (nomor, ref))
        except subprocess.CalledProcessError as e:
            hasil['dilewati'].append({'pr': nomor, 'alasan': 'gagal fetch: ' + e.stderr.decode()[-200:]})
            continue
        sha = git(args.repo_dir, 'rev-parse', ref)
        tujuan = os.path.join(keluar, 'pratinjau', 'pr-%d' % nomor)
        ekstrak(args.repo_dir, sha, tujuan, kecuali=TANPA_SALIN)
        berubah = [p for p in git(args.repo_dir, 'diff', '--name-only', '--diff-filter=AM',
                                  dasar_sha + '...' + sha, '--', *TANPA_SALIN).splitlines() if p]
        if berubah:
            ekstrak(args.repo_dir, sha, tujuan, jalur=berubah)
        n = suntik_folder(tujuan, nomor, sha[:7], cabang)
        info = {'pr': nomor, 'sha': sha, 'cabang': cabang, 'judul': pr.get('title', ''),
                'draft': bool(pr.get('isDraft')), 'halaman': n, 'galeri_disalin': len(berubah)}
        with open(os.path.join(tujuan, 'PRATINJAU.json'), 'w', encoding='utf-8') as f:
            json.dump(info, f, ensure_ascii=False, indent=1)
        hasil['pratinjau'].append(info)
    os.makedirs(os.path.join(keluar, 'pratinjau'), exist_ok=True)
    baris = ''.join('<li><a href="pr-%d/">PR #%d</a> · %s · revisi %s%s</li>' % (
        p['pr'], p['pr'], html.escape(p['judul']), p['sha'][:7], ' · draft' if p['draft'] else '')
        for p in hasil['pratinjau']) or '<li>Belum ada pratinjau terbuka.</li>'
    with open(os.path.join(keluar, 'pratinjau', 'index.html'), 'w', encoding='utf-8') as f:
        f.write('<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex">'
                '<meta name="viewport" content="width=device-width,initial-scale=1">'
                '<title>Pratinjau</title><body style="font:15px/1.6 system-ui,sans-serif;margin:24px">'
                '<h1 style="font-size:20px">Pratinjau terbuka</h1><ul>' + baris + '</ul>'
                '<p style="color:#555">Data live hanya-baca. Semua penulisan diblokir. ADR-053.</p></body>')
    # Tanda terbit: membuktikan situs yang tersaji berasal dari run Actions ini, bukan build cabang lama
    # dengan byte yang sama (keluhan #46). Dibaca oleh pekerjaan `periksa`.
    with open(os.path.join(keluar, 'pratinjau', 'TERBIT.json'), 'w', encoding='utf-8') as f:
        json.dump({'main': dasar_sha, 'run': os.environ.get('GITHUB_RUN_ID', 'lokal'), 'dibuat': hasil['dibuat'],
                   'pratinjau': [p['pr'] for p in hasil['pratinjau']]}, f, ensure_ascii=False)
    hasil['ukuran_mb'] = round(ukuran_mb(keluar), 1)
    if hasil['ukuran_mb'] > BATAS_MB:
        raise SystemExit('situs %.0f MB melebihi batas %d MB — tutup PR pratinjau yang tidak dipakai' % (hasil['ukuran_mb'], BATAS_MB))
    print(json.dumps(hasil, ensure_ascii=False, indent=1))
    return hasil


def main(argv=None):
    a = argparse.ArgumentParser()
    a.add_argument('--keluar')
    a.add_argument('--repo-dir', default='.')
    a.add_argument('--remote', default='origin')
    a.add_argument('--dasar', default='HEAD')
    a.add_argument('--daftar-json')
    a.add_argument('--suntik-satu', nargs=2, metavar=('MASUK', 'KELUAR'))
    a.add_argument('--pr', type=int, default=0)
    a.add_argument('--sha', default='uji0000')
    args = a.parse_args(argv)
    if args.suntik_satu:
        masuk, kel = args.suntik_satu
        with open(masuk, 'rb') as f:
            teks = f.read().decode('utf-8', 'surrogateescape')
        with open(kel, 'wb') as f:
            f.write(suntik(teks, args.pr, args.sha).encode('utf-8', 'surrogateescape'))
        return
    if not args.keluar:
        a.error('--keluar wajib')
    rakit(args)


if __name__ == '__main__':
    main()
