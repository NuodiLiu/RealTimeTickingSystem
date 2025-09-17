// scripts/clear-db.js

// only use for local testing
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearDatabase() {
  console.log('Clearing ALL data…');

  try {
    await prisma.$transaction(async (tx) => {
      console.log('   Nulling KioskDevice.currentLockId…');
      await tx.kioskDevice.updateMany({ data: { currentLockId: null } });

      console.log('   Deleting FeedbackSession…');
      await tx.feedbackSession.deleteMany({});

      console.log('   Deleting Feedback…');
      await tx.feedback.deleteMany({});

      console.log('   Deleting KioskLock…');
      await tx.kioskLock.deleteMany({});

      console.log('   Deleting PairingSession…');
      await tx.pairingSession.deleteMany({});

      console.log('   Deleting Invite…');
      await tx.invite.deleteMany({});

      console.log('   Deleting Session…');
      await tx.session.deleteMany({});

      console.log('   Deleting IdpAccount…');
      await tx.idpAccount.deleteMany({});

      // 2) 父表
      console.log('    Deleting StudentCase…');
      await tx.studentCase.deleteMany({});

      console.log('   Deleting KioskDevice…');
      await tx.kioskDevice.deleteMany({});

      console.log('   Deleting Staff…');
      await tx.staff.deleteMany({});
    });

    console.log('Database cleared successfully.');
  } catch (err) {
    console.error('Failed to clear database:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();
