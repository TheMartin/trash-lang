import * as p from "./trash/parse";
import * as ast from "./trash/ast";
import * as trash from "./trash/interpret";

class NativeFunction extends trash.Callable
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

function runProgram(program : ast.Block, output : string[]) : void
{
  let environment = new trash.Environment();
  let interpreter = new trash.Interpreter();
  let print = new NativeFunction((...args : trash.Value[]) =>
  {
    output.push(args.map(trash.toString).join(" "));
    return null;
  });
  environment = environment.assign("print", print);
  interpreter.executeBlock(program, environment);
}

document.getElementById("run").addEventListener("click", () =>
{
  let output : string[] = [];
  try
  {
    let program = p.parseProgram((document.getElementById("input") as HTMLInputElement).value);
    runProgram(program, output);
  }
  catch (e)
  {
    if (e instanceof p.ParseError)
    {
      output.push((e.token ? "error on line " + (e.token.pos.line + 1) + ":" + (e.token.pos.col + 1) + ": " : "error: ") + e.message);
    }
    else if (e instanceof trash.InternalError)
    {
      output.push("internal error: " + e.message);
    }
    else if (e instanceof trash.InterpretError)
    {
      output.push((e.token ? "error on line " + (e.token.pos.line + 1) + ":" + (e.token.pos.col + 1) + ": " : "error: ") + e.message);
    }
  }
  document.getElementById("result").innerText = output.join("\n");
});