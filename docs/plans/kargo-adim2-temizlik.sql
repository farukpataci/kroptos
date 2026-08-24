-- Kargo Adım 2 — veri temizliği (FK'den ÖNCE çalıştırılır)
--
-- WmsShippingLabel.shipmentId'yi Shipment.id'ye bağlayan FK eklenmeden önce
-- kolondaki öksüz değerler boşaltılmalı. Tek satır var ve gerçek bir gönderiye
-- ait değil: wms-label.service.ts takip numarasını Math.random() ile, shipmentId'yi
-- 'sh-1002' gibi elle uydurulmuş bir sabitle üretiyordu. Karşılığı olan bir Shipment
-- hiç var olmadı.
--
-- Satır SİLİNMEZ: WMS etiket geçmişi kalır, yalnız sahte bağ koparılır.

UPDATE "WmsShippingLabel"
SET "shipmentId" = NULL
WHERE "shipmentId" IS NOT NULL
  AND "shipmentId" NOT IN (SELECT "id" FROM "Shipment");
