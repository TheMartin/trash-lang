import * as ast from "../trash/ast";
import * as t from "../trash/lex";

export class InternalError
{
  constructor(public message : string) {}
};

class TypeMismatchError
{
  constructor(public type : Type, public types : Type[]) {}
};

export class InterpretError
{
  constructor(public message : string, public token? : t.Token) {}
};

export abstract class Callable
{
  abstract call(interpreter : Interpreter, args : Value[]) : Value;
};

class TrashFunction extends Callable
{
  constructor(public definition : ast.FunctionDef, public closure : Environment)
  {
    super();
  }

  call(interpreter : Interpreter, args : Value[]) : Value
  {
    if (args.length !== this.definition.params.length)
      throw new InterpretError("arity mismatch in function call");

    let env = new Environment(this.closure);
    for (let i = 0; i < args.length; ++i)
    {
      env = env.assign(this.definition.params[i].token.value as string, args[i]);
    }
    let result = interpreter.executeBlock(this.definition.body, env);
    if (!result)
    {
      return null;
    }
    else if (result instanceof Return)
    {
      return result.value;
    }
    else
    {
      throw new InterpretError("unexpected " + (result instanceof Break ? "break" : "continue") + " in function body");
    }
  }
};

export abstract class Indexable
{
  abstract get(key : Value) : Value;
  abstract set(key : Value, value : Value) : void;
};

class TrashObject extends Indexable
{
  get(key : Value) : Value
  {
    let result = this._value.get(key);
    return result !== undefined ? result : null;
  }

  set(key : Value, value : Value) : void
  {
    this._value.set(key, value);
  }

  private _value : Map<Value, Value> = new Map<Value, Value>();
};

class Variable
{
  constructor(private _owner : Environment, private _key : string)
  {
  }

  eval() : Value
  {
    return this._owner.get(this._key);
  }

  assign(value : Value) : void
  {
    this._owner.set(this._key, value);
  }
};

class Accessor
{
  constructor(private _owner : Indexable, private _key : Value)
  {
  }

  eval() : Value
  {
    return this._owner.get(this._key);
  }

  assign(value : Value) : void
  {
    this._owner.set(this._key, value);
  }
};

enum Type
{
  Nil,
  Boolean,
  Number,
  String,
  Function,
  Object
};

function typeOf(value : Value) : Type
{
  if (value instanceof Indexable)
  {
    return Type.Object;
  }
  else if (value instanceof Callable)
  {
    return Type.Function;
  }
  else if (typeof value === "string")
  {
    return Type.String;
  }
  else if (typeof value === "number")
  {
    return Type.Number;
  }
  else if (typeof value === "boolean")
  {
    return Type.Boolean;
  }
  else if (value === null)
  {
    return Type.Nil;
  }
  else
  {
    throw new InternalError("unrecognized type of value");
  }
}

export type Value = null | boolean | number | string | Callable | Indexable;
type LValue = Value | Variable | Accessor;

class Break {};
class Continue {};
class Return
{
  constructor(public value : Value) {}
}

type Result = null | Break | Continue | Return;

export class Environment
{
  constructor(public previous? : Environment) {}

  get(key : string) : Value
  {
    let result = this._contents.get(key);
    if (result !== undefined)
    {
      return result;
    }
    else if (this.previous)
    {
      return this.previous.get(key);
    }
    else
    {
      throw new InterpretError("reading from an undeclared variable '" + key + "'");
    }
  }

  set(key : string, value : Value) : void
  {
    if (this._contents.has(key))
    {
      this._contents.set(key, value);
    }
    else if (this.previous)
    {
      this.previous.set(key, value);
    }
    else
    {
      throw new InterpretError("assigning into an undeclared variable '" + key + "'");
    }
  }

  assign(key : string, value : Value) : Environment
  {
    if (!this._contents.has(key))
    {
      let env = this.previous ? this.extend() : this;
      env._contents.set(key, value);
      return env;
    }

    throw new InterpretError("double declaration of variable '" + key + "'");
  }

  private extend() : Environment
  {
    let environment = new Environment(this.previous);
    environment._contents = new Map<string, Value>(this._contents);
    return environment;
  }

  private _contents : Map<string, Value> = new Map<string, Value>();
};

function isTruthy(value : Value) : boolean
{
  return value !== null
    && value !== false
    && value !== 0;
};

function checkType(value : Value, types : Type[]) : void
{
  for (let type of types)
  {
    if (typeOf(value) === type)
      return;
  }

  throw new TypeMismatchError(typeOf(value), types);
}

export class Interpreter implements ast.ExprVisitor<LValue>, ast.StmtVisitor<Result>
{
  visitLiteral(literal : ast.Literal) : LValue
  {
    return literal.token.value;
  }

  visitObjectDefinition(def : ast.ObjectDef) : LValue
  {
    let result = new TrashObject();
    for (let kv of def.contents)
    {
      if (kv.key instanceof ast.Ident)
      {
        result.set(kv.key.token.value as string, this.evaluate(kv.value));
      }
      else
      {
        result.set(this.evaluate(kv.key), this.evaluate(kv.value));
      }
    }
    return result;
  }

  visitFunctionDefinition(def : ast.FunctionDef) : LValue
  {
    return new TrashFunction(def, this._environment);
  }

  visitIdentifier(ident : ast.Ident) : LValue
  {
    return new Variable(this._environment, ident.token.value as string);
  }

  visitUnaryExpression(expr : ast.UnaryExpr) : LValue
  {
    let operand = this.evaluate(expr.rhs);

    try
    {
      switch (expr.op.token.type)
      {
        case t.Type.Bang:
          return !isTruthy(operand);
        case t.Type.Plus:
          return operand;
        case t.Type.Minus:
          checkType(operand, [Type.Number]);
          return -(operand as number);
      }
    }
    catch (e)
    {
      if (e instanceof TypeMismatchError)
      {
        throw new InterpretError("unexpected operand of type " + Type[e.type] + " for operator " + expr.op.token.value, expr.op.token);
      }

      throw e;
    }

    throw new InternalError("unexpected unary operator " + expr.op.token.value);
  }
  
  visitFunctionCall(expr : ast.FunctionCall) : LValue
  {
    let operand = this.evaluate(expr.callee);
    if (operand instanceof Callable)
    {
      let params = expr.args.map(arg => this.evaluate(arg));
      return operand.call(this, params);
    }

    throw new InterpretError("attempted to call a non-callable");
  }
  
  visitBracketAccess(expr : ast.BracketAccess) : LValue
  {
    let operand = this.evaluate(expr.lhs);
    if (operand instanceof Indexable)
      return new Accessor(operand, this.evaluate(expr.index));

    throw new InterpretError("attempted to index a non-indexable");
  }
  
  visitDotAccess(expr : ast.DotAccess) : LValue
  {
    let operand = this.evaluate(expr.lhs);
    if (operand instanceof Indexable)
      return new Accessor(operand, expr.index.token.value as string);

    throw new InterpretError("attempted to index a non-indexable");
  }

  visitBinaryExpression(expr : ast.BinaryExpr) : LValue
  {
    let left = this.evaluate(expr.lhs);
    let right = this.evaluate(expr.rhs);

    try
    {
      switch (expr.op.token.type)
      {
        case t.Type.Plus:
          checkType(left, [Type.Number, Type.String]);
          checkType(right, [Type.Number, Type.String]);
          return (left as any) + (right as any);
        case t.Type.Minus:
          checkType(left, [Type.Number]);
          checkType(right, [Type.Number]);
          return (left as number) - (right as number);
        case t.Type.Star:
          checkType(left, [Type.Number]);
          checkType(right, [Type.Number]);
          return (left as number) * (right as number);
        case t.Type.Slash:
          checkType(left, [Type.Number]);
          checkType(right, [Type.Number]);
          return (left as number) / (right as number);
        case t.Type.Percent:
          checkType(left, [Type.Number]);
          checkType(right, [Type.Number]);
          return (left as number) % (right as number);
        case t.Type.Greater:
          checkType(left, [Type.Number]);
          checkType(right, [Type.Number]);
          return left > right;
        case t.Type.GreaterEqual:
          checkType(left, [Type.Number]);
          checkType(right, [Type.Number]);
          return left >= right;
        case t.Type.Less:
          checkType(left, [Type.Number]);
          checkType(right, [Type.Number]);
          return left < right;
        case t.Type.LessEqual:
          checkType(left, [Type.Number]);
          checkType(right, [Type.Number]);
          return left <= right;
        case t.Type.EqualEqual:
          return left === right;
        case t.Type.BangEqual:
          return left !== right;
        case t.Type.Caret:
          return isTruthy(left) !== isTruthy(right);
        case t.Type.DoublePipe:
          return isTruthy(left) || isTruthy(right);
        case t.Type.DoubleAmpersand:
          return isTruthy(left) && isTruthy(right);
      }      
    }
    catch (e)
    {
      if (e instanceof TypeMismatchError)
      {
        throw new InterpretError("unexpected operand of type " + Type[e.type] + " for operator " + expr.op.token.value, expr.op.token);
      }

      throw e;
    }

    throw new InternalError("unexpected unary operator " + expr.op.token.value);
  }

  visitAssignment(stmt : ast.Assignment) : Result
  {
    let left = stmt.lhs.accept(this);
    let right = this.evaluate(stmt.rhs);

    if (!(left instanceof Variable || left instanceof Accessor))
      throw new InterpretError("left hand side is not assignable", stmt.op.token);

    try
    {
      switch (stmt.op.token.type)
      {
        case t.Type.Equal:
          left.assign(right);
          return null;
        case t.Type.PlusEqual:
          {
            let leftVal = left.eval();
            checkType(leftVal, [Type.Number, Type.String]);
            checkType(right, [Type.Number, Type.String]);
            left.assign((leftVal as any) + (right as any));
          }
          return null;
        case t.Type.MinusEqual:
          {
            let leftVal = left.eval();
            checkType(leftVal, [Type.Number]);
            checkType(right, [Type.Number]);
            left.assign((leftVal as number) - (right as number));
          }
          return null;
        case t.Type.StarEqual:
          {
            let leftVal = left.eval();
            checkType(leftVal, [Type.Number]);
            checkType(right, [Type.Number]);
            left.assign((leftVal as number) * (right as number));
          }
          return null;
        case t.Type.SlashEqual:
          {
            let leftVal = left.eval();
            checkType(leftVal, [Type.Number]);
            checkType(right, [Type.Number]);
            left.assign((leftVal as number) / (right as number));
          }
          return null;
        case t.Type.PercentEqual:
          {
            let leftVal = left.eval();
            checkType(leftVal, [Type.Number]);
            checkType(right, [Type.Number]);
            left.assign((leftVal as number) % (right as number));
          }
          return null;
      }
    }
    catch (e)
    {
      if (e instanceof TypeMismatchError)
      {
        throw new InterpretError("unexpected operand of type " + Type[e.type] + " for operator " + stmt.op.token.value, stmt.op.token);
      }

      throw e;
    }

    throw new InternalError("unexpected assignment operator " + stmt.op.token.value);
  }

  visitVarDeclaration(decl : ast.VarDeclaration) : Result
  {
    this._environment = this._environment.assign(decl.name.token.value as string, this.evaluate(decl.initializer));
    return null;
  }

  visitExpressionStatement(stmt : ast.ExprStatement) : Result
  {
    stmt.expr.accept(this);
    return null;
  }

  visitReturnStatement(stmt : ast.ReturnStatement) : Result
  {
    return new Return(this.evaluate(stmt.expr));
  }

  visitBreakStatement(stmt : ast.BreakStatement) : Result
  {
    return new Break();
  }

  visitContinueStatement(stmt : ast.ContinueStatement) : Result
  {
    return new Continue();
  }

  visitEmptyStatement(stmt : ast.EmptyStatement) : Result
  {
    return null;
  }

  visitBlock(block : ast.Block) : Result
  {
    return this.executeBlock(block, new Environment(this._environment));
  }

  visitIfStatement(stmt : ast.IfStatement) : Result
  {
    if (isTruthy(this.evaluate(stmt.condition)))
    {
      return stmt.statement.accept(this);
    }
    else if (stmt.elseStatement)
    {
      return stmt.elseStatement.accept(this);
    }

    return null;
  }

  visitWhileStatement(stmt : ast.WhileStatement) : Result
  {
    while (isTruthy(this.evaluate(stmt.condition)))
    {
      let result = stmt.statement.accept(this);
      if (result)
      {
        if (result instanceof Break)
          break;

        if (result instanceof Return)
          return result;
      }
    }

    return null;
  }

  visitForStatement(stmt : ast.ForStatement) : Result
  {
    let previous = this._environment;
    let newEnv = new Environment(this._environment);
    try
    {
      this._environment = newEnv;

      if (stmt.init)
        stmt.init.accept(this);

      while (stmt.condition ? isTruthy(this.evaluate(stmt.condition)) : true)
      {
        let result = stmt.statement.accept(this);
        if (result)
        {
          if (result instanceof Break)
          {
            break;
          }

          if (result instanceof Return)
          {
            return result;
          }
        }

        if (stmt.afterthought)
          stmt.afterthought.accept(this);
      }      
    }
    finally
    {
      this._environment = previous;
    }

    return null;
  }

  executeBlock(block : ast.Block, env : Environment) : Result
  {
    let previous = this._environment;
    try
    {
      this._environment = env;
      for (let stmt of block.statements)
      {
        let result = stmt.accept(this);
        if (result)
        {
          return result;
        }
      }
    }
    finally
    {
      this._environment = previous;
    }
    return null;
  }

  private pushEnv() : void
  {
    this._environment = new Environment(this._environment);
  }

  private popEnv() : void
  {
    this._environment = this._environment.previous;
  }

  private evaluate(expr : ast.Expr) : Value
  {
    let result = expr.accept(this);
    if (result instanceof Variable)
    {
      return result.eval();
    }
    else if (result instanceof Accessor)
    {
      return result.eval();
    }
    else
    {
      return result;
    }
  }

  private _environment : Environment = new Environment();
};