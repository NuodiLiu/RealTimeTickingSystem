// tests for getQueuedCases.ts

import { CasesController } from "../../src/controllers/cases.controller";
import { CasesService } from "../../src/services/cases.service";

jest.mock('../../src/services/cases.service');

const mockCaseService = CasesService as jest.Mocked<typeof CasesService>;

describe('CasesController.getQueuedCases', () => {
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
        jest.clearAllMocks()
    });

    it('should return cases with default status queued', async () => {
        const cases = [
            {
                id: 'case1',
                studentName: 'Steve Banana',
                category: 'Academic',
                status: 'QUEUED', 
                staffId: null,
                createdAt: new Date('2025-09-05'),
                resolvedAt: null
            },
            {
                id: 'case2',
                studentName: 'Sara Strawberry',
                category: 'Financial',
                status: 'QUEUED', 
                staffId: null,
                createdAt: new Date('2024-08-02'),
                resolvedAt: null
            },
        ];
        mockCaseService.getQueuedCases.mockResolvedValue(cases as any);

        await CasesController.getQueuedCases(mockReq, mockRes, mockNext);

        expect(mockCaseService.getQueuedCases).toHaveBeenCalledWith(undefined);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(cases);
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return cases with in_progress status', async () => {
        const cases = [
            {
                id: 'case1',
                studentName: 'Orage Juice',
                category: 'Academic',
                status: 'IN_PROGRESS', 
                staffId: '222222',
                createdAt: new Date('2025-09-05'),
                resolvedAt: null
            },
        ];

        mockReq.query.status = 'in_progress';
        mockCaseService.getQueuedCases.mockResolvedValue(cases as any);
        
        await CasesController.getQueuedCases(mockReq, mockRes, mockNext);

        expect(mockCaseService.getQueuedCases).toHaveBeenCalledWith('in_progress');
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(cases);
    });

    it('should return cases with resolved status', async () => {
        const cases = [
            {
                id: 'case1',
                studentName: 'Orage Juice',
                category: 'Academic',
                status: 'IN_PROGRESS', 
                staffId: '123453',
                createdAt: new Date('2025-09-05'),
                resolvedAt: null
            },
        ];

        mockReq.query.status = 'resolved';
        mockCaseService.getQueuedCases.mockResolvedValue(cases as any);
        
        await CasesController.getQueuedCases(mockReq, mockRes, mockNext);

        expect(mockCaseService.getQueuedCases).toHaveBeenCalledWith('resolved');
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(cases);
    });

    it('should return empty array when no cases found', async () => {
        mockCaseService.getQueuedCases.mockResolvedValue([]);
        
        await CasesController.getQueuedCases(mockReq, mockRes, mockNext);

        // expect(mockCaseService.getQueuedCases).toHaveBeenCalledWith('in_progress');
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    it('should call next with error when serivce throws', async () => {

        const error = new Error('Database connection failed');
        mockCaseService.getQueuedCases.mockRejectedValue(error);
        await CasesController.getQueuedCases(mockReq, mockRes, mockNext);

        // expect(mockCaseService.getQueuedCases).toHaveBeenCalledWith('in_progress');
        expect(mockNext).toHaveBeenCalledWith(error);
        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should handle invalid status query parameter', async () => {
        const cases: Awaited<ReturnType<typeof CasesService.getQueuedCases>> = [];
        mockReq.query.status = 'invalid_status';
        mockCaseService.getQueuedCases.mockResolvedValue(cases as any);
        
        await CasesController.getQueuedCases(mockReq, mockRes, mockNext);

        expect(mockCaseService.getQueuedCases).toHaveBeenCalledWith('invalid_status');
        expect(mockRes.status).toHaveBeenCalledWith(200);
    });


})