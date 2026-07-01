/**
 * Push email-relay/ and update the shipping@ Web app deployment.
 * Usage:
 *   node scripts/redeploy-email.js [description]
 *   node scripts/redeploy-email.js --push-only
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const claspFile = path.join(root, ".clasp.email.json");
const claspIgnorePath = path.join(root, ".claspignore");
const deployIgnorePath = path.join(root, "email-relay", ".claspignore.deploy");

if (!fs.existsSync(claspFile)) {
  console.error("Missing .clasp.email.json — create the shipping@ Apps Script project first.");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(claspFile, "utf8"));
if (!config.scriptId || config.scriptId.includes("YOUR_")) {
  console.error("Set scriptId in .clasp.email.json (Script ID from the shipping@ project).");
  process.exit(1);
}
if (!config.deploymentId || config.deploymentId.includes("YOUR_")) {
  console.error("Set deploymentId in .clasp.email.json (middle segment of the /exec URL).");
  process.exit(1);
}

const pushOnly = process.argv.includes("--push-only");
const descriptionArgs = process.argv.slice(2).filter(arg => arg !== "--push-only");
const description = descriptionArgs.join(" ").trim() || "email relay redeploy";
const originalIgnore = fs.existsSync(claspIgnorePath) ? fs.readFileSync(claspIgnorePath, "utf8") : "";

fs.copyFileSync(claspFile, path.join(root, ".clasp.json"));
fs.copyFileSync(deployIgnorePath, claspIgnorePath);

try {
  console.log("Pushing email-relay project…");
  execSync("npx clasp push --force", { stdio: "inherit", cwd: root });

  if (pushOnly) {
    console.log("Email relay pushed.");
  } else {
    console.log(`Updating Web app deployment ${config.deploymentId}…`);
    execSync(`npx clasp deploy -i ${config.deploymentId} -d "${description.replace(/"/g, '\\"')}"`, {
      stdio: "inherit",
      cwd: root,
      shell: true,
    });

    console.log("Email relay live. APPS_SCRIPT_URL should point to:");
    console.log(`https://script.google.com/macros/s/${config.deploymentId}/exec`);
  }
} finally {
  if (originalIgnore) fs.writeFileSync(claspIgnorePath, originalIgnore);
  else if (fs.existsSync(claspIgnorePath)) fs.unlinkSync(claspIgnorePath);
}
