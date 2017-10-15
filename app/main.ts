import { parseQuotedString, parseNumber } from "./trash/parse";

document.getElementById("parse").addEventListener("click", () =>
{
  let result = parseNumber((document.getElementById("input") as HTMLInputElement).value);
  document.getElementById("result").innerText = result === null ? "Parse failed" : Number(result).toFixed(2);
});