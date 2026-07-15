import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  omit: {
    user: {
      password: true,
    },
  },
});

// Handle connection issues
async function connectPrisma() {
  try {
    await prisma.$connect();
    console.log('✅ Prisma connected to the database successfully!');
  } catch (error) {
    console.error('❌ Prisma connection failed:', error);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await prisma.$disconnect();
    console.log('🧩 Prisma disconnected due to application termination.');
    process.exit(0);
  });
}

connectPrisma();

export default prisma;
