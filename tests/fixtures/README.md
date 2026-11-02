# Fixture baseline

Semua fixture dibuat secara sintetis dari kontrak source commit `041d225`. Tidak ada project/user/receipt merchant nyata yang disalin. Fixture bukan produk jualan, demo karya klien, maupun bukti bahwa renderer sudah diuji.

- `scene2d-legacy.json`: shape SceneState existing, termasuk text/image dan transform. Gambar berupa SVG inline orisinal tanpa resource eksternal.
- `scene3d-legacy.json`: shape Scene3DState existing dengan modelKey mug dan decal inline. Sengaja tidak menambah assetId/modelUrl yang belum ada pada kontrak serialisasi lama.
- `qris-receipts.sample.json`: skenario normalized feed sintetis untuk fase 5. Reference adalah string. Completed, pending, duplicate, wrong-store, wrong-merchant, unmatched dan late dibedakan. Expiry invoice dan matching belum diimplementasikan; file ini bukan test settlement.
- `baseline-plans.sql`: satu plan minimum yang dibaca test billing/retention existing. Harga adalah nilai test sintetis dan tidak menggantikan harga produk. Guard memeriksa nama DB dan role; bukan jaminan bahwa DB sembarang dengan nama itu disposable. Gunakan hanya container test yang didokumentasikan.

Fase 8/9 harus memakai fixture scene ini untuk pengujian load/save/export dan render yang sesungguhnya. Parsing JSON pada fase 1 hanya membuktikan format fixture valid.
