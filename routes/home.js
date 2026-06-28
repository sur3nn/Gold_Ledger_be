
const express = require("express")
const router = express.Router()
const homeController = require("../controllers/homeController")

router.get("/paymentTypes",homeController.getPaymentTypes)
router.post("/create-billing",homeController.createBillingEntry)
router.get("/billing-history",homeController.getBillingHistory)

module.exports = router