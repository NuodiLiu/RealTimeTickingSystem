import { FeedbackService } from '../../src/services/feedback.service';
import { BadRequestError, NotFoundError } from '../../src/error';
import { DeviceGateway } from '../../src/websocket/deviceSocket';
import * as feedbackUtils from '../../src/services/utils/feedback.utils';

jest.mock('../../src/lib/prisma', () => ({
    prisma: {
        $transaction: jest.fn(),
        kioskDevice: {
            findUnique: jest.fn(),
        }
    }
}));

jest.mock('../../src/websocket/deviceSocket', () => ({
    DeviceGateway: {
        publish: jest.fn(),
    }
}));

jest.mock('../../src/services/utils/feedback.utils', () => ({
    loadBasics: jest.fn(),
    assertModeAllowsFeedback: jest.fn(),
    assertOnline: jest.fn(),
    findActiveLock: jest.fn(),
    throwBusy: jest.fn(),
    computeTimes: jest.fn(),
    createSessionTx: jest.fn(),
    createLockTx: jest.fn(),
    casBindCurrentLock: jest.fn(),
    markCasePendingIfNeeded: jest.fn(),
}));

const { prisma } = require('../../src/lib/prisma');
const mockDeviceGateway = DeviceGateway as jest.Mocked<typeof DeviceGateway>;
const mockUtils = feedbackUtils as jest.Mocked<typeof feedbackUtils>;

describe('FeedbackService.sendFeedback', () => {
    const mockSendFeedbackArgs = {
        caseId: 'case-123',
        deviceId: 'device-456',
        staffId: 'staff-789'
    };

    const mockBasics = {
        scase: {
            id: 'case-123',
            status: 'IN_PROGRESS',
            studentName: 'John Doe',
            category: 'Academic'
        },
        device: {
            id: 'device-456',
            mode: 'DUAL',
            lastSeenAt: new Date(Date.now() - 30000), // 30 seconds ago
            name: 'Kiosk Device 1'
        },
        staff: {
            id: 'staff-789',
            name: 'Jane Smith',
            role: 'STAFF'
        }
    };

    const mockTimes = {
        now: new Date(),
        leaseExpireAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        sessionExpireAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    };

    const mockSession = {
        id: 'session-123',
        caseId: 'case-123',
        staffId: 'staff-789',
        deviceId: 'device-456',
        status: 'CREATED',
        expireAt: mockTimes.sessionExpireAt
    };

    const mockLock = {
        id: 'lock-456',
        deviceId: 'device-456',
        staffId: 'staff-789',
        caseId: 'case-123',
        status: 'ACTIVE',
        version: 1,
        leaseExpireAt: mockTimes.leaseExpireAt
    };

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockUtils.loadBasics.mockResolvedValue(mockBasics);
        mockUtils.assertModeAllowsFeedback.mockReturnValue(undefined);
        mockUtils.assertOnline.mockReturnValue(undefined);
        mockUtils.findActiveLock.mockResolvedValue(null);
        mockUtils.computeTimes.mockReturnValue(mockTimes);
        mockUtils.createSessionTx.mockResolvedValue(mockSession);
        mockUtils.createLockTx.mockResolvedValue(mockLock);
        mockUtils.casBindCurrentLock.mockResolvedValue(undefined);
        mockUtils.markCasePendingIfNeeded.mockResolvedValue(undefined);
        
        prisma.$transaction.mockImplementation(async (callback: any) => {
            const mockTx = {
                kioskDevice: {
                    findUnique: jest.fn().mockResolvedValue({ id: 'device-456', mode: 'DUAL' })
                }
            };
            return await callback(mockTx);
        });
    });

    it('should successfully send feedback when all conditions are met', async () => {
        const result = await FeedbackService.sendFeedback(mockSendFeedbackArgs);

        expect(mockUtils.loadBasics).toHaveBeenCalledWith(prisma, mockSendFeedbackArgs);
        expect(mockUtils.assertModeAllowsFeedback).toHaveBeenCalledWith('DUAL');
        expect(mockUtils.assertOnline).toHaveBeenCalledWith(mockBasics.device.lastSeenAt);
        expect(mockUtils.findActiveLock).toHaveBeenCalledWith(prisma, 'device-456');
        expect(mockUtils.computeTimes).toHaveBeenCalled();
        
        expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
        expect(mockUtils.createSessionTx).toHaveBeenCalled();
        expect(mockUtils.createLockTx).toHaveBeenCalled();
        expect(mockUtils.casBindCurrentLock).toHaveBeenCalled();
        expect(mockUtils.markCasePendingIfNeeded).toHaveBeenCalled();

        expect(mockDeviceGateway.publish).toHaveBeenCalledWith('device-456', {
            type: 'SHOW_FEEDBACK',
            payload: {
                sessionId: 'session-123',
                caseId: 'case-123',
                staff: { id: 'staff-789', name: 'Jane Smith' },
                expireAt: mockTimes.sessionExpireAt.toISOString(),
            },
        });

        expect(result).toEqual({
            session: {
                id: 'session-123',
                status: 'CREATED',
                deviceId: 'device-456',
                caseId: 'case-123',
                expireAt: mockTimes.sessionExpireAt
            },
            lock: {
                id: 'lock-456',
                status: 'ACTIVE',
                version: 1,
                leaseExpireAt: mockTimes.leaseExpireAt
            },
            case: {
                id: 'case-123',
                status: 'RESOLVED_PENDING_FEEDBACK'
            }
        });
    });

    it('should throw BadRequestError when caseId is missing', async () => {
        const invalidArgs = { ...mockSendFeedbackArgs, caseId: '' };

        await expect(FeedbackService.sendFeedback(invalidArgs))
            .rejects
            .toThrow(BadRequestError);

        expect(mockUtils.loadBasics).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError when deviceId is missing', async () => {
        const invalidArgs = { ...mockSendFeedbackArgs, deviceId: '' };

        await expect(FeedbackService.sendFeedback(invalidArgs))
            .rejects
            .toThrow(BadRequestError);

        expect(mockUtils.loadBasics).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError when staffId is missing', async () => {
        const invalidArgs = { ...mockSendFeedbackArgs, staffId: '' };

        await expect(FeedbackService.sendFeedback(invalidArgs))
            .rejects
            .toThrow(BadRequestError);

        expect(mockUtils.loadBasics).not.toHaveBeenCalled();
    });

    it('should throw error when device mode does not allow feedback', async () => {
        const mockError = new Error('Mode does not allow feedback');
        mockUtils.assertModeAllowsFeedback.mockImplementation(() => {
            throw mockError;
        });

        await expect(FeedbackService.sendFeedback(mockSendFeedbackArgs))
            .rejects
            .toThrow(mockError);

        expect(mockUtils.assertModeAllowsFeedback).toHaveBeenCalledWith('DUAL');
        expect(mockUtils.findActiveLock).not.toHaveBeenCalled();
    });

    it('should throw error when device is offline', async () => {
        const mockError = new Error('Device is offline');
        mockUtils.assertOnline.mockImplementation(() => {
            throw mockError;
        });

        await expect(FeedbackService.sendFeedback(mockSendFeedbackArgs))
            .rejects
            .toThrow(mockError);

        expect(mockUtils.assertOnline).toHaveBeenCalledWith(mockBasics.device.lastSeenAt);
        expect(mockUtils.findActiveLock).not.toHaveBeenCalled();
    });

    it('should throw busy error when device has active lock', async () => {
        const activeLock = { id: 'existing-lock', status: 'ACTIVE' };
        const busyError = new Error('Device is busy');
        
        mockUtils.findActiveLock.mockResolvedValue(activeLock);
        mockUtils.throwBusy.mockImplementation(() => {
            throw busyError;
        });

        await expect(FeedbackService.sendFeedback(mockSendFeedbackArgs))
            .rejects
            .toThrow(busyError);

        expect(mockUtils.findActiveLock).toHaveBeenCalledWith(prisma, 'device-456');
        expect(mockUtils.throwBusy).toHaveBeenCalledWith(activeLock);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when device not found in transaction', async () => {
        prisma.$transaction.mockImplementation(async (callback: any) => {
            const mockTx = {
                kioskDevice: {
                    findUnique: jest.fn().mockResolvedValue(null)
                }
            };
            return await callback(mockTx);
        });

        await expect(FeedbackService.sendFeedback(mockSendFeedbackArgs))
            .rejects
            .toThrow(NotFoundError);
    });

    it('should handle resolved case status correctly', async () => {
        const resolvedCase = { ...mockBasics.scase, status: 'RESOLVED' };
        mockUtils.loadBasics.mockResolvedValue({
            ...mockBasics,
            scase: resolvedCase
        });

        const result = await FeedbackService.sendFeedback(mockSendFeedbackArgs);

        expect(result.case.status).toBe('RESOLVED');
    });

    it('should verify transaction calls with correct parameters', async () => {
        await FeedbackService.sendFeedback(mockSendFeedbackArgs);

        expect(mockUtils.createSessionTx).toHaveBeenCalledWith(
            expect.any(Object), // tx
            {
                caseId: 'case-123',
                staffId: 'staff-789',
                deviceId: 'device-456',
                expireAt: mockTimes.sessionExpireAt
            }
        );

        expect(mockUtils.createLockTx).toHaveBeenCalledWith(
            expect.any(Object), // tx
            {
                deviceId: 'device-456',
                staffId: 'staff-789',
                caseId: 'case-123',
                leaseExpireAt: mockTimes.leaseExpireAt
            }
        );

        expect(mockUtils.casBindCurrentLock).toHaveBeenCalledWith(
            expect.any(Object), // tx
            'device-456',
            'lock-456',
            'busy'
        );

        expect(mockUtils.markCasePendingIfNeeded).toHaveBeenCalledWith(
            expect.any(Object), // tx
            'case-123',
            'IN_PROGRESS'
        );
    });

    it('should publish websocket message with correct payload structure', async () => {
        await FeedbackService.sendFeedback(mockSendFeedbackArgs);

        expect(mockDeviceGateway.publish).toHaveBeenCalledTimes(1);
        expect(mockDeviceGateway.publish).toHaveBeenCalledWith('device-456', {
            type: 'SHOW_FEEDBACK',
            payload: {
                sessionId: 'session-123',
                caseId: 'case-123',
                staff: {
                    id: 'staff-789',
                    name: 'Jane Smith'
                },
                expireAt: mockTimes.sessionExpireAt.toISOString(),
            },
        });
    });

    it('should verify all utility functions are called in correct order', async () => {
        await FeedbackService.sendFeedback(mockSendFeedbackArgs);

        expect(mockUtils.loadBasics).toHaveBeenCalled();
        expect(mockUtils.assertModeAllowsFeedback).toHaveBeenCalled();
        expect(mockUtils.assertOnline).toHaveBeenCalled();
        expect(mockUtils.findActiveLock).toHaveBeenCalled();
        expect(mockUtils.computeTimes).toHaveBeenCalled();
    });
});