const express = require("express");
const router = express.Router();
const authCtrl = require("../controllers/auth.controller");
const { verifyToken } = require("../middleware/auth.middleware");

router.post("/register", authCtrl.register);

router.post("/login", authCtrl.login);
router.post("/logout", verifyToken, authCtrl.logout);

router.post("/refresh", authCtrl.refresh);

module.exports = router;
