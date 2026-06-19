const path = require("path");
const { createRequire } = require("module");

// Feature routes are mounted by the root server, so every model must share the
// root Mongoose singleton and its connection even when src/backend has modules installed.
const requireFromRoot = createRequire(path.resolve(__dirname, "../../../../package.json"));

module.exports = requireFromRoot("mongoose");
