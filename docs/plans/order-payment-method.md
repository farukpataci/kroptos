# `Order.paymentMethod` eksik — kapıda ödeme bilgisi kayboluyor

**Durum:** açık iş, ayrı chore. Kod değişikliği yapılmadı.
**Bulunma tarihi:** 2026-08-24, WMS etiket akışı gönderi servisine bağlanırken.

`Order` ödeme tarafında yalnız `paymentStatus` (`pending | paid | partially_refunded |
refunded | failed`) tutuyor. Ödemenin **nasıl** yapıldığı — havale, kredi kartı,
kapıda ödeme — hiçbir kolonda yok.

Kargo tarafında bunun bedeli somut: `CreateShipmentRequest.paymentType`
(`sender_pays | recipient_pays | cod`) ve `codAmount` taşıyıcıya gidiyor ve
kapıda ödemede kurye tahsil edecek tutarı oradan okuyor. Bugün bu bilgi yalnız
`POST /api/wms/labels` gövdesinden geliyor: paketçi beyan ediyor, varsayılan
`sender_pays`.

Yani pazaryerinden kapıda ödemeli gelen bir sipariş, sisteme girdiği anda bu
niteliğini kaybediyor; paketleme ekranında biri hatırlayıp elle işaretlemezse
kurye tahsilat yapmadan paketi teslim ediyor.

## Neden istek seviyesinde bırakıldı

Kalıcı çözüm `Order`'a ait, ama oraya yazacak veri de yok: mapper'ların hiçbiri
şu an pazaryerinden ödeme yöntemi okumuyor. Şema kolonu tek başına eklenirse
NULL kalır ve sorun çözülmüş gibi görünür. Doğru sıra:

1. `Order.paymentMethod String?` (+ gerekirse `codAmount Decimal?`) eklenir.
2. Mapper'lar pazaryerinin ödeme alanını okur — Türkiye pazaryerlerinde kapıda
   ödeme yaygın olduğu için önce o altısı.
3. `wms-label.service.ts` `dto.paymentType ?? order.paymentMethod ?? 'sender_pays'`
   sırasıyla okur; istekteki değer yalnız **override** olur, tek kaynak olmaktan
   çıkar.

Adım 2 yapılmadan 1 ve 3 yapılmamalı.

## Kapsam

- Bu not kargo işinin parçası değil.
- `wms-label.service.ts`'teki mevcut davranış (COD'da `codAmount` zorunlu, aksi
  hâlde 400) yerinde kalır; kalıcı çözüm geldiğinde de gerekli — override
  edilmiş bir COD'un tutarı yine bilinmek zorunda.
