const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabaseState() {
  console.log('🔍 Checking database state for feedback sessions and locks...');
  
  try {
    // Check for active feedback sessions
    console.log('\n📝 Checking feedback sessions:');
    const feedbackSessions = await prisma.feedbackSession.findMany({
      where: {
        status: { in: ['CREATED', 'DELIVERED'] }
      },
      include: {
        case: {
          select: { id: true, studentName: true, status: true }
        },
        device: {
          select: { id: true, name: true, mode: true }
        }
      }
    });
    
    if (feedbackSessions.length > 0) {
      console.log(`   Found ${feedbackSessions.length} active feedback sessions:`);
      feedbackSessions.forEach(session => {
        console.log(`   - Session ${session.id.slice(0, 8)}... for device ${session.device.name} (${session.device.mode})`);
        console.log(`     Case: ${session.case.studentName} (${session.case.status})`);
        console.log(`     Session status: ${session.status}`);
      });
    } else {
      console.log('   ✅ No active feedback sessions found');
    }

    // Check for active locks
    console.log('\n🔒 Checking device locks:');
    const activeLocks = await prisma.kioskLock.findMany({
      where: {
        status: 'ACTIVE'
      },
      include: {
        case: {
          select: { id: true, studentName: true, status: true }
        },
        device: {
          select: { id: true, name: true, mode: true }
        }
      }
    });
    
    if (activeLocks.length > 0) {
      console.log(`   Found ${activeLocks.length} active locks:`);
      activeLocks.forEach(lock => {
        console.log(`   - Lock ${lock.id.slice(0, 8)}... for device ${lock.device.name} (${lock.device.mode})`);
        console.log(`     Case: ${lock.case.studentName} (${lock.case.status})`);
        console.log(`     Lock status: ${lock.status}`);
      });
    } else {
      console.log('   ✅ No active locks found');
    }

    // Check device states
    console.log('\n📱 Checking device states:');
    const devices = await prisma.kioskDevice.findMany({
      where: {
        deletedAt: null
      },
      include: {
        currentLock: {
          include: {
            case: {
              select: { id: true, studentName: true, status: true }
            }
          }
        }
      },
      orderBy: {
        lastSeenAt: 'desc'
      }
    });
    
    if (devices.length > 0) {
      console.log(`   Found ${devices.length} devices:`);
      devices.forEach(device => {
        console.log(`   - Device ${device.name} (${device.mode})`);
        console.log(`     Status: ${device.isOnline ? 'Online' : 'Offline'}`);
        console.log(`     Current lock: ${device.currentLock ? device.currentLock.id.slice(0, 8) + '... (' + device.currentLock.status + ')' : 'None'}`);
        if (device.currentLock) {
          console.log(`     Locked case: ${device.currentLock.case.studentName} (${device.currentLock.case.status})`);
        }
      });
    } else {
      console.log('   ✅ No devices found');
    }

    // Check for pending feedback cases
    console.log('\n📋 Checking cases with pending feedback:');
    const pendingCases = await prisma.studentCase.findMany({
      where: {
        status: 'RESOLVED_PENDING_FEEDBACK'
      },
      select: {
        id: true,
        studentName: true,
        category: true,
        status: true,
        resolvedAt: true
      }
    });
    
    if (pendingCases.length > 0) {
      console.log(`   Found ${pendingCases.length} cases pending feedback:`);
      pendingCases.forEach(case_ => {
        console.log(`   - Case ${case_.id.slice(0, 8)}... ${case_.studentName} (${case_.category})`);
        console.log(`     Status: ${case_.status}, Resolved: ${case_.resolvedAt}`);
      });
    } else {
      console.log('   ✅ No cases pending feedback');
    }

  } catch (error) {
    console.error('❌ Error checking database state:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkDatabaseState().catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
