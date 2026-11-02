import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

// Check app-authored copy, not comments, schemas, seeds, migrations or user records.
const indonesian =
  /\b(?:tidak|belum|silakan|coba lagi|gagal|berhasil|tersimpan|memuat|masuk|daftar|pilih|hapus|batal|simpan|kembali|beranda|pembayaran|tagihan|langganan|riwayat|saldo|jangan|latar|gelap|terang|pengguna|perangkat|berubah|gambar|tunggu|judul|bulan|tahun|menit|detik|kustom|unggah|tombol|sesi|mohon|permintaan|kedaluwarsa|akses|disimpan|ditambahkan|dihapus|perubahan|keranjang|kosong|semua|koneksi|periksa|bantuan|kredit|maksimal|ditemukan|untuk|dengan|atau|dari|sudah|sedang|tambahkan|bayar|beli|bagikan|ubah|gunakan|tampilkan|rincian|kelola|mulai|fitur|pelajari|hingga|tanggal|durasi|dibuat|diperbarui|jumlah|lebar|tinggi|sampai|panduan|dukungan|keamanan|pratinjau|unduh|menyimpan|mengunduh|mengakses|menunggu|membuat|menerapkan|pemrosesan|katalog|penyedia|lingkungan|sebelum|setelah|terlalu|sedikit|hanya|selesai|diperlukan|diperbolehkan|ditolak|berbayar|dibuka|terbuka|dikirim|dilanjutkan|gratis|hari|aktif|nonaktif|tersedia|silahkan|nama|alamat|lanjutkan)\b/i;

test('application-authored UI and reachable error copy is English', () => {
  const findings = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['db', 'schema', 'migrations', 'node_modules'].includes(entry.name)) walk(path);
        continue;
      }
      if (!/\.tsx?$/.test(path) || /\.test\./.test(path)) continue;
      const source = ts.createSourceFile(
        path,
        readFileSync(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      function visit(node) {
        if (
          ts.isStringLiteralLike(node) ||
          ts.isJsxText(node) ||
          ts.isTemplateHead(node) ||
          ts.isTemplateMiddle(node) ||
          ts.isTemplateTail(node)
        ) {
          const text = node.text;
          if (indonesian.test(text)) {
            const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
            findings.push(path + ':' + line + ': ' + text.trim().slice(0, 180));
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  for (const dir of ['client/src', 'admin/src', 'api/src', 'worker/src']) walk(dir);
  assert.deepEqual(findings, [], 'Untranslated application copy:\n' + findings.join('\n'));
});

test('public/admin documents and public prerender declare English', () => {
  for (const path of ['client/index.html', 'admin/index.html'])
    assert.match(readFileSync(path, 'utf8'), /<html[^>]+lang=["']en(?:-[A-Z]{2})?["']/);
  assert.match(readFileSync('client/src/main.tsx', 'utf8'), /lang:\s*['"]en['"]/);
});
