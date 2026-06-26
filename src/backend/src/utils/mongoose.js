const path = require("path");
const { createRequire } = require("module");

// Feature routes are mounted by the root server, so every model must share the
// root Mongoose singleton and its connection even when src/backend has modules installed.
const requireFromRoot = createRequire(path.resolve(__dirname, "../../../../package.json"));

const mongoose = requireFromRoot("mongoose");
const production = process.env.NODE_ENV === "production";
const autoIndex = process.env.MONGO_AUTO_INDEX === "true" || (!production && process.env.MONGO_AUTO_INDEX !== "false");

mongoose.set("autoIndex", autoIndex);
mongoose.set("autoCreate", autoIndex);

module.exports = mongoose;
