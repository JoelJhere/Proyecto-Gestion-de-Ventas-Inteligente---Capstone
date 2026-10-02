import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Verificar si ya existe una configuración
  let negocio = await prisma.businessConfig.findFirst();

  // SOLO creamos la configuración si la tabla está completamente vacía
  if (!negocio) {
    negocio = await prisma.businessConfig.create({
      data: {
        nombre: 'Mi Negocio',
        ruc: '', 
        direccion: '',
        mensajeTicket: '¡Gracias por su preferencia!',
        impuestoPorcentaje: 18.0
      },
    });
    console.log('Negocio creado por defecto:', negocio.nombre);
  } else {
    console.log('La configuración del negocio ya existe. Omitiendo creación.');
  }

  // 2. Verificar si ya existe algún Administrador en el sistema
  const existingAdmin = await prisma.user.findFirst({
    where: { rol: 'ADMIN' }
  });

  // SOLO creamos el admin genérico si no hay ninguno registrado
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const admin = await prisma.user.create({
      data: {
        nombre: 'Dueño Administrador',
        email: 'admin@minegocio.com',
        password: hashedPassword,
        rol: 'ADMIN',
      },
    });
    console.log('Administrador genérico creado con email:', admin.email);
  } else {
    console.log('Ya existe un administrador en el sistema. Omitiendo creación.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });