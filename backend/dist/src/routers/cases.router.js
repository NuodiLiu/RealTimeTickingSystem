"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cases_controller_1 = require("../controllers/cases.controller");
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const jwt_auth_middleware_1 = require("../middlewares/jwt-auth.middleware");
const router = (0, express_1.Router)();
router.post("/", auth_middleware_1.requireDevice, cases_controller_1.CasesController.postCase);
// Public: get queue for public display (no auth required)
router.get("/public-queue", cases_controller_1.CasesController.getPublicQueue);
// Staff: list cases by status 
router.get("/", jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireStaff, cases_controller_1.CasesController.getQueuedCases);
// Staff: take next case (FIFO)
router.post("/take-next", jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireStaff, cases_controller_1.CasesController.takeNextCase);
// Staff: take a case by id
router.post("/:id/take", jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireStaff, cases_controller_1.CasesController.takeCase);
// Staff: resolve a case
router.post("/:id/resolve", jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireStaff, cases_controller_1.CasesController.resolveCase);
// Staff: escalate a case
router.post("/:id/escalate", jwt_auth_middleware_1.requireJWTAuth, auth_middleware_1.requireStaff, cases_controller_1.CasesController.escalateCase);
exports.default = router;
//# sourceMappingURL=cases.router.js.map