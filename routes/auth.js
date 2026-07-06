const express = require("express");
const loginController  = require("../controllers/AuthController");
const router = express.Router();



router.post("/", loginController.login);

module.exports = router;