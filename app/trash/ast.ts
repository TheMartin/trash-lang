import * as t from "../trash/lex";

interface VisitableExpr
{
  accept<T>(visitor : ExprVisitor<T>) : T;
};

interface VisitableStmt
{
  accept<T>(visitor : StmtVisitor<T>) : T;
};

export class Op
{
  constructor(public token : t.Token) {}
};

export class FunctionDef implements VisitableExpr
{
  constructor(public params : Ident[], public body : Block) {}
  accept<T>(visitor : ExprVisitor<T>) : T { return visitor.visitFunctionDefinition(this); }
};

export class ObjectDef implements VisitableExpr
{
  constructor(public contents : { key : Ident | Expr, value : Expr }[]) {}
  accept<T>(visitor : ExprVisitor<T>) : T { return visitor.visitObjectDefinition(this); }
};

export class Literal implements VisitableExpr
{
  constructor(public token : t.Token) {}
  accept<T>(visitor : ExprVisitor<T>) : T { return visitor.visitLiteral(this); }
};

export class Ident implements VisitableExpr
{
  constructor(public token : t.Token) {}
  accept<T>(visitor : ExprVisitor<T>) : T { return visitor.visitIdentifier(this); }
};

export class UnaryExpr implements VisitableExpr
{
  constructor(public op : Op, public rhs : Expr) {}
  accept<T>(visitor : ExprVisitor<T>) : T { return visitor.visitUnaryExpression(this); }
};

export class BinaryExpr implements VisitableExpr
{
  constructor(public op : Op, public lhs : Expr, public rhs : Expr) {}
  accept<T>(visitor : ExprVisitor<T>) : T { return visitor.visitBinaryExpression(this); }
};

export class FunctionCall implements VisitableExpr
{
  constructor(public callee : Expr, public args : Expr[]) {}
  accept<T>(visitor : ExprVisitor<T>) : T { return visitor.visitFunctionCall(this); }
};

export class BracketAccess implements VisitableExpr
{
  constructor(public lhs : Expr, public index : Expr) {}
  accept<T>(visitor : ExprVisitor<T>) : T { return visitor.visitBracketAccess(this); }
};

export class DotAccess implements VisitableExpr
{
  constructor(public lhs : Expr, public index : Ident) {}
  accept<T>(visitor : ExprVisitor<T>) : T { return visitor.visitDotAccess(this); }
};

export type Expr = Literal | ObjectDef | FunctionDef | Ident | UnaryExpr | BinaryExpr | FunctionCall | BracketAccess | DotAccess;

export type Statement = ExprStatement | Assignment | VarDeclaration | JumpStatement | IfStatement | WhileStatement | ForStatement | Block | EmptyStatement;

export type JumpStatement = ReturnStatement | BreakStatement | ContinueStatement;

export class Assignment implements VisitableStmt
{
  constructor(public op : Op, public lhs : Expr, public rhs : Expr) {}
  accept<T>(visitor : StmtVisitor<T>) : T { return visitor.visitAssignment(this); }
};

export class VarDeclaration implements VisitableStmt
{
  constructor(public name : Ident, public initializer : Expr) {}
  accept<T>(visitor : StmtVisitor<T>) : T { return visitor.visitVarDeclaration(this); }
};

export class ExprStatement implements VisitableStmt
{
  constructor(public expr : Expr) {}
  accept<T>(visitor : StmtVisitor<T>) : T { return visitor.visitExpressionStatement(this); }
};

export class ReturnStatement implements VisitableStmt
{
  constructor(public expr : Expr) {}
  accept<T>(visitor : StmtVisitor<T>) : T { return visitor.visitReturnStatement(this); }
};

export class BreakStatement implements VisitableStmt
{
  constructor() {}
  accept<T>(visitor : StmtVisitor<T>) : T { return visitor.visitBreakStatement(this); }
};

export class ContinueStatement implements VisitableStmt
{
  constructor() {}
  accept<T>(visitor : StmtVisitor<T>) : T { return visitor.visitContinueStatement(this); }
};

export class EmptyStatement implements VisitableStmt
{
  constructor() {}
  accept<T>(visitor : StmtVisitor<T>) : T { return visitor.visitEmptyStatement(this); }
};

export class Block implements VisitableStmt
{
  constructor(public statements : Statement[]) {}
  accept<T>(visitor : StmtVisitor<T>) : T { return visitor.visitBlock(this); }
};

export class IfStatement implements VisitableStmt
{
  constructor(public condition : Expr, public statement : Statement, public elseStatement : Statement | null) {}
  accept<T>(visitor : StmtVisitor<T>) : T { return visitor.visitIfStatement(this); }
};

export class WhileStatement implements VisitableStmt
{
  constructor(public condition : Expr, public statement : Statement) {}
  accept<T>(visitor : StmtVisitor<T>) : T { return visitor.visitWhileStatement(this); }
};

export type ForInit = VarDeclaration | Assignment;

export class ForStatement implements VisitableStmt
{
  constructor(public init : ForInit | null, public condition : Expr | null, public afterthought : Assignment | null, public statement : Statement) {}
  accept<T>(visitor : StmtVisitor<T>) : T { return visitor.visitForStatement(this); }
};

export interface ExprVisitor<T>
{
  visitLiteral(literal : Literal) : T;
  visitObjectDefinition(def : ObjectDef) : T;
  visitFunctionDefinition(def : FunctionDef) : T;
  visitIdentifier(ident : Ident) : T;
  visitUnaryExpression(expr : UnaryExpr) : T;
  visitFunctionCall(expr : FunctionCall) : T;
  visitBracketAccess(expr : BracketAccess) : T;
  visitDotAccess(expr : DotAccess) : T;
  visitBinaryExpression(expr : BinaryExpr) : T;
};

export interface StmtVisitor<T>
{
  visitAssignment(stmt : Assignment): T;
  visitVarDeclaration(decl : VarDeclaration) : T;
  visitExpressionStatement(stmt : ExprStatement) : T;
  visitReturnStatement(stmt : ReturnStatement) : T;
  visitBreakStatement(stmt : BreakStatement) : T;
  visitContinueStatement(stmt : ContinueStatement) : T;
  visitEmptyStatement(stmt : EmptyStatement) : T;
  visitBlock(block : Block) : T;
  visitIfStatement(stmt : IfStatement) : T;
  visitWhileStatement(stmt : WhileStatement) : T;
  visitForStatement(stmt : ForStatement) : T;
};