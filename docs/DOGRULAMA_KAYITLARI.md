# Doğrulama Kayıtları

Tenant ve izin davranışına dair canlı ölçümlerin kalıcı kaydı.
Protokol: `CLAUDE.md` → Kalıp Kuralları → "Doğrulandı demenin eşiği".

Ölçüm sonucu normalde ilgili commit'in gövdesine yazılır. Bu dosya, commit
atıldıktan sonra tamamlanan doğrulamalar için kullanılır.

---

## Hotfix-8 — `switchTenant` kapsama semantiği

- **İlgili commit:** `7a5a43f` (fix: switchTenant uyelik sorgusu kapsama semantigine hizalandi)
- **Ölçüm tarihi:** 2026-08-08
- **Ortam:** localhost:3001, gerçek HTTP çağrısı

`7a5a43f`'in gövdesi üç geçiş türünün yalnızca ikisini kaydediyordu; farklı
ajans vakası ve UserRole satır sayısı eksikti. Aşağıdaki tablo eksiği
tamamlar.

### Fixture

Geçici olarak 2 User + 2 UserRole eklendi, ölçüm sonrası `finally` içinde
silindi:

- **U1** — KroptOS Agency'de ajans geneli rol (`clientId=null, storeId=null`)
- **U2** — KroptOS Agency'de yalnızca mağaza kapsamlı rol (`storeId=Sudocrem`)

### Sonuçlar

| # | Geçiş | ÖNCE | SONRA | Yorum |
|---|---|---|---|---|
| 1 | aynı ajans, ajans geneli | 200 | 200 | değişmedi |
| 2 | aynı ajans, marka (mağaza) | 403 | **200** | token `store` alanını taşıyor |
| 3 | farklı ajans | 403 | 403 | değişmedi — düzeltme kapıyı açmamış |
| 4 | mağaza rolü → kendi mağazası | 200 | 200 | değişmedi |
| 5 | mağaza rolü → ajans geneli | 200 | **403** | yetki genişlemesi kapandı |

### Kanıt gücü

- **SONRA** sütunu: çalışan sunucuya gerçek HTTP çağrısı.
- **ÖNCE** sütunu: `7a5a43f` öncesindeki sorgu şeklinin
  (`clientId/storeId: dto.X || undefined`) aynı canlı satırlar üzerinde
  tekrar oynatılması. Satır seçimi mantığı için birebir, ancak **eski kod
  deploy edilip HTTP atılmadı** — bu sütun replay'dir, HTTP ölçümü değil.

### Satır sayısı bütünlüğü

| Tablo | Ekleme öncesi | Ekleme sonrası | Silme sonrası |
|---|---|---|---|
| UserRole | 2 | 4 | 2 |
| User | 2 | 4 | 2 |
| AuditLog | 483 | 483 | 483 |

Artık kalmadı.
