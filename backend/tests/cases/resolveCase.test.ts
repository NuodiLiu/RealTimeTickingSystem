// test for resolveCase 

jest.mock('../../src/lib/prisma', () => ({
    prisma: {
        case: {
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findFirst: jest.fn(),
        }
    }
}));

jest.mock('../../src/services/cases.service');

import { CasesController } from '../../src/controllers/cases.controller';
import { CasesService } from '../../src/services/cases.service';
import { NotFoundError, BadRequestError } from '../../src/error';

const mockCasesService = CasesService as jest.Mocked<typeof CasesService>;

describe('CasesController.resolveCase', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      body: {},
      params: {},
      query: {},
      user: { id: 'hellostaff', role: 'STAFF', employeeNo: '123456' },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  it('should resolve case successfully', async () => {
    const caseId = 'case-123';
    const resolvedCase = {
      id: caseId,
      studentName: 'John Doe',
      category: 'Academic',
      status: 'RESOLVED',
      staffId: '234532',
      createdAt: new Date('2024-01-01'),
      resolvedAt: new Date('2024-01-15'),
    };

    mockReq.params.id = caseId;
    mockCasesService.resolveCase.mockResolvedValue(resolvedCase as any);

    await CasesController.resolveCase(mockReq, mockRes, mockNext);

    expect(mockCasesService.resolveCase).toHaveBeenCalledWith(caseId);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(resolvedCase);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should resolve financial case successfully', async () => {
    const caseId = 'case-456';
    const resolvedCase = {
      id: caseId,
      studentName: 'Sarah Connor',
      category: 'Financial',
      status: 'RESOLVED',
      staffId: '485746',
      createdAt: new Date('2024-01-05'),
      resolvedAt: new Date('2024-01-20'),
    };

    mockReq.params.id = caseId;
    mockCasesService.resolveCase.mockResolvedValue(resolvedCase as any);

    await CasesController.resolveCase(mockReq, mockRes, mockNext);

    expect(mockCasesService.resolveCase).toHaveBeenCalledWith(caseId);
    expect(mockRes.json).toHaveBeenCalledWith(resolvedCase);
  });

  it('should resolve administrative case successfully', async () => {
    const caseId = 'case-789';
    const resolvedCase = {
      id: caseId,
      studentName: 'Mike Wilson',
      category: 'Administrative',
      status: 'RESOLVED',
      staffId: 'staff-456',
      createdAt: new Date('2025-01-01'),
      resolvedAt: new Date('2025-01-05'),
    };

    mockReq.params.id = caseId;
    mockCasesService.resolveCase.mockResolvedValue(resolvedCase as any);

    await CasesController.resolveCase(mockReq, mockRes, mockNext);

    expect(mockCasesService.resolveCase).toHaveBeenCalledWith(caseId);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(resolvedCase);
  });

  it('should call next with NotFoundError when case not found', async () => {
    const error = new NotFoundError('Case not found');
    mockReq.params.id = 'nonexistent-case';
    mockCasesService.resolveCase.mockRejectedValue(error);

    await CasesController.resolveCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  it('should call next with BadRequestError when case already resolved', async () => {
    const error = new BadRequestError('Case already resolved');
    mockReq.params.id = 'case-123';
    mockCasesService.resolveCase.mockRejectedValue(error);

    await CasesController.resolveCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should call next with BadRequestError when case is not in progress', async () => {
    const error = new BadRequestError('Case must be in progress to be resolved');
    mockReq.params.id = 'case-queued';
    mockCasesService.resolveCase.mockRejectedValue(error);

    await CasesController.resolveCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should call next with error when service throws Prisma error', async () => {
    const error = new Error('P2025: Record not found');
    mockReq.params.id = 'case-123';
    mockCasesService.resolveCase.mockRejectedValue(error);

    await CasesController.resolveCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should call next with error when service throws database error', async () => {
    const error = new Error('Database update failed');
    mockReq.params.id = 'case-123';
    mockCasesService.resolveCase.mockRejectedValue(error);

    await CasesController.resolveCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should handle resolving different case IDs', async () => {
    const caseIds = ['case-1', 'case-2', 'case-3'];
    
    for (const caseId of caseIds) {
      const resolvedCase = {
        id: caseId,
        studentName: 'Test Student',
        category: 'Academic',
        status: 'RESOLVED',
        staffId: '345123',
        createdAt: new Date(),
        resolvedAt: new Date(),
      };

      mockReq.params.id = caseId;
      mockCasesService.resolveCase.mockResolvedValue(resolvedCase as any);

      await CasesController.resolveCase(mockReq, mockRes, mockNext);

      expect(mockCasesService.resolveCase).toHaveBeenCalledWith(caseId);
      expect(mockRes.json).toHaveBeenCalledWith(resolvedCase);

      jest.clearAllMocks();
    }
  });

  it('should handle missing case ID parameter', async () => {
    mockReq.params.id = undefined;
    const error = new BadRequestError('Case ID is required');
    mockCasesService.resolveCase.mockRejectedValue(error);

    await CasesController.resolveCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should resolve case with proper timestamp', async () => {
    const caseId = 'case-timestamp';
    const now = new Date();
    const resolvedCase = {
      id: caseId,
      studentName: 'Time Test Student',
      category: 'Financial',
      status: 'RESOLVED',
      staffId: '495838',
      createdAt: new Date('2024-01-01'),
      resolvedAt: now,
    };

    mockReq.params.id = caseId;
    mockCasesService.resolveCase.mockResolvedValue(resolvedCase as any);

    await CasesController.resolveCase(mockReq, mockRes, mockNext);

    expect(mockCasesService.resolveCase).toHaveBeenCalledWith(caseId);
    expect(mockRes.json).toHaveBeenCalledWith(resolvedCase);
    expect(resolvedCase.resolvedAt).toEqual(now);
  });

  it('should call next with error when service throws constraint violation', async () => {
    const error = new Error('Foreign key constraint violation');
    mockReq.params.id = 'case-constraint';
    mockCasesService.resolveCase.mockRejectedValue(error);

    await CasesController.resolveCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });
});