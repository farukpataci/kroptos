-- CreateIndex
CREATE INDEX "WmsShippingLabel_shipmentId_idx" ON "WmsShippingLabel"("shipmentId");

-- AddForeignKey
ALTER TABLE "WmsShippingLabel" ADD CONSTRAINT "WmsShippingLabel_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

