const fs = require("fs");
const path = require("path");

console.log("🔍 Checking MindVault Backend Setup...\n");

// Check if folders exist
const folders = [
  "config",
  "models",
  "controllers",
  "routes",
  "middleware",
  "services",
  "utils",
];

folders.forEach((folder) => {
  const folderPath = path.join(__dirname, folder);
  if (fs.existsSync(folderPath)) {
    console.log(`✅ Folder exists: ${folder}/`);
  } else {
    console.log(`❌ Folder missing: ${folder}/`);
  }
});

// Check if .env file exists
console.log("\n");
if (fs.existsSync(path.join(__dirname, ".env"))) {
  console.log("✅ .env file exists");
} else {
  console.log("❌ .env file missing - create it!");
}

// Check if packages are installed
console.log("\n");
const packagePath = path.join(__dirname, "node_modules");
if (fs.existsSync(packagePath)) {
  const packages = fs.readdirSync(packagePath).length;
  console.log(`✅ node_modules exists with ${packages} packages installed`);
} else {
  console.log("❌ node_modules missing - run npm install");
}

console.log("\n✅ Setup verification complete!");
