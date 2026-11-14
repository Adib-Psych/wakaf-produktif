#!/usr/bin/env python3
"""Alarm "laporan harian berhenti" — Wakaf Produktif (usulan 2, 14 Nov 2026).

Hanya membaca koleksi publik Firestore lewat REST tanpa kredensial. Tidak menulis apa pun.
Mencetak satu pesan (stdout) hanya bila tidak ada laporan baru selama >= --batas-hari hari;
bila normal, tidak mencetak apa pun (pesan kosong = tidak dikirim oleh penjadwal Hermes).
Kode keluar: 0 normal/peringatan terkirim, 3 sumber tidak terbaca (pesan galat dicetak).

Waktu laporan = createTime dokumen (waktu server), bukan tanggal yang diketik pelapor,
supaya laporan susulan pun dihitung sebagai tanda jalur entry hidup.
"""
import argparse
import datetime as dt
import json
import sys
import urllib.parse
import urllib.request

PROYEK = 'wakaf-ngantang'
KOLEKSI = ('device_reports', 'laporan')  # jalur perangkat (Google + izin) dan jalur lama
DASAR = f'https://firestore.googleapis.com/v1/projects/{PROYEK}/databases/(default)/documents/'
DASHBOARD = 'https://adib-psych.github.io/wakaf-produktif/monitor-v2.html'
WIB = dt.timezone(dt.timedelta(hours=7))


def ambil(koleksi, buka=urllib.request.urlopen):
    """Kembalikan daftar createTime (datetime UTC) semua dokumen koleksi."""
    hasil, token = [], ''
    for _ in range(50):  # batas aman paginasi
        # Mask ke satu field kecil: cukup nama + createTime, isi laporan tidak diunduh.
        url = DASAR + koleksi + '?pageSize=300&mask.fieldPaths=id'
        if token:
            url += '&pageToken=' + urllib.parse.quote(token)
        with buka(url, timeout=30) as r:
            data = json.load(r)
        for d in data.get('documents', []):
            hasil.append(parse_waktu(d['createTime']))
        token = data.get('nextPageToken')
        if not token:
            return hasil
    raise RuntimeError('paginasi melebihi batas')


def parse_waktu(s):
    s = s.rstrip('Z')
    utama, _, pecahan = s.partition('.')
    t = dt.datetime.strptime(utama, '%Y-%m-%dT%H:%M:%S').replace(tzinfo=dt.timezone.utc)
    return t + dt.timedelta(microseconds=int((pecahan + '000000')[:6])) if pecahan else t


def nilai(waktu_terakhir, sekarang, batas_hari):
    """Kembalikan pesan peringatan atau None."""
    if waktu_terakhir is None:
        return '⚠️ Wakaf: belum ada satu pun laporan harian di server.'
    selisih = sekarang - waktu_terakhir
    hari = selisih.days
    if selisih < dt.timedelta(days=batas_hari):
        return None
    lokal = waktu_terakhir.astimezone(WIB)
    return (f'⚠️ Wakaf: tidak ada laporan harian baru selama {hari} hari '
            f'(terakhir masuk {lokal:%d-%m-%Y %H.%M} WIB). '
            'Cek ke tim kebun: memang tidak ada hari kerja, atau ada kendala mengisi '
            f'(link lama, login Google, izin entry)? Isi laporan: {DASHBOARD}#isi-laporan')


def main(argv=None, buka=urllib.request.urlopen, sekarang=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--batas-hari', type=int, default=3)
    a = ap.parse_args(argv)
    if a.batas_hari < 1:
        ap.error('--batas-hari minimal 1')
    try:
        semua = [t for k in KOLEKSI for t in ambil(k, buka)]
    except Exception as e:  # sumber gagal dibaca juga harus berbunyi, bukan diam
        print(f'⚠️ Wakaf: alarm laporan tidak bisa membaca server ({type(e).__name__}). '
              'Status laporan belum diketahui; cek manual dashboard.')
        return 3
    pesan = nilai(max(semua) if semua else None,
                  sekarang or dt.datetime.now(dt.timezone.utc), a.batas_hari)
    if pesan:
        print(pesan)
    return 0


if __name__ == '__main__':
    sys.exit(main())
