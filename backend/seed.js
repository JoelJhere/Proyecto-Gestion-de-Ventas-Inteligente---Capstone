import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Crear la configuración del negocio
  const negocio = await prisma.businessConfig.create({
    data: {
      nombre: 'Abarrotes AJ',
      ruc: '20123456789', 
      direccion: 'Cajamarca, Perú',
    },
  });
  console.log('Negocio creado:', negocio.nombre);

  // 2. Encriptar contraseña y crear al Dueño (Admin)
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.create({
    data: {
      nombre: 'Dueño Administrador',
      email: 'admin@abarrotesaj.com',
      password: hashedPassword,
      rol: 'ADMIN',
    },
  });
  console.log('Administrador creado con email:', admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });