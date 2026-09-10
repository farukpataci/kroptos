# DATEV EXTF Buchungsstapel Dışa Aktarımı (KroptOS)

## 1. Genel Bakış ve Mimari Kararlar

Almanya pazarında e-ticaret ve perakende operasyonlarında muhasebe defterleri doğrudan işletme içinde değil, işletmenin yetkili **mali müşavirinin (Steuerberater)** DATEV Kanzlei sisteminde tutulur. 

Bu nedenle DATEV entegrasyonu bir "bulut API bağlantısı" değil, mali müşavire dönemsel olarak teslim edilen **EXTF (DATEV-Format) Buchungsstapel** dosya üreticisidir.

> [!IMPORTANT]
> **Registry Karar Kapısı (§2.1):** DATEV bir aktif ağ konnektörü (network connector) veya `AccountingTokenStore` tüketicisi olmadığı için Phase 1 kapsamında `core/AccountingProviderRegistry` içine eklenmemiştir. `AccountingModule` altında bağımsız ve deterministic dosya dışa aktarım servisi olarak çalışır.

---

## 2. Resmi Şartname Referansları (§4.4)

| Parametre | Değer / Kural | Kaynak / Not |
| :--- | :--- | :--- |
| **Resmi Standart Dokümanı** | Dok.-Nr. 1036228 & Dok.-Nr. 1003221 | [DATEV Hilfe-Center: Formatbeschreibung DATEV-Format](https://help-center.datev.de) |
| **Format Başlığı (Kopfzeile)** | `EXTF;700;21;"Buchungsstapel";13;...` | Format 700, Kategori 21 (Buchungssatz), Versiyon 13 |
| **Satır Sonu (EOL)** | CRLF (`\r\n`) | DATEV Windows masaüstü yazılımları kesinlikle CRLF bekler |
| **Ayraç** | Noktalı virgül (`;`) | Alan içi tırnak: `""` |
| **Sütun Sayısı** | 125 Sütun | Dok.-Nr. 1036228 uyarınca tam Satzaufbau |
| **Karakter Kodlaması** | `WINDOWS-1252` (Varsayılan) / `UTF-8` | [DOCUMENTATION_REQUIRED] DATEV altyapısı varsayılan olarak Windows-1252 (ANSI) bekler. Kodlanamayan karakterler sessizce kaybedilmez, `DatevEncodingError` fırlatılır. |
| **Ondalık Ayracı** | Virgül (`,`) | Örneğin: `119,00` |

---

## 3. §4.4 Kontrol Listesi & Teknik Kurallar

### 3.1. Tutarlar ve Yön (Soll / Haben) (§5.3)
- DATEV formatında **tutar (`Umsatz`) her zaman pozitif bir sayıdır**. Asla eksi (`-`) işaretli olamaz.
- Alacak ve borç yönü kesinlikle **Soll/Haben-Kennzeichen** ile belirlenir:
  - `S` = Soll (Borç)
  - `H` = Haben (Alacak)
- İadeler ve iptallerde (Gutschrift / Storno), tutar yine pozitif tutulur; kayıt yönü `S` $\leftrightarrow$ `H` ters çevrilir veya Generalumkehr bayrağı kullanılır.

### 3.2. Festschreibung (Kayıt Kilitleme) (§5.6)
- KroptOS varsayılanı: **`0` (Keine Festschreibung / Değiştirilebilir taslak)**.
- **Kritik DATEV Özelliği:** Eğer Festschreibung sütunu (sütun 114) boş bırakılırsa, DATEV içe aktarma sırasında fişleri **otomatik olarak kilitler (`1`)**. Bu sebeple Steuerberater'in fişler üzerinde düzeltme yapabilmesi için sütuna açıkça `0` yazılmaktadır. Operatör arayüzden kilitlemeli aktarımı (`1`) da seçebilir.

### 3.3. Hesap Numaraları ve Uzunluklar (§5.5, §6.1)
- **Sachkontenlänge:** 4 ile 8 hane arasında olmalıdır (Standart: 4 hane).
- **Personenkontenlänge (Debitor):** Kesinlikle `Sachkontenlänge + 1` hanedir.
  - Örneğin Sachkonto 4 hane ise $\rightarrow$ Debitor hesapları **5 hanelidir** (Aralık: `10000` – `69999`).
  - Sachkonto 5 hane ise $\rightarrow$ Debitor hesapları **6 hanelidir** (Aralık: `100000` – `699999`).
- Standart Sachkonten (SKR03 / SKR04), hesap uzunluğu 4'ten büyük olduğunda sağdan sıfırla tamamlanır (ör. 8400 $\rightarrow$ 84000).

### 3.4. Kontenrahmen (Hesap Planı): SKR03 vs SKR04
- Operatör mali müşavirinden bu bilgiyi alarak seçim yapmalıdır. Sistemsel bir varsayılan atanmaz.
- **SKR03 (Süreç Odaklı):**
  - Erlöse %19 MwSt: `8400` (Otomatik vergi hesaplama)
  - Erlöse %7 MwSt: `8300` (Otomatik vergi hesaplama)
  - Steuerfrei (§4 Nr. 1a UStG / Drittland): `8120`
  - Innergemeinschaftliche Lieferung (§4 Nr. 1b UStG): `8125`
  - Banka: `1200`, Kasa: `1000`, Alıcılar (Sammelkonto): `1400`
- **SKR04 (Finansal Tablo Odaklı):**
  - Erlöse %19 MwSt: `4400` (Otomatik vergi hesaplama)
  - Erlöse %7 MwSt: `4300` (Otomatik vergi hesaplama)
  - Steuerfrei: `4120`, Innergemeinschaftliche Lieferung: `4125`
  - Banka: `1800`, Kasa: `1600`, Alıcılar (Sammelkonto): `1200`
- DATEV Automatik-Konten kullanıldığında ayrıca BU-Schlüssel verilmesine gerek yoktur (alan boş bırakılır).

### 3.5. Belegfeld 1 ve Metin Kısıtlamaları (§4.4)
- **Belegfeld 1 (Rechnungsnummer / Fatura No):**
  - Azami 36 karakter.
  - İzin verilen karakterler: `^[a-zA-Z0-9$&%*+\-\/]{1,36}$`
  - Boşluk, nokta, virgül, Türkçe/Almanca karakterler (ö, ü, ä, ş, ğ, ç) veya geçersiz simgeler sanitizasyonla tireye (`-`) dönüştürülür.
- **Buchungstext:** Azami 60 karakter. Sekme ve yeni satırlar temizlenir.

---

## 4. İki Ayrı Hat Disiplini: DATEV EXTF vs ZUGFeRD / XRechnung

KroptOS terminolojisinde karışıklığı önlemek için iki kavram birbirinden kesin çizgilerle ayrılmıştır:

1. **DATEV EXTF Buchungsstapel (Bu Modül):**
   - **Hedef Kitle:** Mali Müşavir (Steuerberater).
   - **Format:** CSV tabanlı DATEV EXTF 700/21 standardı.
   - **Amaç:** Toplu satış, iade ve tahsilat fişlerinin muhasebeleştirilmesi.
2. **ZUGFeRD & XRechnung (Elektronik Fatura Standardı):**
   - **Hedef Kitle:** Son alıcı müşteri / kamu kurumu (B2G/B2B e-rechnung).
   - **Format:** PDF/A-3 içine gömülü UN/CEFACT CII veya UBL XML.
   - **Amaç:** Faturanın resmi iletimi.
   - **Durum:** EXTF ihracı ile ZUGFeRD birbirinin yerine geçmez; ayrı bir dosya/iletim hattıdır.

---

## 5. GoBD Değişmezlik ve Çift Kayıt Koruması (§8.4)

Alman GoBD (Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung von Büchern) mevzuatı gereği muhasebe kayıtlarının izlenebilirliği ve değişmezliği esastır:
- Dışa aktarılan her sipariş için `AccountingDocument` üzerinde `type: 'datev_export'` ve `referenceCode: orderId` ile kalıcı bir claim tutulur.
- Bir sipariş daha önce dışa aktarılmışsa, sistem varsayılan olarak işlemi engeller (`DatevReexportError`).
- Steuerberater talebiyle zorunlu tekrar aktarım gerekiyorsa, operatörün açıkça `acknowledgeReexport = true` onayını vermesi zorunludur. Tüm tekrar aktarımlar `AuditLog` üzerinde zaman damgası ve kullanıcı kimliğiyle kayıt altına alınır.
- Her dışa aktarılan dosyanın SHA-256 özeti hesaplanır ve metaveride saklanır.

---

## 6. Faz 2 Yol Haritası (DATEV Data Services API)

Gelecek fazda doğrudan bulut entegrasyonu (mali müşavire dosya göndermeden doğrudan DATEV bulutuna yükleme) için gerekenler:
1. **DATEV Marktplatz Ortaklığı:** DATEV Partnerprogramma kayıt ve güvenlik denetimi.
2. **DATEV Rechnungsdatenservice 1.0 / 2.0:**
   - REST API üzerinden fatura görseli (PDF) ve yapılandırılmış veri gönderimi.
   - OAuth 2.0 PKCE yetkilendirme akışı (DATEV Connect online).
   - mTLS ve DATEV SmartCard / DATEV SmartLogin istemci sertifikaları.
