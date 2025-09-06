// import crypto from 'crypto';
// import jwt from 'jsonwebtoken';
// import { prisma } from  "../lib/prisma";
// import { BadRequestError, MissingFieldError, NotFoundError } from "../error";

// export class PairService {

//     // generate qr for kiosk
//     static async generateQR(kioskId : string) {
//         const pairingToken = crypto.randomBytes(32).toString('hex');
//         const expiresAt = new Date(Date.now() + 5 + 60 + 1000);

//         const session = await prisma.pairingSession.create({
//             data: {
//                 pairingToken,
//                 kioskId, 
//                 expiresAt, 
//                 status: 'PENDING'
//             }
//         });

//         const qrData = {
//             pairingToken, 
//             apiEndpoint: process.env.API_BASE_URL || 'http://localhost:3000'
//         };

//         const qrUrl = `${process.env.API_BASE_URL}/pair?data=${encodeURIComponent(JSON.stringify(qrData))}`;
//         return {
//             qrUrl,
//             pairingToken,
//             sessionId: session.id,
//             expiresAt
//         };
//     }

//     // ipad scans qr, completes pairing
//     static async completePairing(data: {
//         pairingToken: string;
//         deviceInfo: {
//             model: string, 
//             osVersion: string, 
//             appVersion: string;
//             deviceName: string;
//         }
//     })





// }