const { execSync } = require("child_process");
const { writeFileSync } = require("fs");
const path = require("path");

let commitHash = "liquity-v1-cloned\n";
try {
  commitHash = execSync("git rev-parse HEAD", { encoding: "ascii" });
} catch (_) {}
writeFileSync(path.join("artifacts", "version"), commitHash);
