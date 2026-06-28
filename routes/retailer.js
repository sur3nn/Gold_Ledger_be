
const express = require("express")
const router = express.Router()
const factoryController = require("../controllers/retailerController")

router.get("/",factoryController.getRetailers)

module.exports = router