export enum Op
{
  UnaryPlus,
  UnaryMinus,
  Not,
  Plus,
  Minus,
  Times,
  Divide,
  Modulo,
  GreaterThan,
  LessThan,
  GreaterOrEqual,
  LessOrEqual,
  Equal,
  NotEqual,
  ExclusiveOr,
  Or,
  And,
  Assign,
  PlusAssign,
  MinusAssign,
  TimesAssign,
  DivideAssign,
  ModuloAssign
};

export class FunctionDef
{
  constructor(public args : Ident[], public body : Statement) {}
};

export class ObjectDef
{
  constructor(public contents : { key : Ident | Expr, value : Expr }[]) {}
};

export class Literal
{
  constructor(public value : ObjectDef | FunctionDef | string | number | boolean | null) {}
};

export class Ident
{
  constructor(public name : string) {}
};

export class UnaryExpr
{
  constructor(public op : Op, public rhs : Expr) {}
};

export class BinaryExpr
{
  constructor(public op : Op, public lhs : Expr, public rhs : Expr) {}
};

export type PostFixOp = FunctionCall | BracketAccess | DotAccess;

export class PostFixExpr
{
  constructor(public op : PostFixOp, lhs : Expr) {}
};

export class FunctionCall
{
  constructor(public args : Expr[]) {}
};

export class BracketAccess
{
  constructor(public index : Expr) {}
};

export class DotAccess
{
  constructor(public index : Ident) {}
};

export type Expr = Literal | Ident | UnaryExpr | BinaryExpr | PostFixExpr;

export type Statement = Expr | VarDeclaration | JumpStatement | IfStatement | WhileStatement | ForStatement | Block | EmptyStatement;

export type JumpStatement = ReturnStatement | BreakStatement | ContinueStatement;

export class VarDeclaration
{
  constructor(public name : Ident, public initializer : Expr) {}
};

export class ReturnStatement
{
  constructor(public expr : Expr) {}
};

export class BreakStatement
{
  constructor() {}
};

export class ContinueStatement
{
  constructor() {}
};

export class EmptyStatement
{
  constructor() {}
};

export class Block
{
  constructor(public statements : Statement[]) {}
};

export class IfStatement
{
  constructor(public condition : Expr, public statement : Statement, public elseStatement : Statement | null) {}
};

export class WhileStatement
{
  constructor(public condition : Expr, public statement : Statement) {}
};

export type ForInit = VarDeclaration | Expr;

export class ForStatement
{
  constructor(public init : ForInit | null, public condition : Expr | null, public afterthought : Expr | null, public statement : Statement) {}
};