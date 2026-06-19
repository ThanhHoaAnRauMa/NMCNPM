const express = require("express");
const router = express.Router();
const groupCtrl = require("../controllers/group.controller");
const { verifyToken } = require("../middleware/auth.middleware");

router.use(verifyToken);

router.post("/", groupCtrl.createGroup);
router.get("/", groupCtrl.getMyGroups);
router.patch("/:id", groupCtrl.updateGroup);
router.post("/:id/members", groupCtrl.addMember);
router.delete("/:id/members/:userId", groupCtrl.removeMember);
router.post("/:id/admins", groupCtrl.promoteAdmin);

module.exports = router;
