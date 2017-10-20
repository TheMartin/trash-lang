import { parseQuotedString, parseNumber, parseProgram } from "./trash/parse";

document.getElementById("parse").addEventListener("click", () =>
{
  let result = parseProgram((document.getElementById("input") as HTMLInputElement).value);
  document.getElementById("result").innerText = (result ? JSON.stringify(result, null, 2) : "Parse failed");
});