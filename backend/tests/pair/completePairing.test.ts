import crypto from 'crypto';
import { PairService } from '../../src/services/pair.service';
import { BadRequestError, MissingFieldError } from '../../src/error';
import { DeviceMode } from '../../src/lib/utils/type';

jest.mock('../../src/lib/prisma', () => ({
    prisma: {
        pairingSession: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        kioskDevice: {
            create: jest.fn(),
        }
    }
}));

jest.mock('crypto', () => ({
    randomBytes: jest.fn(),
    createHash: jest.fn(),
}));

const { prisma } = require('../../src/lib/prisma');
const mockCrypto = crypto as jest.Mocked<typeof crypto>;

describe('PairService.completePairing', () => {
    const mockPairingData = {
        pairingToken: 'valid-token-123',
        deviceName: 'Test Kiosk Device',
        deviceMode: 'DUAL' as DeviceMode
    };

    const mockValidSession = {
        id: 'session-123',
        pairingToken: 'valid-token-123',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60000), // 1 minute from now
    };

    const mockDevice = {
        id: 'device-123',
        name: 'Test Kiosk Device',
        mode: 'DUAL',
        secretHash: 'hashed-secret',
        lastSeenAt: new Date(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.WS_BASE_URL = 'ws://localhost:3000';

        const mockDeviceSecret = 'device-secret-456';
        const mockSecretHash = 'hashed-secret-123';

        mockCrypto.randomBytes.mockImplementation(() => ({
            toString: () => mockDeviceSecret
        }));
        
        mockCrypto.createHash.mockReturnValue({
            update: jest.fn().mockReturnThis(),
            digest: jest.fn().mockReturnValue(mockSecretHash)
        } as any);
    });

    afterEach(() => {
        delete process.env.WS_BASE_URL;
    });

    it('should complete pairing successfully with all required data', async () => {
        prisma.pairingSession.findUnique.mockResolvedValue(mockValidSession);
        prisma.kioskDevice.create.mockResolvedValue(mockDevice);
        prisma.pairingSession.update.mockResolvedValue({});

        const result = await PairService.completePairing(mockPairingData);

        expect(prisma.pairingSession.findUnique).toHaveBeenCalledWith({
            where: { pairingToken: 'valid-token-123' }
        });
        expect(prisma.kioskDevice.create).toHaveBeenCalledWith({
            data: {
                name: 'Test Kiosk Device',
                secretHash: expect.any(String),
                mode: 'DUAL',
                lastSeenAt: expect.any(Date),
            }
        });
        expect(prisma.pairingSession.update).toHaveBeenCalledWith({
            where: { id: 'session-123' },
            data: {
                status: 'COMPLETED',
                deviceId: 'device-123',
                completedAt: expect.any(Date),
            }
        });
        expect(result).toEqual({
            deviceId: 'device-123',
            deviceSecret: 'device-secret-456',
            deviceName: 'Test Kiosk Device',
            deviceMode: 'DUAL',
            wsEndpoint: 'ws://localhost:3000/ws/device/device-123'
        });
    });

    it('should use default DUAL mode when deviceMode is not provided', async () => {
        const dataWithoutMode = {
            pairingToken: 'valid-token-123',
            deviceName: 'Test Kiosk Device'
        };

        prisma.pairingSession.findUnique.mockResolvedValue(mockValidSession);
        prisma.kioskDevice.create.mockResolvedValue({ ...mockDevice, mode: 'DUAL' });
        prisma.pairingSession.update.mockResolvedValue({});

        const result = await PairService.completePairing(dataWithoutMode);

        expect(prisma.kioskDevice.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                mode: 'DUAL'
            })
        });
        expect(result.deviceMode).toBe('DUAL');
    });

    it('should throw MissingFieldError when pairingToken is missing', async () => {
        const invalidData = {
            pairingToken: '',
            deviceName: 'Test Device'
        };

        await expect(PairService.completePairing(invalidData))
            .rejects
            .toThrow(MissingFieldError);
        
        expect(prisma.pairingSession.findUnique).not.toHaveBeenCalled();
    });

    it('should throw MissingFieldError when deviceName is missing', async () => {
        const invalidData = {
            pairingToken: 'valid-token',
            deviceName: ''
        };

        await expect(PairService.completePairing(invalidData))
            .rejects
            .toThrow(MissingFieldError);
        
        expect(prisma.pairingSession.findUnique).not.toHaveBeenCalled();
    });

    it('should throw MissingFieldError when both pairingToken and deviceName are missing', async () => {
        const invalidData = {
            pairingToken: '',
            deviceName: ''
        };

        await expect(PairService.completePairing(invalidData))
            .rejects
            .toThrow(MissingFieldError);
        
        expect(prisma.pairingSession.findUnique).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError when pairing session is not found', async () => {
        prisma.pairingSession.findUnique.mockResolvedValue(null);

        await expect(PairService.completePairing(mockPairingData))
            .rejects
            .toThrow(BadRequestError);
        
        expect(prisma.kioskDevice.create).not.toHaveBeenCalled();
        expect(prisma.pairingSession.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError when pairing session status is not PENDING', async () => {
        const completedSession = {
            ...mockValidSession,
            status: 'COMPLETED'
        };
        prisma.pairingSession.findUnique.mockResolvedValue(completedSession);

        await expect(PairService.completePairing(mockPairingData))
            .rejects
            .toThrow(BadRequestError);
        
        expect(prisma.kioskDevice.create).not.toHaveBeenCalled();
        expect(prisma.pairingSession.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError when pairing session is expired', async () => {
        const expiredSession = {
            ...mockValidSession,
            expiresAt: new Date(Date.now() - 60000) // 1 minute ago
        };
        prisma.pairingSession.findUnique.mockResolvedValue(expiredSession);

        await expect(PairService.completePairing(mockPairingData))
            .rejects
            .toThrow(BadRequestError);
        
        expect(prisma.kioskDevice.create).not.toHaveBeenCalled();
        expect(prisma.pairingSession.update).not.toHaveBeenCalled();
    });

    it('should hash the device secret correctly', async () => {
        const mockDeviceSecret = 'test-device-secret';
        const mockHashedSecret = 'hashed-test-secret';

        mockCrypto.randomBytes.mockImplementation(() => ({
            toString: () => mockDeviceSecret
        }));

        const mockHashObject = {
            update: jest.fn().mockReturnThis(),
            digest: jest.fn().mockReturnValue(mockHashedSecret)
        };
        mockCrypto.createHash.mockReturnValue(mockHashObject as any);

        prisma.pairingSession.findUnique.mockResolvedValue(mockValidSession);
        prisma.kioskDevice.create.mockResolvedValue(mockDevice);
        prisma.pairingSession.update.mockResolvedValue({});

        await PairService.completePairing(mockPairingData);

        expect(mockCrypto.createHash).toHaveBeenCalledWith('sha256');
        expect(mockHashObject.update).toHaveBeenCalledWith(mockDeviceSecret);
        expect(mockHashObject.digest).toHaveBeenCalledWith('hex');
        expect(prisma.kioskDevice.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                secretHash: mockHashedSecret
            })
        });
    });

    it('should use default WS_BASE_URL when environment variable is not set', async () => {
        delete process.env.WS_BASE_URL;

        prisma.pairingSession.findUnique.mockResolvedValue(mockValidSession);
        prisma.kioskDevice.create.mockResolvedValue(mockDevice);
        prisma.pairingSession.update.mockResolvedValue({});

        const result = await PairService.completePairing(mockPairingData);

        expect(result.wsEndpoint).toBe('ws://localhost:3000/ws/device/device-123');
    });

    it('should set lastSeenAt to current time when creating device', async () => {
        const beforeCall = Date.now();

        prisma.pairingSession.findUnique.mockResolvedValue(mockValidSession);
        prisma.kioskDevice.create.mockResolvedValue(mockDevice);
        prisma.pairingSession.update.mockResolvedValue({});

        await PairService.completePairing(mockPairingData);

        const createCall = prisma.kioskDevice.create.mock.calls[0][0];
        const lastSeenAt = createCall.data.lastSeenAt.getTime();
        
        expect(lastSeenAt).toBeGreaterThanOrEqual(beforeCall - 1000); // Allow 1s tolerance
        expect(lastSeenAt).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('should set completedAt to current time when updating pairing session', async () => {
        const beforeCall = Date.now();

        prisma.pairingSession.findUnique.mockResolvedValue(mockValidSession);
        prisma.kioskDevice.create.mockResolvedValue(mockDevice);
        prisma.pairingSession.update.mockResolvedValue({});

        await PairService.completePairing(mockPairingData);

        const updateCall = prisma.pairingSession.update.mock.calls[0][0];
        const completedAt = updateCall.data.completedAt.getTime();
        
        expect(completedAt).toBeGreaterThanOrEqual(beforeCall - 1000); // Allow 1s tolerance
        expect(completedAt).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('should generate 32-byte device secret as hex string', async () => {
        const mockDeviceSecret = 'generated-device-secret-hex';

        const mockToString = jest.fn((encoding: string) => {
            expect(encoding).toBe('hex');
            return mockDeviceSecret;
        });

        mockCrypto.randomBytes.mockImplementation((size: number) => {
            expect(size).toBe(32);
            return { toString: mockToString } as any;
        });

        prisma.pairingSession.findUnique.mockResolvedValue(mockValidSession);
        prisma.kioskDevice.create.mockResolvedValue(mockDevice);
        prisma.pairingSession.update.mockResolvedValue({});

        const result = await PairService.completePairing(mockPairingData);

        expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32);
        expect(mockToString).toHaveBeenCalledWith('hex');
        expect(result.deviceSecret).toBe(mockDeviceSecret);
    });

    it('should accept different device modes', async () => {
        const kioskModeData = {
            ...mockPairingData,
            deviceMode: 'KIOSK' as DeviceMode
        };

        const kioskDevice = { ...mockDevice, mode: 'KIOSK' };

        prisma.pairingSession.findUnique.mockResolvedValue(mockValidSession);
        prisma.kioskDevice.create.mockResolvedValue(kioskDevice);
        prisma.pairingSession.update.mockResolvedValue({});

        const result = await PairService.completePairing(kioskModeData);

        expect(prisma.kioskDevice.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                mode: 'KIOSK'
            })
        });
        expect(result.deviceMode).toBe('KIOSK');
    });
});