const fs = require("fs");
const s = fs.readFileSync("/opt/ALETHEIA/.next/server/middleware.js", "utf8");
const i = s.indexOf("NEXTAUTH_URL");
console.log(s.slice(Math.max(0, i - 400), i + 500));
