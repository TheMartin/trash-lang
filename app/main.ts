import { parseProgram } from "./trash/parse";
import { ErrorInfo } from "./parser/parser";
import { Position } from "./stringView/stringView";
import * as ast from "./trash/ast";
import * as trash from "./trash/interpret";

function formatError(error : ErrorInfo) : string
{
  let pos = error.pos as Position;
  return "error on line " + (pos.line + 1) + ":" + (pos.col + 1) + ":"
    + " " + error.message
    + (error.expectations.length > 0 ? ", expected " + error.expectations.join(" or ") : "")
    + (error.context ? " while parsing " + error.context : "");
};

class NativeCallable extends trash.Callable
{
  constructor(private _fn : (...args : trash.Value[]) => trash.Value)
  {
    super();
  }

  call(interpreter : trash.Interpreter, args : trash.Value[]) : trash.Value
  {
    return this._fn(...args);
  }
};

function toString(value : trash.Value) : string
{
  if (value instanceof trash.Callable)
  {
    return "[function]";
  }
  else if (value instanceof trash.Indexable)
  {
    return "[object]";
  }
  else if (value === null)
  {
    return "nil";
  }
  else
  {
    return value as string;
  }
}

function runProgram(program : ast.Block) : string
{
  let environment = new trash.Environment();
  let interpreter = new trash.Interpreter();
  let output : string[] = [];
  let print = new NativeCallable((...args : trash.Value[]) =>
  {
    output.push(args.map(toString).join(" "));
    return null;
  });
  environment = environment.assign("print", print)
  try
  {
    interpreter.executeBlock(program, environment);
  }
  catch (e)
  {
    if (e instanceof trash.InternalError)
    {
      output.push("internal error: " + e.message);
    }
    else if (e instanceof trash.InterpretError)
    {
      output.push((e.token ? "error on line " + (e.token.pos.line + 1) + ":" + (e.token.pos.col + 1) + ": " : "error: ") + e.message);
    }
  }
  return output.join("\n");
}

document.getElementById("run").addEventListener("click", () =>
{
  let result = parseProgram((document.getElementById("input") as HTMLInputElement).value);
  let output = (result as ErrorInfo).message === undefined
    ? runProgram(result as ast.Block)
    : formatError(result as ErrorInfo)
  document.getElementById("result").innerText = output;
});