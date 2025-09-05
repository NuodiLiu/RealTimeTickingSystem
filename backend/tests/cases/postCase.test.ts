// tests for postCase

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
import { MissingFieldError } from '../../src/error';

const mockCasesService = CasesService as jest.Mocked<typeof CasesService>;

describe('CasesController.postCase', () => {
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
  
    it('should create case successfully with valid data', async () => {
      const caseData = { studentName: 'John Doe', category: 'Academic' };
      const createdCase = {
        id: 'case-123',
        studentName: 'John Doe',
        category: 'Academic',
        status: 'QUEUED',
        staffId: null,
        createdAt: new Date('2024-01-15'),
        resolvedAt: null,
      };
      
      mockReq.body = caseData;
      mockCasesService.postCase.mockResolvedValue(createdCase as any);
  
      await CasesController.postCase(mockReq, mockRes, mockNext);
  
      expect(mockCasesService.postCase).toHaveBeenCalledWith(caseData);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(createdCase);
      expect(mockNext).not.toHaveBeenCalled();
    });
  
  
    it('should call next with MissingFieldError when service throws validation error', async () => {
      const caseData = { studentName: 'John Doe' }; 
      const error = new MissingFieldError(['category']);
      mockReq.body = caseData;
      mockCasesService.postCase.mockRejectedValue(error);
  
      await CasesController.postCase(mockReq, mockRes, mockNext);
  
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  
    it('should call next with error when service throws database error', async () => {
      const caseData = { studentName: 'John Doe', category: 'Academic' };
      const error = new Error('Database constraint violation');
      mockReq.body = caseData;
      mockCasesService.postCase.mockRejectedValue(error);
  
      await CasesController.postCase(mockReq, mockRes, mockNext);
  
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  
    it('should handle empty request body', async () => {
      const error = new MissingFieldError(['studentName', 'category']);
      mockReq.body = {};
      mockCasesService.postCase.mockRejectedValue(error);
  
      await CasesController.postCase(mockReq, mockRes, mockNext);
  
      expect(mockCasesService.postCase).toHaveBeenCalledWith({});
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  
    it('should handle missing studentName field', async () => {
      const caseData = { category: 'Financial' }; 
      const error = new MissingFieldError(['studentName']);
      mockReq.body = caseData;
      mockCasesService.postCase.mockRejectedValue(error);
  
      await CasesController.postCase(mockReq, mockRes, mockNext);

      expect(mockCasesService.postCase).toHaveBeenCalledWith(caseData);
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  
    it('should handle invalid category', async () => {
      const caseData = { studentName: 'John Doe', category: 'InvalidCategory' };
      const error = new Error('Invalid category provided');
      mockReq.body = caseData;
      mockCasesService.postCase.mockRejectedValue(error);
  
      await CasesController.postCase(mockReq, mockRes, mockNext);
  
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });