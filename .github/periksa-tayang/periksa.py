#!/usr/bin/env python3
"""Periksa "tayang = main" (usulan 4, 14 Nov 2026).

Sesudah GitHub Pages selesai membangun sebuah commit, unduh berkas yang berubah di commit itu
(ditambah berkas inti) dari situs yang tayang, lalu bandingkan SHA-256-nya dengan isi Git.
Hanya membaca. Keluaran JSON; kode keluar 1 bila ada berkas yang tetap berbeda sesudah
dicoba ulang (CDN Pages bisa menahan salinan lama sampai ±10 menit).
"""
import argparse
import hashlib
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request

SITUS = 'https://adib-psych.github.io/wakaf-produktif/'
INTI = ('monitor-v2.html', 'lapor.html', 'ambil-antrian.html', 'firebase-config.js')
DILEWATI = ('.github/', 'tests/', 'operations/tests/', 'recovery/node_modules/', 'node_modules/')


def git(*a):
    return subprocess.run(('git',) + a, check=True, capture_output=True).stdout


def berkas_diperiksa(commit):
    induk = git('rev-list', '--parents', '-n', '1', commit).decode().split()
    if len(induk) > 1:
        ubah = git('diff', '--name-only', '--diff-filter=AM', induk[1], commit).decode().split('\n')
    else:
        ubah = []
    daftar = [p for p in ubah if p and not p.startswith(DILEWATI)]
    for p in INTI:
        if p not in daftar:
            daftar.append(p)
    ada = set(git('ls-tree', '-r', '--name-only', commit).decode().split('\n'))
    return [p for p in daftar if p in ada]


def sha_git(commit, path):
    return hashlib.sha256(git('show', f'{commit}:{path}')).hexdigest()


def sha_tayang(path, penanda, buka=urllib.request.urlopen):
    req = urllib.request.Request(SITUS + path + '?periksa=' + penanda, headers={'Cache-Control': 'no-cache'})
    try:
        with buka(req, timeout=30) as r:
            return hashlib.sha256(r.read()).hexdigest()
    except urllib.error.HTTPError as e:
        return f'HTTP {e.code}'


def periksa(commit, percobaan=10, jeda=60, buka=urllib.request.urlopen, tidur=time.sleep,
            daftar=None, sha_sumber=None):
    daftar = berkas_diperiksa(commit) if daftar is None else daftar
    sha_sumber = sha_sumber or (lambda p: sha_git(commit, p))
    harap = {p: sha_sumber(p) for p in daftar}
    beda = dict(harap)
    for i in range(percobaan):
        for p in list(beda):
            if sha_tayang(p, f'{commit[:12]}-{i}', buka) == harap[p]:
                del beda[p]
        if not beda:
            break
        if i + 1 < percobaan:
            tidur(jeda)
    return {'commit': commit, 'diperiksa': len(daftar), 'cocok': len(daftar) - len(beda),
            'beda': sorted(beda), 'percobaan': i + 1}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('commit')
    ap.add_argument('--percobaan', type=int, default=10)
    ap.add_argument('--jeda', type=int, default=60)
    a = ap.parse_args(argv)
    hasil = periksa(a.commit, a.percobaan, a.jeda)
    print(json.dumps(hasil, ensure_ascii=False))
    return 1 if hasil['beda'] else 0


if __name__ == '__main__':
    sys.exit(main())
