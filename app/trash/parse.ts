import * as p from "../parser/parser";
import * as ast from "../trash/ast";
import * as lex from "../trash/lex";
import { Position } from "../stringView/stringView";

export class ParseError
{
  constructor(error : p.ErrorInfo, public pos : Position)
  {
    this.message = error.message
      + (error.expectations.length > 0 ? ", expected " + error.expectations.join(" or ") : "")
      + (error.context ? " while parsing " + error.context : "");
  }

  message : string = "";
};

class TokenView implements p.ParserInput
{
  constructor(public val : lex.Token[], public start : number = 0)
  {
    this.start = Math.min(this.val.length, this.start);
  }
  empty() : boolean
  {
    return this.start === this.val.length;
  }
  pos() : p.Position
  {
    return new TokenViewPosition(this.start);
  }
  peek() : lex.Token
  {
    return this.empty() ? null : this.val[this.start];
  }
  sub(start : number) : TokenView
  {
    return new TokenView(this.val, this.start + start);
  }
};

class TokenViewPosition implements p.Position
{
  constructor(public val : number) {}
  furtherThan(other : p.Position) : boolean
  {
    return this.val > (other as TokenViewPosition).val;
  }
};

function token(type : lex.Type) : p.Parser<lex.Token>
{
  return (input : p.ParserInput) : p.ParseResult<lex.Token> =>
  {
    if (input.empty())
      return new p.ErrorInfo(input.pos(), false, [lex.Type[type]], "unexpected end of input");

    let token = (input as TokenView).peek();
    return token.type === type
      ? new p.ParseInfo(token, (input as TokenView).sub(1), true)
      : new p.ErrorInfo(input.pos(), false, [lex.Type[type]], "unexpected token " + lex.Type[token.type]);
  };
}

function list<V, S>(parser : p.Parser<V>, separator : p.Parser<S>) : p.Parser<V[]>
{
  return p.separatedBy(parser, separator, [], (acc, v) => acc.concat([v]));
};

let openParen = token(lex.Type.LeftParen);
let closeParen = token(lex.Type.RightParen);
let openBracket = token(lex.Type.LeftBracket);
let closeBracket = token(lex.Type.RightBracket);
let openBrace = token(lex.Type.LeftBrace);
let closeBrace = token(lex.Type.RightBrace);
let colon = token(lex.Type.Colon);
let comma = token(lex.Type.Comma);
let dot = token(lex.Type.Dot);
let semicolon = token(lex.Type.Semicolon);

let unaryOp = p.tag(p.fmap(t => new ast.Op(t), p.either(token(lex.Type.Plus), token(lex.Type.Minus), token(lex.Type.Bang))), "unary operator");
let multiplicationOp = p.tag(p.fmap(t => new ast.Op(t), p.either(token(lex.Type.Star), token(lex.Type.Slash), token(lex.Type.Percent))), "multiplication/division operator");
let additionOp = p.tag(p.fmap(t => new ast.Op(t), p.either(token(lex.Type.Plus), token(lex.Type.Minus))), "addition/subtraction operator");
let relationOp = p.tag(p.fmap(t => new ast.Op(t), p.either(token(lex.Type.Less), token(lex.Type.LessEqual), token(lex.Type.Greater), token(lex.Type.GreaterEqual))), "relation operator");
let equalityOp = p.tag(p.fmap(t => new ast.Op(t), p.either(token(lex.Type.EqualEqual), token(lex.Type.BangEqual))), "equality comparison operator");
let xorOp = p.tag(p.fmap(t => new ast.Op(t), token(lex.Type.Caret)), "xor operator");
let andOp = p.tag(p.fmap(t => new ast.Op(t), token(lex.Type.DoubleAmpersand)), "conjunction operator");
let orOp = p.tag(p.fmap(t => new ast.Op(t), token(lex.Type.DoublePipe)), "disjunction operator");
let assignmentOp = p.tag(p.fmap(t => new ast.Op(t), p.either(token(lex.Type.Equal), token(lex.Type.PlusEqual), token(lex.Type.MinusEqual), token(lex.Type.StarEqual), token(lex.Type.SlashEqual), token(lex.Type.PercentEqual))), "assignment operator");

let exprImpl : { parser : p.Parser<ast.Expr> } = { parser : null };
let expr = p.tag((input : p.ParserInput) : p.ParseResult<ast.Expr> => { return exprImpl.parser(input); }, "expression");
let stmtImpl : { parser : p.Parser<ast.Statement> } = { parser : null };
let statement = p.tag((input : p.ParserInput) : p.ParseResult<ast.Statement> => { return stmtImpl.parser(input); }, "statement");
let statements =  p.many(statement, [], (acc, r) => r instanceof ast.EmptyStatement ? acc : acc.concat([r]));
let block = p.fmap(stmts => new ast.Block(stmts), p.enclosed(openBrace, statements, closeBrace));

let nilLiteral = p.tag(p.fmap(t => new ast.Literal(t), token(lex.Type.Nil)), "nil literal");
let booleanLiteral = p.tag(p.fmap(t => new ast.Literal(t), p.either(token(lex.Type.True), token(lex.Type.False))), "boolean literal");
let numberLiteral = p.tag(p.fmap(t => new ast.Literal(t), token(lex.Type.Number)), "number literal");
let stringLiteral = p.tag(p.fmap(t => new ast.Literal(t), token(lex.Type.String)), "string literal");

let identifier = p.tag(p.fmap(t => new ast.Ident(t), token(lex.Type.Identifier)), "identifier");

let keyValuePair = p.combine(p.either(identifier, p.enclosed(openBracket, expr, closeBracket)), p.discardLeft(colon, expr), (k, v) => { return { key : k, value : v }; });
let objectLiteral = p.tag(p.fmap((kvs) => new ast.ObjectDef(kvs), p.enclosed(openBrace, list(keyValuePair, comma), closeBrace)), "object literal");

let functionLiteral = p.tag(p.combine(
  p.discardLeft(token(lex.Type.Function), p.enclosed(openParen, list(identifier, comma), closeParen)),
  block,
  (args, body) => new ast.FunctionDef(args, body)
), "function literal");

let literal = p.tag(p.either(stringLiteral, numberLiteral, booleanLiteral, nilLiteral), "literal");
let primaryExpr = p.either(literal, objectLiteral, functionLiteral, identifier, p.enclosed(openParen, expr, closeParen));

type PostfixOpFactory = (expr : ast.Expr) => ast.Expr;

let bracketAccess = p.fmap((e : ast.Expr) : PostfixOpFactory => (expr : ast.Expr) => new ast.BracketAccess(expr, e), p.enclosed(openBracket, expr, closeBracket));
let dotAccess = p.fmap((i : ast.Ident) : PostfixOpFactory => (expr : ast.Expr) => new ast.DotAccess(expr, i), p.discardLeft(dot, identifier));
let functionCall = p.fmap((args : ast.Expr[]) : PostfixOpFactory => (expr : ast.Expr) => new ast.FunctionCall(expr, args), p.enclosed(openParen, list(expr, comma), closeParen));
let postfixExpr = p.bind(primaryExpr, (primary : ast.Expr, input : p.ParserInput) =>
{
  return p.many(p.either(bracketAccess, dotAccess, functionCall), primary, (expr, op) : ast.Expr => op(expr))(input);
});

let unaryExprImpl : { parser : p.Parser<ast.Expr> } = { parser : null };
let unaryExpr = (input : p.ParserInput) : p.ParseResult<ast.Expr> => { return unaryExprImpl.parser(input); };
unaryExprImpl.parser = p.either(p.combine(unaryOp, unaryExpr, (op, expr) => new ast.UnaryExpr(op, expr)), postfixExpr);

function binaryExpr(expr : p.Parser<ast.Expr>, op : p.Parser<ast.Op>) : p.Parser<ast.Expr>
{
  return p.bind(expr, (first : ast.Expr, input : p.ParserInput) =>
  {
    return p.many(
      p.combine(op, expr, (o, e) => { return { op : o, expr : e }; }),
      first,
      (lhs, rhs) => new ast.BinaryExpr(rhs.op, lhs, rhs.expr)
    )(input);
  });
};

let multiplicationExpr = binaryExpr(unaryExpr, multiplicationOp);
let additionExpr = binaryExpr(multiplicationExpr, additionOp);
let relationExpr = binaryExpr(additionExpr, relationOp);
let equalityExpr = binaryExpr(relationExpr, equalityOp);
let xorExpr = binaryExpr(equalityExpr, xorOp);
let andExpr = binaryExpr(xorExpr, andOp);
let orExpr = binaryExpr(andExpr, orOp);
exprImpl.parser = orExpr;

let assignment = p.combine(
  postfixExpr,
  p.combine(assignmentOp, expr, (o, e) => { return { op : o, expr : e }; } ),
  (lhs, rhs) => new ast.Assignment(rhs.op, lhs, rhs.expr)
);

let declaration = p.combine(
  p.discardLeft(token(lex.Type.Var), identifier),
  p.discardLeft(token(lex.Type.Equal), expr),
  (name, init) => new ast.VarDeclaration(name, init)
);

let breakStmt = p.fmap(() => new ast.BreakStatement(), p.discardRight(token(lex.Type.Break), semicolon));
let continueStmt = p.fmap(() => new ast.ContinueStatement(), p.discardRight(token(lex.Type.Continue), semicolon));
let returnStmt = p.fmap((e) => new ast.ReturnStatement(e), p.discardRight(p.discardLeft(token(lex.Type.Return), expr), semicolon));
let jumpStmt = p.either(p.fmap((v) => v as ast.JumpStatement, breakStmt), p.fmap((v) => v as ast.JumpStatement, continueStmt), p.fmap((v) => v as ast.JumpStatement, returnStmt));
let ifStatement = p.tag(p.combine(
  p.combine(
    p.discardLeft(token(lex.Type.If), p.enclosed(openParen, expr, closeParen)),
    statement,
    (cond, stmt) =>
    {
      return { condition : cond, statement : stmt };
    }
  ),
  p.option(null, p.discardLeft(token(lex.Type.Else), statement)),
  (ifStmt, elseStmt) => new ast.IfStatement(ifStmt.condition, ifStmt.statement, elseStmt)
), "if statement");
let whileStatement = p.tag(p.combine(p.discardLeft(token(lex.Type.While), p.enclosed(openParen, expr, closeParen)), statement, (cond, stmt) => new ast.WhileStatement(cond, stmt)), "while statement");
let forSpec = p.combine(
  p.combine(
    p.discardRight(p.option(null, p.either(p.fmap((e) => e as ast.ForInit, assignment), p.fmap((e) => e as ast.ForInit, declaration))), semicolon),
    p.discardRight(p.option(null, expr), semicolon),
    (init, cond) =>
    {
      return { init : init, cond : cond };
    }
  ),
  p.option(null, assignment),
  (forSpec, after) =>
  {
    return { init : forSpec.init, cond : forSpec.cond, after : after };
  }
);
let forStatement = p.tag(p.combine(p.discardLeft(token(lex.Type.For), p.enclosed(openParen, forSpec, closeParen)), statement, (forSpec, stmt) => new ast.ForStatement(forSpec.init, forSpec.cond, forSpec.after, stmt)), "for statement");
let exprStatement = p.fmap(e => new ast.ExprStatement(e), p.discardRight(expr, semicolon));
stmtImpl.parser = p.either(p.fmap(() => new ast.EmptyStatement(), semicolon), p.discardRight(declaration, semicolon), p.discardRight(assignment, semicolon), exprStatement, block, jumpStmt, ifStatement, whileStatement, forStatement);

let program = p.fmap((stmts) => new ast.Block(stmts), p.discardRight(statements, token(lex.Type.Eof)));

export function parse(input : string) : ast.Block
{
  let tokens = lex.tokenize(input);
  if (tokens instanceof p.ErrorInfo)
    throw new ParseError(tokens, tokens.pos as Position);

  let result = program(new TokenView(tokens));
  if (p.isError(result))
  {
    let i = (result.pos as TokenViewPosition).val;
    throw new ParseError(result, i <= tokens.length ? tokens[i].pos : undefined);
  }

  return result.output;
};