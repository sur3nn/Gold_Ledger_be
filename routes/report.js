
const express = require("express")
const router = express.Router()
const reportController = require("../controllers/Reportscontroller ")
const salesController = require("../controllers/Salescontroller")
const purchaseController = require("../controllers/Purchasecontroller ")
const authMiddleware = require("../middleware/AuthMiddleware");

console.log("report");

router.get("/entity-wise",authMiddleware,reportController.entityWiseReport)
router.get("/outstanding",authMiddleware,reportController.outstandingReport)
router.get("/sales",authMiddleware,salesController.salesReport)
router.get("/purchase",authMiddleware,purchaseController.purchaseReport)

module.exports = router