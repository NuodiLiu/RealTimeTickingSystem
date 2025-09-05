// test for takeNextCase

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
import { NotFoundError, ConflictError } from '../../src/error';

const mockCasesService = CasesService as jest.Mocked<typeof CasesService>;

describe('CasesController.takeNextCase', () => {
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

  it('should take next case successfully', async () => {
    const staffId = '333123';
    const nextCase = {
      id: 'case-456',
      studentName: 'Jane Doe',
      category: 'Financial',
      status: 'IN_PROGRESS',
      staffId,
      createdAt: new Date('2024-01-01'),
      resolvedAt: null,
    };

    mockReq.user.id = staffId;
    mockCasesService.takeNextCase.mockResolvedValue(nextCase as any);

    await CasesController.takeNextCase(mockReq, mockRes, mockNext);

    expect(mockCasesService.takeNextCase).toHaveBeenCalledWith(staffId);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(nextCase);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should take next academic case successfully', async () => {
    const staffId = '123789';
    const nextCase = {
      id: 'case-001',
      studentName: 'Mike Wilson',
      category: 'Academic',
      status: 'IN_PROGRESS',
      staffId,
      createdAt: new Date(),
      resolvedAt: null,
    };

    mockReq.user.id = staffId;
    mockCasesService.takeNextCase.mockResolvedValue(nextCase as any);

    await CasesController.takeNextCase(mockReq, mockRes, mockNext);

    expect(mockCasesService.takeNextCase).toHaveBeenCalledWith(staffId);
    expect(mockRes.json).toHaveBeenCalledWith(nextCase);
  });

  it('should take next administrative case successfully', async () => {
    const staffId = '493456';
    const nextCase = {
      id: 'case-admin-1',
      studentName: 'Sarah Connor',
      category: 'Administrative',
      status: 'IN_PROGRESS',
      staffId,
      createdAt: new Date('2025-09-05'),
      resolvedAt: null,
    };

    mockReq.user.id = staffId;
    mockCasesService.takeNextCase.mockResolvedValue(nextCase as any);

    await CasesController.takeNextCase(mockReq, mockRes, mockNext);

    expect(mockCasesService.takeNextCase).toHaveBeenCalledWith(staffId);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(nextCase);
  });

  it('should call next with NotFoundError when no cases available', async () => {
    const error = new NotFoundError('No queued cases');
    mockCasesService.takeNextCase.mockRejectedValue(error);

    await CasesController.takeNextCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  it('should call next with ConflictError when concurrent access occurs', async () => {
    const error = new ConflictError('Case already taken by someone else');
    mockCasesService.takeNextCase.mockRejectedValue(error);

    await CasesController.takeNextCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should call next with NotFoundError when queue is empty', async () => {
    const error = new NotFoundError('No cases in queue');
    mockCasesService.takeNextCase.mockRejectedValue(error);

    await CasesController.takeNextCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should call next with error when service throws database error', async () => {
    const error = new Error('Transaction rollback failed');
    mockCasesService.takeNextCase.mockRejectedValue(error);

    await CasesController.takeNextCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should pass correct user ID from request', async () => {
    const userIds = ['staff-123', 'staff-456', 'admin-789'];
    
    for (const userId of userIds) {
      mockReq.user.id = userId;
      mockCasesService.takeNextCase.mockResolvedValue({} as any);

      await CasesController.takeNextCase(mockReq, mockRes, mockNext);

      expect(mockCasesService.takeNextCase).toHaveBeenCalledWith(userId);

      jest.clearAllMocks();
    }
  });

  it('should handle different staff members taking next case', async () => {
    const staffMembers = [
      { id: 'staff-111', name: 'Alice' },
      { id: 'staff-222', name: 'Bob' },
      { id: 'staff-333', name: 'Charlie' }
    ];
    
    for (const staff of staffMembers) {
      const nextCase = {
        id: `case-${staff.id}`,
        studentName: `Student for ${staff.name}`,
        category: 'Academic',
        status: 'IN_PROGRESS',
        staffId: staff.id,
        createdAt: new Date(),
        resolvedAt: null,
      };

      mockReq.user.id = staff.id;
      mockCasesService.takeNextCase.mockResolvedValue(nextCase as any);

      await CasesController.takeNextCase(mockReq, mockRes, mockNext);

      expect(mockCasesService.takeNextCase).toHaveBeenCalledWith(staff.id);
      expect(mockRes.json).toHaveBeenCalledWith(nextCase);

      jest.clearAllMocks();
    }
  });

  it('should handle race condition scenarios', async () => {
    const error = new ConflictError('Race condition: case was taken by another staff member');
    mockCasesService.takeNextCase.mockRejectedValue(error);

    await CasesController.takeNextCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should call next with error when staff user is missing', async () => {
    mockReq.user = undefined;

    await CasesController.takeNextCase(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'User authentication required'
    }));
  });
});