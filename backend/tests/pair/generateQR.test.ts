import crypto from 'crypto';
import { PairService } from '../../src/services/pair.service';

jest.mock('../../src/lib/prisma', () => ({
    prisma: {
        pairingSession: {
            create: jest.fn(),
        }
    }
}));

jest.mock('crypto', () => ({
    randomBytes: jest.fn(),
}));

const { prisma } = require('../../src/lib/prisma');
const mockCrypto = crypto as jest.Mocked<typeof crypto>;

describe('PairService.generateQR', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.API_BASE_URL = 'http://localhost:3000';
    });

    afterEach(() => {
        delete process.env.API_BASE_URL;
    });

    it('should generate QR code with pairing token and return session data', async () => {
        const mockPairingToken = 'mock-pairing-token-123';
        const mockSession = {
            id: 'session-123',
            pairingToken: mockPairingToken,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            status: 'PENDING'
        };

        mockCrypto.randomBytes.mockImplementation(() => ({
            toString: () => mockPairingToken
        }));
        prisma.pairingSession.create.mockResolvedValue(mockSession);

        const result = await PairService.generateQR();

        expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32);
        expect(prisma.pairingSession.create).toHaveBeenCalledWith({
            data: {
                pairingToken: mockPairingToken,
                expiresAt: expect.any(Date),
                status: 'PENDING',
            }
        });
        expect(result).toEqual({
            qrUrl: expect.stringContaining(`http://localhost:3000/pair?data=`),
            pairingToken: mockPairingToken,
            sessionId: 'session-123',
            expiresAt: expect.any(Date)
        });
        expect(result.qrUrl).toContain(encodeURIComponent(JSON.stringify({
            pairingToken: mockPairingToken,
            apiEndpoint: 'http://localhost:3000'
        })));
    });

    it('should use default API_BASE_URL when environment variable is not set', async () => {
        delete process.env.API_BASE_URL;
        const mockPairingToken = 'mock-token';
        const mockSession = { id: 'session-123', expiresAt: new Date() };

        mockCrypto.randomBytes.mockImplementation(() => ({
            toString: () => mockPairingToken
        }));
        prisma.pairingSession.create.mockResolvedValue(mockSession);

        const result = await PairService.generateQR();

        expect(result.qrUrl).toContain('http://localhost:3000/pair');
    });

    it('should set expiration time to 5 minutes from now', async () => {
        const mockPairingToken = 'mock-token';
        const mockSession = { id: 'session-123', expiresAt: new Date() };
        const beforeCall = Date.now();

        mockCrypto.randomBytes.mockImplementation(() => ({
            toString: () => mockPairingToken
        }));
        prisma.pairingSession.create.mockResolvedValue(mockSession);

        await PairService.generateQR();

        const createCall = prisma.pairingSession.create.mock.calls[0][0];
        const expiresAt = createCall.data.expiresAt.getTime();
        const expectedExpiry = beforeCall + 5 * 60 * 1000;
        
        expect(expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 1000); //1s tolerance
        expect(expiresAt).toBeLessThanOrEqual(expectedExpiry + 1000);
    });

    it('should generate 32-byte random token as hex string', async () => {
        const mockPairingToken = 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890';
        const mockSession = { id: 'session-123', expiresAt: new Date() };

        mockCrypto.randomBytes.mockImplementation(() => ({
            toString: (encoding: string) => {
                expect(encoding).toBe('hex');
                return mockPairingToken;
            }
        }));
        prisma.pairingSession.create.mockResolvedValue(mockSession);

        const result = await PairService.generateQR();

        expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32);
        expect(result.pairingToken).toBe(mockPairingToken);
    });

    it('should create pairing session with PENDING status', async () => {
        const mockPairingToken = 'mock-token';
        const mockSession = { 
            id: 'session-123', 
            expiresAt: new Date(),
            status: 'PENDING' 
        };

        mockCrypto.randomBytes.mockImplementation(() => ({
            toString: () => mockPairingToken
        }));
        prisma.pairingSession.create.mockResolvedValue(mockSession);

        await PairService.generateQR();

        expect(prisma.pairingSession.create).toHaveBeenCalledWith({
            data: {
                pairingToken: mockPairingToken,
                expiresAt: expect.any(Date),
                status: 'PENDING',
            }
        });
    });

    it('should return properly formatted QR URL with encoded JSON data', async () => {
        const mockPairingToken = 'test-token-123';
        const mockSession = { id: 'session-456', expiresAt: new Date() };
        process.env.API_BASE_URL = 'https://api.example.com';

        mockCrypto.randomBytes.mockImplementation(() => ({
            toString: () => mockPairingToken
        }));
        prisma.pairingSession.create.mockResolvedValue(mockSession);

        const result = await PairService.generateQR();
        
        const expectedQrData = {
            pairingToken: mockPairingToken,
            apiEndpoint: 'https://api.example.com'
        };
        const expectedUrl = `https://api.example.com/pair?data=${encodeURIComponent(JSON.stringify(expectedQrData))}`;

        expect(result.qrUrl).toBe(expectedUrl);
    });

    it('should return session ID from created pairing session', async () => {
        const mockPairingToken = 'mock-token';
        const mockSessionId = 'unique-session-id-789';
        const mockSession = { 
            id: mockSessionId, 
            expiresAt: new Date() 
        };

        mockCrypto.randomBytes.mockReturnValue({
            toString: jest.fn().mockReturnValue(mockPairingToken)
        } as any);
        prisma.pairingSession.create.mockResolvedValue(mockSession);

        const result = await PairService.generateQR();

        expect(result.sessionId).toBe(mockSessionId);
    });
});