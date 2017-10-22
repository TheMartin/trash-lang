import { parseProgram } from "./trash/parse";
import { TokenType, Token, tokenize } from "./trash/lex";
import { ErrorInfo } from "./parser/parser";
import { Position } from "./stringView/stringView";

function formatError(error : ErrorInfo) : string
{
  let pos = error.pos as Position;
  return "error on line " + (pos.line + 1) + ":" + (pos.col + 1) + ":"
    + " " + error.message
    + (error.expectations.length > 0 ? ", expected " + error.expectations.join(" or ") : "")
    + (error.context ? " while parsing " + error.context : "");
};

function formatTokens(tokens : Token[]) : string
{
  let result = "";
  let line = 0;
  for (let token of tokens)
  {
    while (token.pos.line > line)
    {
      result += "\n";
      ++line;
    }

    result += TokenType[token.type];
    if (token.value !== null)
      result += "(" + token.value + ")";

    result += " ";
  }
  return result;
};

document.getElementById("parse").addEventListener("click", () =>
{
  let result = parseProgram((document.getElementById("input") as HTMLInputElement).value);
  let output = (result as ErrorInfo).message === undefined
    ? JSON.stringify(result, null, 2)
    : formatError(result as ErrorInfo)
  /*
  let result = tokenize((document.getElementById("input") as HTMLInputElement).value);
  let output = formatTokens(result);
  */
  document.getElementById("result").innerText = output;
});