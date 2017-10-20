import * as p from "../parser/parser";
import { StringView } from "../stringView/stringView";

interface Literal
{
  value : string | number | boolean | null;
};

interface Ident
{
  name : string;
};

interface UnaryExpr
{
  op : string;
  rhs : Expr;
};

interface BinaryExpr
{
  op : string;
  lhs : Expr;
  rhs : Expr;
};

type PostFixOp = FuncCall | BracketAccess | DotAccess;

interface PostFixExpr
{
  op : PostFixOp;
  lhs : Expr;
};

interface FuncCall
{
  args : Expr[];
};

interface BracketAccess
{
  index : Expr;
};

interface DotAccess
{
  index : Ident;
};

interface VarDecl
{
  name : Ident;
};

type Expr = Literal | Ident | UnaryExpr | BinaryExpr | PostFixExpr;

type Statement = Expr | JumpStatement | IfStatement | WhileStatement | ForStatement | CompoundStatement;

type JumpStatement = ReturnStatement | BreakStatement | ContinueStatement;

interface ReturnStatement
{
  expr : Expr;
};

interface BreakStatement
{
};

interface ContinueStatement
{
};

interface CompoundStatement
{
  statements : Statement[];
};

interface IfStatement
{
  condition : Expr | null;
  statement : Statement;
  elseStatement : Statement | null;
};

interface WhileStatement
{
  condition : Expr | null;
  statement : Statement;
};

interface ForStatement
{
  init : Statement | null;
  condition : Expr | null;
  afterthought : Statement | null;
  statement : Statement;
};

let nonZeroDigits = "123456789";
let digits = "0" + nonZeroDigits;
let nonDigitIdentCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";
let identCharacters = digits + nonDigitIdentCharacters;
let keywords = ["var", "true", "false", "nil", "function", "if", "else", "for", "while", "return", "break", "continue"];

function lexeme<T>(parser : p.Parser<T>) : p.Parser<T>
{
  return p.discardLeft(p.skipWhitespace(), parser);
};

function keyword(word : string) : p.Parser<string>
{
  return lexeme(p.string(word));
};

let escapedCharacter = p.discardLeft(p.char("\\"), p.oneOf("\\\""));
let nonescapedCharacter = p.noneOf("\\\"");
let character = p.either(nonescapedCharacter, escapedCharacter);
let characters = p.many(character, "", (s, c) => s + c);
let quotedString = p.enclosed(p.char("\""), characters, p.char("\""));

function asDigit(digit : string) : number
{
  return digit.charCodeAt(0) - "0".charCodeAt(0);
};

function accumulateDigits(acc : number, digit : string) : number
{
  return acc * 10 + asDigit(digit);
};

let integralWithLeadZeroes = p.many1(p.oneOf(digits), 0, accumulateDigits);
let integralWithoutLeadZeroes = p.bind(p.oneOf(nonZeroDigits),
  (digit : string, input : StringView) =>
  {
    return p.many(p.oneOf(digits),
      asDigit(digit),
      accumulateDigits
    )(input);
  }
);
let negativeSign = p.option("+", p.char("-"));
let integralPart = p.combine(negativeSign, p.either(p.fmap(() => 0, p.char("0")), integralWithoutLeadZeroes), (sign, i) => sign === "+" ? i : -i);
let fractionalPart = p.discardLeft(p.char("."), integralWithLeadZeroes);
let mantissa = p.combine(integralPart, p.option(0, fractionalPart), (i, f) =>
{
  let d = 0;
  while (f > 0)
  {
    d += f % 10;
    d /= 10;
    f = Math.floor(f / 10);
  }
  return i + d;
});
let exponent = p.bind(p.discardLeft(p.oneOf("eE"), p.either(p.char("+"), negativeSign)),
  (sign, input) =>
  {
    return p.fmap(
      (i) => sign === "+" ? i : -i,
      integralWithLeadZeroes
    )(input);
  }
);
let decimalNumber = p.combine(mantissa, p.option(0, exponent), (m, e) => m * Math.pow(10, e));

let openParen = lexeme(p.char("("));
let closeParen = lexeme(p.char(")"));
let openBracket = lexeme(p.char("["));
let closeBracket = lexeme(p.char("]"));
let openBrace = lexeme(p.char("{"));
let closeBrace = lexeme(p.char("}"));
let dotOp = lexeme(p.char("."));
let comma = lexeme(p.char(","));
let semicolon = lexeme(p.char(";"));
let unaryOp = lexeme(p.oneOf("+-!"));
let multiplicationOp = lexeme(p.oneOf("/*%"));
let additionOp = lexeme(p.oneOf("+-"));
let relationOp = lexeme(p.either(p.oneOf("<>"), p.string(">="), p.string("<=")));
let equalityOp = lexeme(p.either(p.string("=="), p.string("!=")));
let xorOp = lexeme(p.char("^"));
let andOp = lexeme(p.string("&&"));
let orOp = lexeme(p.string("||"));
let assignmentOp = lexeme(p.either(p.char("="), p.string("*="), p.string("/="), p.string("%="), p.string("+="), p.string("-=")));

let nilLiteral = p.fmap(() : Literal => { return { value : null }; }, keyword("nil"));
let booleanLiteral = p.either(p.fmap(() : Literal => { return { value : true }; }, keyword("true")), p.fmap(() => { return { value : false }; }, keyword("false")));
let numberLiteral = p.fmap((v : number) : Literal => { return { value : v }; }, lexeme(decimalNumber));
let stringLiteral = p.fmap((s : string) : Literal => { return { value : s }; }, lexeme(quotedString));

function separatedBy<V, S>(parser : p.Parser<V>, separator : p.Parser<S>) : p.Parser<V[]>
{
  return p.bind(parser, (first : V, input : StringView) => { return p.many(p.discardLeft(separator, parser), [first], (acc, v) => acc.concat([v]))(input); });
};

let exprImpl : { parser : p.Parser<Expr> } = { parser : null };
let expr = (input : StringView) : p.ParseResult<Expr> => { return exprImpl.parser(input); };

let literal = p.either(stringLiteral, numberLiteral, booleanLiteral, nilLiteral);
let validName = lexeme(p.bind(p.oneOf(nonDigitIdentCharacters), (leadChar : string, input : StringView) =>
{
  return p.many(p.oneOf(identCharacters), leadChar, (s, r) => s + r)(input);
}));
let identifier = p.fmap((s : string) : Ident => { return { name : s }; }, p.bind(validName, (name : string, input : StringView) => keywords.find((e) => e === name) ? null : new p.ParseInfo<string>(name, input)));
let primaryExpr = p.either(literal, identifier, p.enclosed(openParen, expr, closeParen));
let bracketAccess = p.fmap((e : Expr) : BracketAccess => { return { index : e }; }, p.enclosed(openBracket, expr, closeBracket));
let dotAccess = p.fmap((i : Ident) : DotAccess => { return { index : i }; }, p.discardLeft(dotOp, identifier));
let exprList = separatedBy(expr, comma);
let functionCall = p.fmap((args : Expr[]) : FuncCall => { return { args : args }; }, p.enclosed(openParen, exprList, closeParen));
let postfix = p.either(p.fmap((v) : PostFixOp => v, bracketAccess), p.fmap((v) : PostFixOp => v, dotAccess), p.fmap((v) : PostFixOp => v, functionCall));
let postfixExpr = p.combine(primaryExpr, p.many(postfix, [], (acc, op) => acc.concat({ op : op, lhs : null })), (expr, ops) : Expr =>
{
  let result = expr;
  for (let op of ops)
  {
    op.lhs = result;
    result = op;
  }
  return result;
});

let unaryExprImpl : { parser : p.Parser<Expr> } = { parser : null };
let unaryExpr = (input : StringView) : p.ParseResult<Expr> => { return unaryExprImpl.parser(input); };
unaryExprImpl.parser = p.either(p.combine(unaryOp, unaryExpr, (op, expr) => { return { op : op, rhs : expr }; }), postfixExpr);

function binaryExpr(expr : p.Parser<Expr>, op : p.Parser<string>) : p.Parser<Expr>
{
  return p.bind(expr, (first : Expr, input : StringView) =>
  {
    return p.many(p.combine(op, expr, (o, e) : [string, Expr] => [o, e]), first, (acc, elem) =>
    {
      let [op, expr] = elem;
      return { op : op, lhs : acc, rhs : expr } as BinaryExpr;
    })(input);
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

let assignment = p.combine(p.either(postfixExpr, p.discardLeft(keyword("var"), identifier)), p.option(null, p.combine(assignmentOp, expr, (o, e) : [string, Expr] => [o, e])), (lhs, rhs) =>
{
  if (!rhs)
    return lhs;

  let [op, expr] = rhs;
  return { op : op, lhs : lhs, rhs : expr };
});

let stmtImpl : { parser : p.Parser<Statement> } = { parser : null };
let statement = (input : StringView) : p.ParseResult<Statement> => { return stmtImpl.parser(input); };
let breakStmt = p.fmap(() : BreakStatement => { return {}; }, p.discardRight(keyword("break"), semicolon));
let continueStmt = p.fmap(() : ContinueStatement => { return {}; }, p.discardRight(keyword("continue"), semicolon));
let returnStmt = p.fmap((e) : ReturnStatement => { return { expr : e }; }, p.discardRight(p.discardLeft(keyword("return"), expr), semicolon));
let jumpStmt = p.either(p.fmap((v) : JumpStatement => v, breakStmt), p.fmap((v) : JumpStatement => v, continueStmt), p.fmap((v) : JumpStatement => v, returnStmt));
let statements =  p.many(statement, [], (acc, r) => acc.concat([r]));
let compoundStatement = p.enclosed(openBrace, statements, closeBrace);
let ifStatement = p.combine(
  p.combine(
    p.discardLeft(keyword("if"), p.enclosed(openParen, expr, closeParen)),
    statement,
    (cond, stmt) =>
    {
      return { condition : cond, statement : stmt };
    }
  ),
  p.option(null, p.discardLeft(keyword("else"), statement)),
  (ifStmt, elseStmt) : IfStatement =>
  {
    return { condition : ifStmt.condition, statement : ifStmt.statement, elseStatement : elseStmt };
  }
);
let whileStatement = p.combine(p.discardLeft(keyword("while"), p.enclosed(openParen, expr, closeParen)), statement, (cond, stmt) : WhileStatement => { return { condition : cond, statement : stmt }; });
let forSpec = p.combine(
  p.combine(
    p.discardRight(p.option(null, assignment), semicolon),
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
let forStatement = p.combine(p.discardLeft(keyword("for"), p.enclosed(openParen, forSpec, closeParen)), statement, (forSpec, stmt) : ForStatement =>
{
  return { init : forSpec.init, condition : forSpec.cond, afterthought : forSpec.after, statement : stmt };
});
stmtImpl.parser = p.either(semicolon, p.discardRight(expr, semicolon), p.discardRight(assignment, semicolon), compoundStatement, jumpStmt, ifStatement, whileStatement, forStatement);

let program = p.discardRight(statements, p.discardRight(p.skipWhitespace(), p.end()));

export function parseQuotedString(input : string) : string | null
{
  let result = quotedString(new StringView(input));
  return result === null
    ? null
    : result.output;
};

export function parseNumber(input : string) : number | null
{
  let result = decimalNumber(new StringView(input));
  return result === null
    ? null
    : result.output;
};

export function parseProgram(input : string) : Statement[] | null
{
  let result = program(new StringView(input));
  return result === null
    ? null
    : result.output;
};