# Mikro katalog (K7)

- `manifest.json`: sorgu sözleşmeleri (queryId, parametreler, beklenen takma-ad kolonlar).
- `<queryId>.sql`: yalnızca `SELECT`/`WITH`; `;`, `--`, `/*`, EXEC, DDL/DML içeremez — Agent yüklemeyi reddeder ve **başlamaz**.
- `<queryId>.sql.template`: Mikro tablo/kolon adları doğrulanana kadar (Faz D) yer tutucu. Template'li sorgu
  `CATALOG_QUERY` ile çağrılırsa `catalog_query_unavailable` döner; sahte/boş sonuç dönmez.
- Parametreli sorgular: `SqlVeriOkuV2`'nin bağlı parametre desteği doğrulanmadı (§12 #12) — doğrulanana
  kadar parametreli sorgu `catalog_binding_unverified` ile reddedilir; string birleştirme YAPILMAZ.
