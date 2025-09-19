"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const pair_controller_1 = require("../controllers/pair.controller");
const jwt_auth_middleware_1 = require("../middlewares/jwt-auth.middleware");
const router = (0, express_1.Router)();
// complete pairing between portal and kiosk 
router.post("/complete", pair_controller_1.PairController.completePairing);
// generate QR code for pairing 
router.post("/generate-qr", jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireStaff, pair_controller_1.PairController.generateQR);
exports.default = router;
//# sourceMappingURL=pair.router.js.map