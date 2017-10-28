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

var erika = {  // An object type is available and uses Javascript-like syntaxx
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
  return function() // Functions form closures
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