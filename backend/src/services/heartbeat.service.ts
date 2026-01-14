import { SignalRGateway } from '../signalr';
import { prisma } from '../lib/prisma';
import { SignalREventHandler } from '../signalr/eventHandler';

/**
 * 僵尸连接检测服务：
 * - 定期检测 isConnected=true 但 lastSeenAt 超时的设备
 * - 自动标记为离线并清理资源（防止设备异常断线未清理）
 * 
 * 新架构：
 * - iPad 通过 HTTP API 定期上报心跳（更新 lastSeenAt）
 * - Backend 通过 SignalR 实时推送任务/指令
 * - 本服务负责检测超时设备并清理资源
 */
export class HeartbeatService {
  private static zombieInterval: NodeJS.Timeout | null = null;
  private static isRunning = false;

  /**
   * 启动僵尸连接检测服务
   * @param intervalSeconds 检测间隔（秒），默认 90 秒
   */
  static start(intervalSeconds: number = 90) {
    if (this.isRunning) {
      console.log('⚠️ [Heartbeat] Service already running');
      return;
    }

    console.log(`🫀 [Heartbeat] Starting zombie detection service with ${intervalSeconds}s interval`);
    
    // 立即执行一次僵尸连接检测
    this.detectZombieConnections();
    
    // 定期检测僵尸连接
    this.zombieInterval = setInterval(() => {
      this.detectZombieConnections();
    }, intervalSeconds * 1000);
    
    this.isRunning = true;
    console.log('✅ [Heartbeat] Zombie detection service started');
  }

  /**
   * 停止僵尸连接检测服务
   */
  static stop() {
    if (this.zombieInterval) {
      clearInterval(this.zombieInterval);
      this.zombieInterval = null;
    }
    if (this.isRunning) {
      this.isRunning = false;
      console.log('🛑 [Heartbeat] Service stopped');
    }
  }

  /**
   * 检测僵尸连接并自动清理
   * - 找到 isConnected=true 但 lastSeenAt 超时的设备
   * - 自动触发 disconnect 逻辑（清理资源）
   */
  private static async detectZombieConnections() {
    const zombieThresholdMinutes = 5;
    try {
      const thresholdTime = new Date(Date.now() - zombieThresholdMinutes * 60 * 1000);

      const zombieDevices = await prisma.kioskDevice.findMany({
        where: {
          isConnected: true,
          lastSeenAt: {
            lt: thresholdTime
          },
          deletedAt: null
        },
        select: {
          id: true,
          name: true,
          lastSeenAt: true
        }
      });

      if (zombieDevices.length > 0) {
        console.log(`🧟 [Heartbeat] Found ${zombieDevices.length} zombie connection(s):`);
        
        for (const device of zombieDevices) {
          const minutesAgo = Math.floor((Date.now() - device.lastSeenAt.getTime()) / (1000 * 60));
          console.log(`  - ${device.name} (${device.id.slice(0, 8)}): last seen ${minutesAgo}min ago`);
          
          // 触发 disconnect 处理逻辑（清理资源）
          const eventHandler = new SignalREventHandler();
          await eventHandler.handleDeviceDisconnect(device.id, 'zombie-detection');
        }
        
        console.log(`✅ [Heartbeat] Cleaned up ${zombieDevices.length} zombie connection(s)`);
      }
    } catch (error) {
      console.error('❌ [Heartbeat] Zombie detection failed:', error);
    }
  }

  /**
   * 获取服务状态
   */
  static getStatus() {
    return {
      isRunning: this.isRunning,
      hasZombieInterval: this.zombieInterval !== null
    };
  }
}
