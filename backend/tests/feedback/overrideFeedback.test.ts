import { FeedbackService } from '../../src/services/feedback.service';
import { BadRequestError, ConflictError, NotFoundError } from '../../src/error';
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
    computeTimes: jest.fn(),
    createSessionTx: jest.fn(),
    createLockTx: jest.fn(),
    casBindCurrentLock: jest.fn(),
    markCasePendingIfNeeded: jest.fn(),
    preconditionFailed: jest.fn(),
    clearDevicePointerToLock: jest.fn(),
    overrideOldLockTx: jest.fn(),
    overrideActiveSessionsOnDevice: jest.fn(),
}));

const { prisma } = require('../../src/lib/prisma');
const mockDeviceGateway = DeviceGateway as jest.Mocked<typeof DeviceGateway>;
const mockUtils = feedbackUtils as jest.Mocked<typeof feedbackUtils>;

describe('FeedbackService.overrideFeedback', () => {
    const mockOverrideFeedbackArgs = {
        caseId: 'case-123',
        deviceId: 'device-456',
        staffId: 'staff-789',
        expectedLockId: 'lock-999',
        expectedVersion: 5
    }

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

    const mockCurrentLock = {
        id: 'lock-999',
        version: 5,
        status: 'ACTIVE',
        deviceId: 'device-456',
        caseId: 'case-123'
    };

    const mockTimes = {
        now: new Date(),
        leaseExpireAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        sessionExpireAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    };

    const mockNewSession = {
        id: 'new-session-123',
        caseId: 'case-123',
        staffId: 'staff-789',
        deviceId: 'device-456',
        status: 'CREATED',
        expireAt: mockTimes.sessionExpireAt
    };

    const mockNewLock = {
        id: 'new-lock-456',
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
        mockUtils.findActiveLock.mockResolvedValue(mockCurrentLock);
        mockUtils.computeTimes.mockReturnValue(mockTimes);
        mockUtils.createSessionTx.mockResolvedValue(mockNewSession);
        mockUtils.createLockTx.mockResolvedValue(mockNewLock);
        mockUtils.casBindCurrentLock.mockResolvedValue(undefined);
        mockUtils.markCasePendingIfNeeded.mockResolvedValue(undefined);
        mockUtils.clearDevicePointerToLock.mockResolvedValue(undefined);
        mockUtils.overrideOldLockTx.mockResolvedValue(undefined);
        mockUtils.overrideActiveSessionsOnDevice.mockResolvedValue(undefined);
        
        prisma.$transaction.mockImplementation(async (callback: any) => {
            const mockTx = {
                kioskDevice: {
                    findUnique: jest.fn().mockResolvedValue({ id: 'device-456', mode: 'DUAL' })
                }
            };
            return await callback(mockTx);
        });
    });

    it('should successfully override feedback when all conditions met', async () => {
        const result = await FeedbackService.overrideFeedback(mockOverrideFeedbackArgs);

        expect(mockUtils.loadBasics).toHaveBeenCalledWith(prisma, {
            caseId: 'case-123',
            deviceId: 'device-456',
            staffId: 'staff-789'
        });
        expect(mockUtils.assertModeAllowsFeedback).toHaveBeenCalledWith('DUAL');
        expect(mockUtils.assertOnline).toHaveBeenCalledWith(mockBasics.device.lastSeenAt);
        expect(mockUtils.findActiveLock).toHaveBeenCalledWith(prisma, 'device-456');

        expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
        
        expect(mockDeviceGateway.publish).toHaveBeenCalledTimes(2);
        expect(mockDeviceGateway.publish).toHaveBeenNthCalledWith(1, 'device-456', { type: 'DISMISS' });
        expect(mockDeviceGateway.publish).toHaveBeenNthCalledWith(2, 'device-456', {
            type: 'SHOW_FEEDBACK',
            payload: {
                sessionId: 'new-session-123',
                caseId: 'case-123',
                staff: { id: 'staff-789', name: 'Jane Smith' },
                expireAt: mockTimes.sessionExpireAt.toISOString(),
            },
        });

        expect(result).toEqual({
            previous: { lockId: 'lock-999', status: 'OVERRIDDEN' },
            session: {
                id: 'new-session-123',
                status: 'CREATED',
                deviceId: 'device-456',
                caseId: 'case-123',
                expireAt: mockTimes.sessionExpireAt
            },
            lock: {
                id: 'new-lock-456',
                status: 'ACTIVE',
                version: 1,
                leaseExpireAt: mockTimes.leaseExpireAt
            }
        });
    })

    
    it('should throw BadRequestError when caseId is missing', async () => {
        const invalidArgs = { ...mockOverrideFeedbackArgs, caseId: ''};
        await expect(FeedbackService.overrideFeedback(invalidArgs))
            .rejects
            .toThrow(BadRequestError);

        expect(mockUtils.loadBasics).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError when deviceId is missing', async () => {
        const invalidArgs = { ...mockOverrideFeedbackArgs, deviceId: '' };

        await expect(FeedbackService.overrideFeedback(invalidArgs))
            .rejects
            .toThrow(BadRequestError);

        expect(mockUtils.loadBasics).not.toHaveBeenCalled();
    })



    it('should throw BadRequestError when staffId is missing', async () => {
        const invalidArgs = { ...mockOverrideFeedbackArgs, staffId: '' };

        await expect(FeedbackService.overrideFeedback(invalidArgs))
            .rejects
            .toThrow(BadRequestError);

        expect(mockUtils.loadBasics).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError when expectedLockId is missing', async () => {
        const invalidArgs = { ...mockOverrideFeedbackArgs, expectedLockId: '' };

        await expect(FeedbackService.overrideFeedback(invalidArgs))
            .rejects
            .toThrow(BadRequestError);

        expect(mockUtils.loadBasics).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError when expectedVersion is null', async () => {
        const invalidArgs = { ...mockOverrideFeedbackArgs, expectedVersion: null as any };

        await expect(FeedbackService.overrideFeedback(invalidArgs))
            .rejects
            .toThrow(BadRequestError);

        expect(mockUtils.loadBasics).not.toHaveBeenCalled();
    });

    it('should throw ConflictError with idle code when no active lock exists', async () => {
        mockUtils.findActiveLock.mockResolvedValue(null);

        await expect(FeedbackService.overrideFeedback(mockOverrideFeedbackArgs))
            .rejects
            .toThrow(ConflictError);

        try {
            await FeedbackService.overrideFeedback(mockOverrideFeedbackArgs);
        } catch (error: any) {
            expect(error.code).toBe('idle');
            expect(error.message).toBe('Device is not busy');
        }

        expect(mockUtils.preconditionFailed).not.toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should call preconditionFailed when lock ID does not match', async () => {
        const mismatchedLock = { ...mockCurrentLock, id: 'different-lock-id' };
        mockUtils.findActiveLock.mockResolvedValue(mismatchedLock);
        mockUtils.preconditionFailed.mockImplementation(() => {
            throw new Error('Precondition failed');
        });

        await expect(FeedbackService.overrideFeedback(mockOverrideFeedbackArgs))
            .rejects
            .toThrow('Precondition failed');

        expect(mockUtils.preconditionFailed).toHaveBeenCalledWith(mismatchedLock);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should call preconditionFailed when lock version does not match', async () => {
        const mismatchedLock = { ...mockCurrentLock, version: 999 };
        mockUtils.findActiveLock.mockResolvedValue(mismatchedLock);
        mockUtils.preconditionFailed.mockImplementation(() => {
            throw new Error('Precondition failed');
        });

        await expect(FeedbackService.overrideFeedback(mockOverrideFeedbackArgs))
            .rejects
            .toThrow('Precondition failed');

        expect(mockUtils.preconditionFailed).toHaveBeenCalledWith(mismatchedLock);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw error when device mode does not allow feedback', async () => {
        const mockError = new Error('Mode does not allow feedback');
        mockUtils.assertModeAllowsFeedback.mockImplementation(() => {
            throw mockError;
        });

        await expect(FeedbackService.overrideFeedback(mockOverrideFeedbackArgs))
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

        await expect(FeedbackService.overrideFeedback(mockOverrideFeedbackArgs))
            .rejects
            .toThrow(mockError);

        expect(mockUtils.assertOnline).toHaveBeenCalledWith(mockBasics.device.lastSeenAt);
        expect(mockUtils.findActiveLock).not.toHaveBeenCalled();
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

        await expect(FeedbackService.overrideFeedback(mockOverrideFeedbackArgs))
            .rejects
            .toThrow(NotFoundError);
    });

    it('should verify transaction calls with correct parameters', async () => {
        await FeedbackService.overrideFeedback(mockOverrideFeedbackArgs);

        expect(mockUtils.clearDevicePointerToLock).toHaveBeenCalledWith(
            expect.any(Object), // tx
            'device-456',
            'lock-999'
        );

        expect(mockUtils.overrideOldLockTx).toHaveBeenCalledWith(
            expect.any(Object), // tx
            'lock-999',
            5,
            mockTimes.now
        );

        expect(mockUtils.overrideActiveSessionsOnDevice).toHaveBeenCalledWith(
            expect.any(Object), // tx
            'device-456',
            'staff-789',
            mockTimes.now
        );

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
            'new-lock-456',
            'precondition_failed'
        );

        expect(mockUtils.markCasePendingIfNeeded).toHaveBeenCalledWith(
            expect.any(Object), // tx
            'case-123',
            'IN_PROGRESS'
        );
    });

    it('should publish websocket messages in correct order', async () => {
        await FeedbackService.overrideFeedback(mockOverrideFeedbackArgs);

        expect(mockDeviceGateway.publish).toHaveBeenCalledTimes(2);
        
        const calls = mockDeviceGateway.publish.mock.calls;
        expect(calls[0]).toEqual(['device-456', { type: 'DISMISS' }]);
        expect(calls[1]).toEqual(['device-456', {
            type: 'SHOW_FEEDBACK',
            payload: {
                sessionId: 'new-session-123',
                caseId: 'case-123',
                staff: { id: 'staff-789', name: 'Jane Smith' },
                expireAt: mockTimes.sessionExpireAt.toISOString(),
            },
        }]);
    });

    it('should verify all utility functions are called in transaction', async () => {
        await FeedbackService.overrideFeedback(mockOverrideFeedbackArgs);

        const transactionCallOrder = [
            mockUtils.clearDevicePointerToLock,
            mockUtils.overrideOldLockTx,
            mockUtils.overrideActiveSessionsOnDevice,
            mockUtils.createSessionTx,
            mockUtils.createLockTx,
            mockUtils.casBindCurrentLock,
            mockUtils.markCasePendingIfNeeded,
        ];

        transactionCallOrder.forEach((mockFn) => {
            expect(mockFn).toHaveBeenCalled();
        });
    });

    it('should handle expectedVersion of 0 correctly', async () => {
        const argsWithZeroVersion = { ...mockOverrideFeedbackArgs, expectedVersion: 0 };
        const lockWithZeroVersion = { ...mockCurrentLock, version: 0 };
        mockUtils.findActiveLock.mockResolvedValue(lockWithZeroVersion);

        const result = await FeedbackService.overrideFeedback(argsWithZeroVersion);

        expect(mockUtils.overrideOldLockTx).toHaveBeenCalledWith(
            expect.any(Object), // tx
            'lock-999',
            0,
            mockTimes.now
        );
        expect(result.previous.lockId).toBe('lock-999');
    });
});
        


