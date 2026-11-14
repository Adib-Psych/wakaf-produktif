# Alarm laporan harian berhenti

Usulan 2 dari refleksi 14 Nov 2026: laporan berhenti 26 Okt dan baru ketahuan 9 Nov; laporan Christo 13–14 Nov tertahan di HP tanpa ada yang berbunyi.

- `alarm_laporan_berhenti.py` membaca `createTime` dokumen `device_reports` dan `laporan` lewat REST publik (tanpa kredensial, isi laporan tidak diunduh) lalu mencetak **satu pesan** bila laporan terbaru sudah berumur ≥ `--batas-hari` (bawaan 3 hari kalender). Bila normal, tidak mencetak apa pun.
- Bila sumber gagal dibaca, pesan galat tetap dicetak (kode keluar 3), jadi kegagalan tidak senyap.
- Tidak ada jalur tulis; uji `test_tidak_ada_jalur_tulis` menjaganya.
- Penjadwalan adalah tugas Hermes (ADR-049): mode no-agent, keluaran stdout ke Telegram, satu kali sehari. Pesan kosong berarti tidak ada yang dikirim.

Uji luring: `python3 -B -m unittest operations/alarm/test_alarm_laporan_berhenti.py`
