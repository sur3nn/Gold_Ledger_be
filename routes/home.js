
const express = require("express")
const router = express.Router()
const homeController = require("../controllers/homeController")
console.log("routes");
const authMiddleware = require("../middleware/AuthMiddleWare");

router.get("/paymentTypes",authMiddleware,homeController.getPaymentTypes)
router.post("/create-billing",authMiddleware,homeController.createBillingEntry)
router.get("/billing-history",authMiddleware,homeController.getBillingHistory)
router.get("/stock-overview",authMiddleware,homeController.getStockOverview)
router.get("/metal",authMiddleware, homeController.getMetalList);
router.get("/user",authMiddleware, homeController.getUserDetails);
router.get("/credit-details",authMiddleware, homeController.creditGivenTaken);
module.exports = router