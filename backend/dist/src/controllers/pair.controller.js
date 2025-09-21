"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PairController = void 0;
const pair_service_1 = require("../services/pair.service");
class PairController {
    static async generateQR(req, res, next) {
        try {
            const result = await pair_service_1.PairService.generateQR();
            res.status(200).json(result);
        }
        catch (err) {
            next(err);
        }
    }
    // POST /pair/complete
    static async completePairing(req, res, next) {
        try {
            const result = await pair_service_1.PairService.completePairing(req.body);
            res.status(201).json(result);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.PairController = PairController;
//# sourceMappingURL=pair.controller.js.map