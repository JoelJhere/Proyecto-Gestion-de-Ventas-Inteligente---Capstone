-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "estado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "stockMinimo" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "unidadMedida" TEXT NOT NULL DEFAULT 'Unidades';
