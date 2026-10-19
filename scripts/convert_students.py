"""
Konversi file Dapodik (.xls) PKBM Nurul Islam -> CSV siap-import untuk tabel `students`.
Jalankan: python3 scripts/convert_students.py <path_ke_file.xls> data/students_import.csv
Tidak mengarang data apa pun -- hanya membaca & memetakan kolom asli.
"""
import sys, re, csv
import pandas as pd

def map_jenjang_program(kelas_raw: str):
    k = kelas_raw.strip()
    m = re.search(r'(\d+)', k)
    n = int(m.group(1)) if m else None
    if n is not None and 1 <= n <= 6:
        return 'SD', 'UMUM', f'Kelas {n}'
    if n is not None and 7 <= n <= 9:
        return 'SMP', 'PAKET_B', k.replace('Kelas ', '')
    if n is not None and 10 <= n <= 12:
        return 'SMA', 'PAKET_C', k.replace('Kelas ', '')
    return 'TIDAK_DIKETAHUI', 'UMUM', k

def main(src, dst):
    df = pd.read_excel(src, sheet_name=0, header=None)
    data = df.iloc[6:].copy()
    data.columns = ['No','Nama','NIPD','JK','NISN','TempatLahir','TglLahir','NIK','Agama','Alamat',
                    'RT','RW','Dusun','Kelurahan','Kecamatan','KodePos','JenisTinggal','AlatTransport',
                    'Telepon','HP'] + [f'c{i}' for i in range(20, 66)]
    rows = []
    flagged = []
    for _, r in data.iterrows():
        kelas_raw = str(r['c42']) if pd.notna(r['c42']) else ''
        jenjang, program, kelas = map_jenjang_program(kelas_raw)
        nisn = str(r['NISN']).strip() if pd.notna(r['NISN']) else ''
        nisn = re.sub(r'\.0$', '', nisn)
        tgl_lahir = r['TglLahir']
        if pd.notna(tgl_lahir) and hasattr(tgl_lahir, 'strftime'):
            tgl_lahir_str = tgl_lahir.strftime('%Y-%m-%d')
        elif pd.notna(tgl_lahir):
            parsed = pd.to_datetime(str(tgl_lahir), errors='coerce', dayfirst=False)
            tgl_lahir_str = parsed.strftime('%Y-%m-%d') if pd.notna(parsed) else ''
        else:
            tgl_lahir_str = ''
        butuh_konfirmasi = False
        catatan = []
        if not nisn:
            butuh_konfirmasi = True
            catatan.append('NISN kosong pada data sumber')
        if jenjang == 'TIDAK_DIKETAHUI':
            butuh_konfirmasi = True
            catatan.append(f'Rombel tidak dikenali: "{kelas_raw}"')
        if butuh_konfirmasi:
            flagged.append((r['Nama'], catatan))
        rows.append({
            'nisn': nisn or '',
            'nipd': str(r['NIPD']).strip() if pd.notna(r['NIPD']) else '',
            'nama': str(r['Nama']).strip().title(),
            'jk': r['JK'],
            'jenjang': jenjang,
            'program': program,
            'kelas': kelas,
            'tempat_lahir': r['TempatLahir'] if pd.notna(r['TempatLahir']) else '',
            'tanggal_lahir': tgl_lahir_str,
            'alamat': r['Alamat'] if pd.notna(r['Alamat']) else '',
            'hp': str(r['HP']).strip() if pd.notna(r['HP']) else '',
            'status': 'AKTIF',
            'butuh_konfirmasi_admin': butuh_konfirmasi,
            'catatan_konfirmasi': '; '.join(catatan),
        })

    with open(dst, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    print(f'{len(rows)} siswa dikonversi -> {dst}')
    if flagged:
        print(f'\nPERLU KONFIRMASI ADMIN ({len(flagged)}):')
        for nama, catatan in flagged:
            print(f'  - {nama}: {", ".join(catatan)}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
