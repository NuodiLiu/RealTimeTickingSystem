import { FeedbackService } from '../../src/services/feedback.service';
import { BadRequestError, ConflictError, NotFoundError } from '../../src/error';

jest.mock('../../src/lib/prisma', () => ({
    prisma: {
        feedbackSession: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        feedback: {
            findUnique: jest.fn(),
            create: jest.fn(),
        },
        $transaction: jest.fn(),
    }
}));

const { prisma } = require('../../src/lib/prisma');

describe('FeedbackService.submitFeedback', () => {
    const mockSubmitFeedbackArgs = {
        sessionId: 'session-123',
        rating: 4,
        comment: 'Great service!'
    };

    const mockActiveSession = {
        id: 'session-123',
        status: 'CREATED',
        caseId: 'case-456',
        deviceId: 'device-789',
        staffId: 'staff-999'
    };

    const mockCreatedFeedback = {
        id: 'feedback-123',
        caseId: 'case-456',
        staffId: 'staff-999',
        rating: 4,
        comment: 'Great service!'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        
        prisma.feedbackSession.findUnique.mockResolvedValue(mockActiveSession);
        prisma.$transaction.mockImplementation(async (callback: any) => {
            const mockTx = {
                feedback: {
                    create: jest.fn().mockResolvedValue({ id: 'feedback-123' })
                },
                feedbackSession: {
                    update: jest.fn().mockResolvedValue({})
                },
                kioskLock: {
                    findFirst: jest.fn().mockResolvedValue({ id: 'lock-123' }),
                    updateMany: jest.fn().mockResolvedValue({})
                },
                kioskDevice: {
                    updateMany: jest.fn().mockResolvedValue({})
                },
                studentCase: {
                    update: jest.fn().mockResolvedValue({})
                }
            };
            return await callback(mockTx);
        });
    });

    it('should successfully submit feedback when all conditions are met', async () => {
        const result = await FeedbackService.submitFeedback(mockSubmitFeedbackArgs);

        expect(prisma.feedbackSession.findUnique).toHaveBeenCalledWith({
            where: { id: 'session-123' },
            select: {
                id: true,
                status: true,
                caseId: true,
                deviceId: true,
                staffId: true,
            },
        });

        expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));

        expect(result).toEqual({
            feedback: {
                id: 'feedback-123',
                caseId: 'case-456',
                rating: 4,
                comment: 'Great service!'
            },
            session: {
                id: 'session-123',
                status: 'SUBMITTED'
            }
        });
    });

    it('should throw BadRequestError when sessionId is missing', async () => {
        const invalidArgs = { ...mockSubmitFeedbackArgs, sessionId: '' };

        await expect(FeedbackService.submitFeedback(invalidArgs))
            .rejects
            .toThrow(BadRequestError);

        expect(prisma.feedbackSession.findUnique).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError when rating is null', async () => {
        const invalidArgs = { ...mockSubmitFeedbackArgs, rating: null as any };

        await expect(FeedbackService.submitFeedback(invalidArgs))
            .rejects
            .toThrow(BadRequestError);

        expect(prisma.feedbackSession.findUnique).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError when rating is not an integer', async () => {
        const invalidArgs = { ...mockSubmitFeedbackArgs, rating: 3.5 };

        await expect(FeedbackService.submitFeedback(invalidArgs))
            .rejects
            .toThrow(BadRequestError);

        expect(prisma.feedbackSession.findUnique).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError when rating is less than 1', async () => {
        const invalidArgs = { ...mockSubmitFeedbackArgs, rating: 0 };

        await expect(FeedbackService.submitFeedback(invalidArgs))
            .rejects
            .toThrow(BadRequestError);

        expect(prisma.feedbackSession.findUnique).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError when rating is greater than 5', async () => {
        const invalidArgs = { ...mockSubmitFeedbackArgs, rating: 6 };

        await expect(FeedbackService.submitFeedback(invalidArgs))
            .rejects
            .toThrow(BadRequestError);

        expect(prisma.feedbackSession.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when feedback session is not found', async () => {
        prisma.feedbackSession.findUnique.mockResolvedValue(null);

        await expect(FeedbackService.submitFeedback(mockSubmitFeedbackArgs))
            .rejects
            .toThrow(NotFoundError);

        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw ConflictError with session_inactive code when session is OVERRIDDEN', async () => {
        const overriddenSession = { ...mockActiveSession, status: 'OVERRIDDEN' };
        prisma.feedbackSession.findUnique.mockResolvedValue(overriddenSession);

        await expect(FeedbackService.submitFeedback(mockSubmitFeedbackArgs))
            .rejects
            .toThrow(ConflictError);

        try {
            await FeedbackService.submitFeedback(mockSubmitFeedbackArgs);
        } catch (error: any) {
            expect(error.code).toBe('session_inactive');
            expect(error.message).toBe('Session inactive');
        }

        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw ConflictError with session_inactive code when session is CANCELLED', async () => {
        const cancelledSession = { ...mockActiveSession, status: 'CANCELLED' };
        prisma.feedbackSession.findUnique.mockResolvedValue(cancelledSession);

        await expect(FeedbackService.submitFeedback(mockSubmitFeedbackArgs))
            .rejects
            .toThrow(ConflictError);

        try {
            await FeedbackService.submitFeedback(mockSubmitFeedbackArgs);
        } catch (error: any) {
            expect(error.code).toBe('session_inactive');
        }
    });

    it('should throw ConflictError with session_inactive code when session is EXPIRED', async () => {
        const expiredSession = { ...mockActiveSession, status: 'EXPIRED' };
        prisma.feedbackSession.findUnique.mockResolvedValue(expiredSession);

        await expect(FeedbackService.submitFeedback(mockSubmitFeedbackArgs))
            .rejects
            .toThrow(ConflictError);

        try {
            await FeedbackService.submitFeedback(mockSubmitFeedbackArgs);
        } catch (error: any) {
            expect(error.code).toBe('session_inactive');
        }
    });

    it('should return existing feedback when session is already SUBMITTED (idempotent)', async () => {
        const submittedSession = { ...mockActiveSession, status: 'SUBMITTED' };
        const existingFeedback = {
            id: 'existing-feedback-456',
            caseId: 'case-456',
            rating: 5,
            comment: 'Already submitted feedback'
        };

        prisma.feedbackSession.findUnique.mockResolvedValue(submittedSession);
        prisma.feedback.findUnique.mockResolvedValue(existingFeedback);

        const result = await FeedbackService.submitFeedback(mockSubmitFeedbackArgs);

        expect(prisma.feedback.findUnique).toHaveBeenCalledWith({
            where: { caseId: 'case-456' }
        });
        expect(result).toEqual({
            feedback: existingFeedback,
            session: { id: 'session-123', status: 'SUBMITTED' }
        });
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should return null feedback when session is SUBMITTED but no feedback exists', async () => {
        const submittedSession = { ...mockActiveSession, status: 'SUBMITTED' };
        
        prisma.feedbackSession.findUnique.mockResolvedValue(submittedSession);
        prisma.feedback.findUnique.mockResolvedValue(null);

        const result = await FeedbackService.submitFeedback(mockSubmitFeedbackArgs);

        expect(result).toEqual({
            feedback: null,
            session: { id: 'session-123', status: 'SUBMITTED' }
        });
    });

    it('should handle duplicate feedback creation gracefully (P2002 error)', async () => {
        prisma.$transaction.mockImplementation(async (callback: any) => {
            const mockTx = {
                feedback: {
                    create: jest.fn().mockRejectedValue({ code: 'P2002' })
                },
                feedbackSession: {
                    update: jest.fn().mockResolvedValue({})
                },
                kioskLock: {
                    findFirst: jest.fn().mockResolvedValue({ id: 'lock-123' }),
                    updateMany: jest.fn().mockResolvedValue({})
                },
                kioskDevice: {
                    updateMany: jest.fn().mockResolvedValue({})
                },
                studentCase: {
                    update: jest.fn().mockResolvedValue({})
                }
            };
            return await callback(mockTx);
        });

        const result = await FeedbackService.submitFeedback(mockSubmitFeedbackArgs);

        expect(result).toEqual({
            feedback: null,
            session: { id: 'session-123', status: 'SUBMITTED' }
        });
    });

    it('should rethrow non-P2002 errors from feedback creation', async () => {
        const unexpectedError = new Error('Database connection failed');
        prisma.$transaction.mockImplementation(async (callback: any) => {
            const mockTx = {
                feedback: {
                    create: jest.fn().mockRejectedValue(unexpectedError)
                }
            };
            return await callback(mockTx);
        });

        await expect(FeedbackService.submitFeedback(mockSubmitFeedbackArgs))
            .rejects
            .toThrow('Database connection failed');
    });

    it('should verify transaction operations are called with correct parameters', async () => {
        let mockTx: any;
        prisma.$transaction.mockImplementation(async (callback: any) => {
            mockTx = {
                feedback: {
                    create: jest.fn().mockResolvedValue({ id: 'feedback-123' })
                },
                feedbackSession: {
                    update: jest.fn().mockResolvedValue({})
                },
                kioskLock: {
                    findFirst: jest.fn().mockResolvedValue({ id: 'lock-123' }),
                    updateMany: jest.fn().mockResolvedValue({})
                },
                kioskDevice: {
                    updateMany: jest.fn().mockResolvedValue({})
                },
                studentCase: {
                    update: jest.fn().mockResolvedValue({})
                }
            };
            return await callback(mockTx);
        });

        await FeedbackService.submitFeedback(mockSubmitFeedbackArgs);

        expect(mockTx.feedback.create).toHaveBeenCalledWith({
            data: {
                caseId: 'case-456',
                staffId: 'staff-999',
                rating: 4,
                comment: 'Great service!',
            },
            select: { id: true },
        });

        expect(mockTx.feedbackSession.update).toHaveBeenCalledWith({
            where: { id: 'session-123' },
            data: { status: 'SUBMITTED', submittedAt: expect.any(Date) },
        });

        expect(mockTx.kioskLock.findFirst).toHaveBeenCalledWith({
            where: { deviceId: 'device-789', caseId: 'case-456', status: 'ACTIVE' },
            select: { id: true },
        });

        expect(mockTx.kioskLock.updateMany).toHaveBeenCalledWith({
            where: { id: 'lock-123', status: 'ACTIVE' },
            data: { status: 'COMPLETED', releasedAt: expect.any(Date), version: { increment: 1 } },
        });

        expect(mockTx.kioskDevice.updateMany).toHaveBeenCalledWith({
            where: { id: 'device-789', currentLockId: 'lock-123' },
            data: { currentLockId: null },
        });

        expect(mockTx.studentCase.update).toHaveBeenCalledWith({
            where: { id: 'case-456' },
            data: { status: 'RESOLVED', resolvedAt: expect.any(Date) },
        });
    });

    it('should handle case when no active lock is found', async () => {
        let mockTx: any;
        prisma.$transaction.mockImplementation(async (callback: any) => {
            mockTx = {
                feedback: {
                    create: jest.fn().mockResolvedValue({ id: 'feedback-123' })
                },
                feedbackSession: {
                    update: jest.fn().mockResolvedValue({})
                },
                kioskLock: {
                    findFirst: jest.fn().mockResolvedValue(null),
                    updateMany: jest.fn().mockResolvedValue({})
                },
                kioskDevice: {
                    updateMany: jest.fn().mockResolvedValue({})
                },
                studentCase: {
                    update: jest.fn().mockResolvedValue({})
                }
            };
            return await callback(mockTx);
        });

        const result = await FeedbackService.submitFeedback(mockSubmitFeedbackArgs);

        expect(mockTx.kioskLock.updateMany).not.toHaveBeenCalled();
        expect(mockTx.kioskDevice.updateMany).not.toHaveBeenCalled();
        expect(mockTx.studentCase.update).toHaveBeenCalled();
        expect(result.session.status).toBe('SUBMITTED');
    });

    it('should accept valid rating values 1 through 5', async () => {
        for (const rating of [1, 2, 3, 4, 5]) {
            jest.clearAllMocks();
            const args = { ...mockSubmitFeedbackArgs, rating };

            const result = await FeedbackService.submitFeedback(args);

            expect(result.feedback?.rating).toBe(rating);
        }
    });

    it('should handle empty comment correctly', async () => {
        const argsWithEmptyComment = { ...mockSubmitFeedbackArgs, comment: '' };

        const result = await FeedbackService.submitFeedback(argsWithEmptyComment);

        expect(result.feedback?.comment).toBe('');
    });

    it('should set correct timestamps for lock completion and case resolution', async () => {
        let mockTx: any;
        const beforeCall = Date.now();

        prisma.$transaction.mockImplementation(async (callback: any) => {
            mockTx = {
                feedback: {
                    create: jest.fn().mockResolvedValue({ id: 'feedback-123' })
                },
                feedbackSession: {
                    update: jest.fn().mockResolvedValue({})
                },
                kioskLock: {
                    findFirst: jest.fn().mockResolvedValue({ id: 'lock-123' }),
                    updateMany: jest.fn().mockResolvedValue({})
                },
                kioskDevice: {
                    updateMany: jest.fn().mockResolvedValue({})
                },
                studentCase: {
                    update: jest.fn().mockResolvedValue({})
                }
            };
            return await callback(mockTx);
        });

        await FeedbackService.submitFeedback(mockSubmitFeedbackArgs);

        // Check feedbackSession.update submittedAt timestamp
        const sessionUpdateCall = mockTx.feedbackSession.update.mock.calls[0][0];
        const submittedAt = sessionUpdateCall.data.submittedAt.getTime();
        expect(submittedAt).toBeGreaterThanOrEqual(beforeCall - 1000);
        expect(submittedAt).toBeLessThanOrEqual(Date.now() + 1000);

        // Check kioskLock.updateMany releasedAt timestamp
        const lockUpdateCall = mockTx.kioskLock.updateMany.mock.calls[0][0];
        const releasedAt = lockUpdateCall.data.releasedAt.getTime();
        expect(releasedAt).toBeGreaterThanOrEqual(beforeCall - 1000);
        expect(releasedAt).toBeLessThanOrEqual(Date.now() + 1000);

        // Check studentCase.update resolvedAt timestamp
        const caseUpdateCall = mockTx.studentCase.update.mock.calls[0][0];
        const resolvedAt = caseUpdateCall.data.resolvedAt.getTime();
        expect(resolvedAt).toBeGreaterThanOrEqual(beforeCall - 1000);
        expect(resolvedAt).toBeLessThanOrEqual(Date.now() + 1000);
    });
});