import "dotenv/config";
import { readFile } from "node:fs/promises";
import { describePayloadShape } from "../src/webhook/sanitize.js";

const path = process.argv[2];
if (!path) throw new Error("Berikan path fixture JSON yang sudah disanitasi");
const payload: unknown = JSON.parse(await readFile(path, "utf8"));
console.log(JSON.stringify(describePayloadShape(payload), null, 2));
