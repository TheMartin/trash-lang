import * as t from "../trash/lex";

interface Node
{
  accept<T>(visitor : Visitor<T>) : T;
};

export class Op
{
  constructor(public token : t.Token) {}
};

export class FunctionDef implements Node
{
  constructor(public params : Ident[], public body : Statement) {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitFunctionDefinition(this); }
};

export class ObjectDef implements Node
{
  constructor(public contents : { key : Ident | Expr, value : Expr }[]) {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitObjectDefinition(this); }
};

export class Literal implements Node
{
  constructor(public token : t.Token) {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitLiteral(this); }
};

export class Ident implements Node
{
  constructor(public token : t.Token) {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitIdentifier(this); }
};

export class UnaryExpr implements Node
{
  constructor(public op : Op, public rhs : Expr) {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitUnaryExpression(this); }
};

export class BinaryExpr implements Node
{
  constructor(public op : Op, public lhs : Expr, public rhs : Expr) {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitBinaryExpression(this); }
};

export type PostfixOp = FunctionCall | BracketAccess | DotAccess;

export class PostfixExpr implements Node
{
  constructor(public op : PostfixOp, public lhs : Expr) {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitPostfixExpression(this); }
};

export class FunctionCall implements Node
{
  constructor(public args : Expr[]) {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitFunctionCall(this); }
};

export class BracketAccess implements Node
{
  constructor(public index : Expr) {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitBracketAccess(this); }
};

export class DotAccess implements Node
{
  constructor(public index : Ident) {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitDotAccess(this); }
};

export type Expr = Literal | ObjectDef | FunctionDef | Ident | UnaryExpr | BinaryExpr | PostfixExpr;

export type Statement = Expr | VarDeclaration | JumpStatement | IfStatement | WhileStatement | ForStatement | Block | EmptyStatement;

export type JumpStatement = ReturnStatement | BreakStatement | ContinueStatement;

export class VarDeclaration implements Node
{
  constructor(public name : Ident, public initializer : Expr) {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitVarDeclaration(this); }
};

export class ReturnStatement implements Node
{
  constructor(public expr : Expr) {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitReturnStatement(this); }
};

export class BreakStatement implements Node
{
  constructor() {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitBreakStatement(this); }
};

export class ContinueStatement implements Node
{
  constructor() {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitContinueStatement(this); }
};

export class EmptyStatement
{
  constructor() {}
};

export class Block implements Node
{
  constructor(public statements : Statement[]) {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitBlock(this); }
};

export class IfStatement implements Node
{
  constructor(public condition : Expr, public statement : Statement, public elseStatement : Statement | null) {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitIfStatement(this); }
};

export class WhileStatement implements Node
{
  constructor(public condition : Expr, public statement : Statement) {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitWhileStatement(this); }
};

export type ForInit = VarDeclaration | Expr;

export class ForStatement implements Node
{
  constructor(public init : ForInit | null, public condition : Expr | null, public afterthought : Expr | null, public statement : Statement) {}
  accept<T>(visitor : Visitor<T>) : T { return visitor.visitForStatement(this); }
};

export interface Visitor<T>
{
  visitLiteral(literal : Literal) : T;
  visitObjectDefinition(def : ObjectDef) : T;
  visitFunctionDefinition(def : FunctionDef) : T;
  visitIdentifier(ident : Ident) : T;
  visitUnaryExpression(expr : UnaryExpr) : T;
  visitPostfixExpression(expr : PostfixExpr) : T;
  visitFunctionCall(expr : FunctionCall) : T;
  visitBracketAccess(expr : BracketAccess) : T;
  visitDotAccess(expr : DotAccess) : T;
  visitBinaryExpression(expr : BinaryExpr) : T;
  visitVarDeclaration(decl : VarDeclaration) : T;
  visitReturnStatement(stmt : ReturnStatement) : T;
  visitBreakStatement(stmt : BreakStatement) : T;
  visitContinueStatement(stmt : ContinueStatement) : T;
  visitBlock(block : Block) : T;
  visitIfStatement(stmt : IfStatement) : T;
  visitWhileStatement(stmt : WhileStatement) : T;
  visitForStatement(stmt : ForStatement) : T;
};