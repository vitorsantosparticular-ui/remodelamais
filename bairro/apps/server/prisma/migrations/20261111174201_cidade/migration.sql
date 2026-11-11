-- CreateEnum
CREATE TYPE "MoneyAccount" AS ENUM ('WALLET', 'BANK');

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "bairro" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "arrivesAt" TIMESTAMP(3),
ADD COLUMN     "bankCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "location" TEXT NOT NULL DEFAULT 'campo-ourique',
ADD COLUMN     "shiftsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shiftsDay" TEXT,
ADD COLUMN     "travelFrom" TEXT,
ADD COLUMN     "travelMode" TEXT,
ADD COLUMN     "travelStart" TIMESTAMP(3),
ADD COLUMN     "travelTo" TEXT,
ADD COLUMN     "walletCents" INTEGER NOT NULL DEFAULT 15000,
ADD COLUMN     "workJob" TEXT,
ADD COLUMN     "workStart" TIMESTAMP(3),
ADD COLUMN     "workUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "account" "MoneyAccount" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "memo" TEXT NOT NULL DEFAULT '',
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "rentWeek" INTEGER NOT NULL,
    "ownerId" TEXT,
    "tenantId" TEXT,
    "rentPaidUntil" TIMESTAMP(3),
    "roomId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyHistory" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "purchasePrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_createdAt_idx" ON "LedgerEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Property_roomId_key" ON "Property"("roomId");

-- CreateIndex
CREATE INDEX "Property_bairro_idx" ON "Property"("bairro");

-- CreateIndex
CREATE INDEX "PropertyHistory_propertyId_createdAt_idx" ON "PropertyHistory"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "Vehicle_ownerId_idx" ON "Vehicle"("ownerId");

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyHistory" ADD CONSTRAINT "PropertyHistory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyHistory" ADD CONSTRAINT "PropertyHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
