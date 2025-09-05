// test for takeCase

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

describe('CasesController.takeCase', () => {
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

  it('should take case successfully', async () => {
    const caseId = 'case-123';
    const staffId = '443123';
    const takenCase = {
      id: caseId,
      studentName: 'Watermelon Doe',
      category: 'Academic',
      status: 'IN_PROGRESS',
      staffId,
      createdAt: new Date('2024-01-01'),
      resolvedAt: null,
    };

    mockReq.params.id = caseId;
    mockReq.user.id = staffId;
    mockCasesService.takeCase.mockResolvedValue(takenCase as any);

    await CasesController.takeCase(mockReq, mockRes, mockNext);

    expect(mockCasesService.takeCase).toHaveBeenCalledWith(caseId, staffId);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(takenCase);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should take case with different staff member', async () => {
    const caseId = 'case-456';
    const staffId = '490999';
    const takenCase = {
      id: caseId,
      studentName: 'Jane Mango',
      category: 'Financial',
      status: 'IN_PROGRESS',
      staffId,
      createdAt: new Date(),
      resolvedAt: null,
    };

    mockReq.params.id = caseId;
    mockReq.user.id = staffId;
    mockCasesService.takeCase.mockResolvedValue(takenCase as any);

    await CasesController.takeCase(mockReq, mockRes, mockNext);

    expect(mockCasesService.takeCase).toHaveBeenCalledWith(caseId, staffId);
    expect(mockRes.json).toHaveBeenCalledWith(takenCase);
  });

  it('should take administrative case successfully', async () => {
    const caseId = 'case-789';
    const staffId = '443857';
    const takenCase = {
      id: caseId,
      studentName: 'Mike Kiwi',
      category: 'Administrative',
      status: 'IN_PROGRESS',
      staffId,
      createdAt: new Date('2025-01-01'),
      resolvedAt: null,
    };

    mockReq.params.id = caseId;
    mockReq.user.id = staffId;
    mockCasesService.takeCase.mockResolvedValue(takenCase as any);

    await CasesController.takeCase(mockReq, mockRes, mockNext);

    expect(mockCasesService.takeCase).toHaveBeenCalledWith(caseId, staffId);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(takenCase);
  });

  it('should call next with BadRequestError when case already taken', async () => {
    const error = new BadRequestError('Case already taken or not in queue');
    mockReq.params.id = 'case-123';
    mockCasesService.takeCase.mockRejectedValue(error);

    await CasesController.takeCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  it('should call next with NotFoundError when case does not exist', async () => {
    const error = new NotFoundError('Case not found');
    mockReq.params.id = 'nonexistent-case';
    mockCasesService.takeCase.mockRejectedValue(error);

    await CasesController.takeCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should call next with BadRequestError when case is already resolved', async () => {
    const error = new BadRequestError('Cannot take resolved case');
    mockReq.params.id = 'case-resolved';
    mockCasesService.takeCase.mockRejectedValue(error);

    await CasesController.takeCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should call next with error when service throws unexpected error', async () => {
    const error = new Error('Database connection lost');
    mockReq.params.id = 'case-123';
    mockCasesService.takeCase.mockRejectedValue(error);

    await CasesController.takeCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should pass correct case ID from params', async () => {
    const caseIds = ['case-123', 'case-abc-def', 'case-999'];
    
    for (const caseId of caseIds) {
      mockReq.params.id = caseId;
      mockCasesService.takeCase.mockResolvedValue({} as any);

      await CasesController.takeCase(mockReq, mockRes, mockNext);

      expect(mockCasesService.takeCase).toHaveBeenCalledWith(caseId, mockReq.user.id);

      jest.clearAllMocks();
    }
  });

  it('should handle missing case ID parameter', async () => {
    mockReq.params.id = undefined;
    const error = new BadRequestError('Case ID is required');
    mockCasesService.takeCase.mockRejectedValue(error);

    await CasesController.takeCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });
});