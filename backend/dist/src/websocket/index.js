"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bindRealtime = bindRealtime;
const auth_1 = require("./auth");
const prisma_1 = require("../lib/prisma");
const lease_1 = require("./lease");
const deviceSocket_1 = require("./deviceSocket");
// Handle feedback cancellation when user clicks close on iPad
async function handleFeedbackCancellation(deviceId, sessionId) {
    try {
        console.log(`Handling feedback cancellation for session ${sessionId} on device ${deviceId}`);
        const session = await prisma_1.prisma.feedbackSession.findUnique({
            where: { id: sessionId },
            select: { id: true, status: true, caseId: true, deviceId: true }
        });
        if (!session) {
            console.log(`Session ${sessionId} not found`);
            return;
        }
        if (session.deviceId !== deviceId) {
            console.log(`Session ${sessionId} does not belong to device ${deviceId}`);
            return;
        }
        // Only cancel if session is still active
        if (session.status === 'CREATED' || session.status === 'DELIVERED') {
            await prisma_1.prisma.$transaction(async (tx) => {
                // Cancel the feedback session
                await tx.feedbackSession.update({
                    where: { id: sessionId },
                    data: { status: 'CANCELLED' }
                });
                // Find and complete any associated lock
                const associatedLock = await tx.kioskLock.findFirst({
                    where: {
                        deviceId: deviceId,
                        caseId: session.caseId,
                        status: 'ACTIVE'
                    }
                });
                if (associatedLock) {
                    // Complete the lock
                    await tx.kioskLock.update({
                        where: { id: associatedLock.id },
                        data: {
                            status: 'COMPLETED',
                            releasedAt: new Date(),
                            version: { increment: 1 }
                        }
                    });
                    // Release the device
                    await tx.kioskDevice.update({
                        where: { id: deviceId },
                        data: { currentLockId: null }
                    });
                }
                //  Resolve case
                await tx.studentCase.update({
                    where: { id: session.caseId },
                    data: {
                        status: 'RESOLVED',
                        resolvedAt: new Date()
                    }
                });
            });
            console.log(`Successfully cancelled feedback session ${sessionId} and released resources`);
            // Notify dashboard clients
            deviceSocket_1.DeviceGateway.notifyDashboard({
                type: "case:updated",
                payload: { id: session.caseId, status: "RESOLVED" }
            });
            deviceSocket_1.DeviceGateway.notifyDashboard({
                type: "device:updated",
                payload: { id: deviceId, isBusy: false, isOnline: true }
            });
        }
        else {
            console.log(`Session ${sessionId} is not in an active state (${session.status}), no action needed`);
        }
    }
    catch (error) {
        console.error(`Error handling feedback cancellation for session ${sessionId}:`, error);
    }
}
// Handle feedback submission when user submits feedback on iPad
async function handleFeedbackSubmission(deviceId, sessionId, rating, comment) {
    try {
        console.log(`Handling feedback submission for session ${sessionId} on device ${deviceId}`);
        const session = await prisma_1.prisma.feedbackSession.findUnique({
            where: { id: sessionId },
            select: { id: true, status: true, caseId: true, deviceId: true, staffId: true }
        });
        if (!session) {
            console.log(`Session ${sessionId} not found`);
            return;
        }
        if (session.deviceId !== deviceId) {
            console.log(`Session ${sessionId} does not belong to device ${deviceId}`);
            return;
        }
        // Only process if session is still active
        if (session.status === 'DELIVERED' || session.status === 'CREATED') {
            await prisma_1.prisma.$transaction(async (tx) => {
                await tx.feedbackSession.update({
                    where: { id: sessionId },
                    data: {
                        status: 'SUBMITTED',
                        submittedAt: new Date()
                    }
                });
                if (rating !== undefined && rating !== null) {
                    await tx.feedback.create({
                        data: {
                            caseId: session.caseId,
                            staffId: session.staffId,
                            rating: rating,
                            comment: comment || null
                        }
                    });
                }
                await tx.studentCase.update({
                    where: { id: session.caseId },
                    data: {
                        status: 'RESOLVED',
                        resolvedAt: new Date()
                    }
                });
                const associatedLock = await tx.kioskLock.findFirst({
                    where: {
                        deviceId: deviceId,
                        caseId: session.caseId,
                        status: 'ACTIVE'
                    }
                });
                if (associatedLock) {
                    // Complete the lock
                    await tx.kioskLock.update({
                        where: { id: associatedLock.id },
                        data: {
                            status: 'COMPLETED',
                            releasedAt: new Date(),
                            version: { increment: 1 }
                        }
                    });
                    // Release the device
                    await tx.kioskDevice.update({
                        where: { id: deviceId },
                        data: { currentLockId: null }
                    });
                }
            });
            console.log(`Successfully processed feedback submission and resolved case ${session.caseId}`);
            deviceSocket_1.DeviceGateway.notifyDashboard({
                type: "case:updated",
                payload: {
                    id: session.caseId,
                    status: "RESOLVED"
                }
            });
            deviceSocket_1.DeviceGateway.notifyDashboard({
                type: "device:updated",
                payload: {
                    id: deviceId,
                    isBusy: false,
                    isOnline: true
                }
            });
        }
        else {
            console.log(`Session ${sessionId} is not in an active state (${session.status}), cannot submit feedback`);
        }
    }
    catch (error) {
        console.error(`Error handling feedback submission for session ${sessionId}:`, error);
    }
}
// origin url white list
function checkOrigin(origin) {
    if (process.env.NODE_ENV === 'development')
        return true;
    if (process.env.NODE_ENV === 'test')
        return true;
    // Allow no origin (mobile apps, Postman, etc.)
    if (!origin)
        return true;
    // Allow common mobile app origins
    const mobileOrigins = [
        'capacitor://localhost',
        'ionic://localhost',
        'file://',
    ];
    if (mobileOrigins.some(allowed => origin.startsWith(allowed))) {
        return true;
    }
    // Allow configured frontend URL
    const allowed = process.env.FRONTEND_URL;
    return !allowed || origin.startsWith(allowed);
}
function bindRealtime(io) {
    // heartbeat
    io.engine.on("connection_error", (err) => {
    });
    io.use(async (socket, next) => {
        try {
            if (!checkOrigin(socket.request.headers.origin))
                return next(new Error("Origin not allowed"));
            const connectionInfo = await (0, auth_1.verifySocketHandshake)(socket);
            socket.data = connectionInfo;
            next();
        }
        catch (e) {
            next(e);
        }
    });
    io.on("connection", async (socket) => {
        const connectionInfo = socket.data;
        // Handle dashboard connections
        if (connectionInfo.type === 'dashboard') {
            console.log('Dashboard connected');
            socket.on("disconnect", () => {
                console.log('Dashboard disconnected');
            });
            return;
        }
        // Handle device connections
        const { deviceId, mode } = connectionInfo;
        if (!deviceId || !mode) {
            socket.disconnect();
            return;
        }
        const room = `device:${deviceId}`;
        // disconnect previous connection if there are any
        const existingSockets = await io.in(room).fetchSockets();
        for (const s of existingSockets) {
            if (s.id !== socket.id) {
                s.disconnect(true);
            }
        }
        await socket.join(room);
        // refresh last seen at 
        await prisma_1.prisma.kioskDevice.update({ where: { id: deviceId }, data: { lastSeenAt: new Date() } });
        // Real-time update: Notify dashboard that device is now online
        deviceSocket_1.DeviceGateway.notifyDashboard({
            type: "device:online_status_changed",
            payload: { deviceId, isOnline: true }
        });
        socket.emit("message", { type: "PING", payload: { now: new Date().toISOString() } });
        socket.on("disconnect", async () => {
            clearInterval(timer);
            console.log(`Device ${deviceId} disconnected.`);
            try {
                const device = await prisma_1.prisma.kioskDevice.findUnique({
                    where: { id: deviceId },
                    include: {
                        currentLock: true
                    }
                });
                if ((device === null || device === void 0 ? void 0 : device.currentLock) && device.currentLock.status === 'ACTIVE') {
                    const lock = device.currentLock;
                    const caseId = lock.caseId;
                    console.log(`Device ${deviceId} had an active lock ${lock.id} for case ${caseId}. Cleaning up due to disconnect.`);
                    await prisma_1.prisma.$transaction(async (tx) => {
                        // Resolve case if it's not already resolved
                        const currentCase = await tx.studentCase.findUnique({ where: { id: caseId } });
                        if ((currentCase === null || currentCase === void 0 ? void 0 : currentCase.status) !== 'RESOLVED') {
                            await tx.studentCase.update({
                                where: { id: caseId },
                                data: {
                                    status: 'RESOLVED',
                                    resolvedAt: new Date(),
                                },
                            });
                        }
                        await tx.kioskLock.update({
                            where: { id: lock.id },
                            data: { status: 'EXPIRED' },
                        });
                        // Release the device
                        await tx.kioskDevice.update({
                            where: { id: deviceId },
                            data: { currentLockId: null },
                        });
                        // Cancel any pending feedback sessions for this case
                        await tx.feedbackSession.updateMany({
                            where: {
                                caseId: caseId,
                                deviceId: deviceId,
                                status: { in: ['CREATED', 'DELIVERED'] }
                            },
                            data: {
                                status: 'CANCELLED'
                            }
                        });
                    });
                    console.log(`Cleaned up resources for case ${caseId} and device ${deviceId}.`);
                    io.emit("event", { type: "case:updated", payload: { id: caseId, status: "RESOLVED" } });
                    io.emit("event", { type: "device:updated", payload: { id: deviceId, isBusy: false } });
                }
                deviceSocket_1.DeviceGateway.notifyDashboard({
                    type: "device:online_status_changed",
                    payload: { deviceId, isOnline: false }
                });
            }
            catch (error) {
                console.error(`Error during disconnect cleanup for device ${deviceId}:`, error);
            }
        });
        socket.on("message", async (raw) => {
            var _a, _b;
            try {
                const msg = (raw && typeof raw === "object") ? raw : undefined;
                const type = (msg && typeof msg.type === "string") ? msg.type : undefined;
                switch (type) {
                    case "PONG": {
                        await prisma_1.prisma.kioskDevice.update({
                            where: { id: deviceId },
                            data: { lastSeenAt: new Date() },
                        });
                        break;
                    }
                    case "LEASE": {
                        await (0, lease_1.addLeaseSeconds)(deviceId, 30);
                        break;
                    }
                    case "STATUS": {
                        await prisma_1.prisma.kioskDevice.update({
                            where: { id: deviceId },
                            data: { lastSeenAt: new Date() },
                        });
                        break;
                    }
                    case "DELIVERED": {
                        const sid = (_a = msg === null || msg === void 0 ? void 0 : msg.payload) === null || _a === void 0 ? void 0 : _a.sessionId;
                        if (typeof sid === "string" && sid) {
                            await prisma_1.prisma.feedbackSession.updateMany({
                                where: { id: sid, deviceId, status: "CREATED" },
                                data: { status: "DELIVERED", deliveredAt: new Date() },
                            });
                            deviceSocket_1.DeviceGateway.notifyDashboard({
                                type: "device:feedback_progress",
                                payload: {
                                    deviceId,
                                    status: "in_progress",
                                    feedbackInProgress: true,
                                    sessionId: sid
                                }
                            });
                        }
                        break;
                    }
                    case "FEEDBACK_UPDATE": {
                        // ignore or audit
                        break;
                    }
                    case "FEEDBACK_CANCELLED": {
                        const sessionId = (_b = msg === null || msg === void 0 ? void 0 : msg.payload) === null || _b === void 0 ? void 0 : _b.sessionId;
                        if (typeof sessionId === "string" && sessionId) {
                            await handleFeedbackCancellation(deviceId, sessionId);
                        }
                        break;
                    }
                    case "FEEDBACK_SUBMITTED": {
                        const { sessionId, rating, comment } = (msg === null || msg === void 0 ? void 0 : msg.payload) || {};
                        if (typeof sessionId === "string" && sessionId) {
                            await handleFeedbackSubmission(deviceId, sessionId, rating, comment);
                        }
                        break;
                    }
                    default: {
                        return;
                    }
                }
            }
            catch (e) {
            }
        });
        const timer = setInterval(() => {
            if (socket.connected) {
                socket.emit("message", { type: "PING", payload: { now: new Date().toISOString() } });
            }
            else {
                clearInterval(timer);
            }
        }, 15000);
    });
}
//# sourceMappingURL=index.js.map