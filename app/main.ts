import { parseQuotedString, parseNumber, parseExpression } from "./trash/parse";

document.getElementById("parse").addEventListener("click", () =>
{
  let result = parseExpression((document.getElementById("input") as HTMLInputElement).value);
  document.getElementById("result").innerText = (result ? "Parse successful" : "Parse failed");
});