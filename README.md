# trash-lang

`trash` is a wholly unoriginal scripting language, mostly an excuse to mess around with parser combinators, language interpreters and Typescript.

Current status:
* parsing mostly works
* error reporting sort of works
* interpretation mostly works
* clunky testing interface

## How to build

* Install [node.js](https://nodejs.org/)
* Clone this repo
* `npm install`
* `npm start` to launch dev version in browser
* `npm run build` to build a static version in `\dist`

## `trash` syntax

```
// Single-line comments

/*
   Multi-line comments
*/

// Whitespace is non-semantic, except as a delimiter

var a = 1; // Statements are terminated by semi-colons
var b = 2; // Variables are declared with 'var' and must always be initialized
b = "foo"; // Dynamic typing, primitive types are numbers, strings and booleans
a = nil;   // A nil type is also available
// c = 3;     Using variables before they are introduced is not permitted

var erika = {  // An object type is available and uses Javascript-like syntax
  firstName : "Erika",
  lastName : "Mustermann",
  ["age"] : 26, // Non-identifier keys are also available
  [b] : "bar",  // Bracket notation will use the result of the inner expression as the key
};

// Object properties can be accessed with dot-syntax as well as with bracket-syntax
var firstName = erika.firstName;
var lastName = erika["lastName"];

var foo = function(a, b) // Functions are a first-class type
{
  return a + b; // Single return value. If there is no return, the function behaves as if it returned nil
};

var makeCounter = function()
{
  var i = 0;
  return function() // Functions form closures, capturing primitive types by value
  {
    i += 1;
    return i;
  };
};

// Following operators are available:
// Arithmetic: +, -, *, /, %
// Logical: !, &&, ||, ^
// Comparison: >, >=, <, <=, ==, !=
// Assignment: =, +=, -=, *=, /=, %=

// Basic C-like control flow structures are available
if (a == 2)
{
  print("yes");
}
else
{
  print("no");
}

for (var i = 0; i < 5; i += 1)
{
  // Variables declared in for-loop initializer are scoped to the for-loop body
  if (i % 2 == 0 && 10 * i < erika.age)
    continue;

  if (!b)
    break;
}

while (b > 1e-3) b /= 2;
```

## `trash` integration

Below is the most basic example of executing a `trash` program. It will accept the input as a string, parse it and run it. If an error occurs during parsing or execution, it gets thrown.

```typescript
import * as trash from "trash";

function run(program : string) : void
{
  try
  {
    let program = trash.parse(input);
    let interpreter = new trash.Interpreter();
    interpreter.executeBlock(program);
  }
  catch (e)
  {
    if (e instanceof trash.ParseError)
    {
      // program is ill-formed
    }
    else if (e instanceof trash.InterpretError)
    {
      // runtime error occured
    }
    else if (e instanceof trash.InternalError)
    {
      // trash-lang has a bug
    }
  }
};
```

However, it is also possible to supply a custom set of globals to the interpreter.

```typescript
    let program = trash.parseProgram(input);
    let interpreter = new trash.Interpreter();
    let environment = new trash.Environment([
      ["foo", "bar"]
    ]);
    interpreter.executeBlock(program, environment);
```

Furthermore, using these globals, it is possible to add native functions to the `trash` runtime environment.

```typescript
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
```

```typescript
    let output : string[] = [];
    let program = trash.parse(input);
    let interpreter = new trash.Interpreter();
    let environment = new trash.Environment([
      [
        "print",
        new NativeFunction((...args : trash.Value[]) =>
        {
          output.push(args.map(trash.toString).join(" "));
          return null;
        }
      ]
    ]);
    interpreter.executeBlock(program, environment);
```

Similarly, custom data types can also be implemented.

```typescript
class Vec3 extends trash.Indexable
{
  constructor(x : number, y : number, z : number)
  {
    super();
    this._vec = { x, y, z };
  }

  get(key : trash.Value) : trash.Value
  {
    if (this.isValidKey(key))
    {
      return this._vec[key];
    }
    else
    {
      return null;
    }
  }

  set(key : trash.Value, value : trash.Value) : void
  {
    if (this.isValidKey(key) && this.isValidValue(value))
    {
      this._vec[key] = value;
    }
  }

  private isValidKey(key : trash.Value) : key is string
  {
    return trash.typeOf(key) === trash.Type.String && key in this._vec;
  }

  private isValidValue(value : trash.Value) : value is number
  {
    return trash.typeOf(value) === trash.Type.Number;
  }

  private _vec = { x : 0, y : 0, z : 0 };
};
```

```typescript
    let output : string[] = [];
    let program = trash.parse(input);
    let interpreter = new trash.Interpreter();
    let environment = new trash.Environment([
      [
        "Vec3",
        new NativeFunction((x : trash.Value, y : trash.Value, z : trash.Value) =>
        {
          return trash.typeOf(x) === trash.Type.Number && trash.typeOf(y) === trash.Type.Number && trash.typeOf(z) === trash.Type.Number
            ? new Vec3(x as number, y as number, z as number)
            : null;
        })
      ]
    ]);
    interpreter.executeBlock(program, environment);
```