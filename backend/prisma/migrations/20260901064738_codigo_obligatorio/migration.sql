/*
  Warnings:

  - You are about to drop the column `precio` on the `Producto` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[codigo]` on the table `Producto` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `codigo` to the `Producto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `precioVenta` to the `Producto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Producto" DROP COLUMN "precio",
ADD COLUMN     "categoria" TEXT,
ADD COLUMN     "codigo" TEXT NOT NULL,
ADD COLUMN     "precioCompra" DOUBLE PRECISION,
ADD COLUMN     "precioVenta" DOUBLE PRECISION NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigo_key" ON "Producto"("codigo");
