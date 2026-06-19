require("dotenv").config();

// The root server is the canonical runtime. This compatibility entry point keeps
// `node src/backend/server.js` working for contributors using the older package.
import("../index.js").catch((error) => {
  console.error("Failed to start canonical server", error);
  process.exit(1);
});
