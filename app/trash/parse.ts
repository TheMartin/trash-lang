import * as p from "../parser/parser";
import * as ast from "../trash/ast";
import { StringView } from "../stringView/stringView";

let nonZeroDigits = "123456789";
let digits = "0" + nonZeroDigits;
let nonDigitIdentCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";
let identCharacters = digits + nonDigitIdentCharacters;
let keywords = ["var", "true", "false", "nil", "function", "if", "else", "for", "while", "return", "break", "continue"];

let oneLineComment = p.discardLeft(p.string("//"), p.many(p.noneOf("\n\r"), null, () => null));
let multiLineComment = p.enclosed(p.string("/*"), p.many(p.not("*/"), null, () => null), p.string("*/"));
let skipWhitespaceAndComments = p.many(p.either(oneLineComment, multiLineComment, p.char(" "), p.char("\t"), p.char("\r"), p.char("\n")), null, () => null);

function lexeme<T>(parser : p.Parser<T>) : p.Parser<T>
{
  return p.discardLeft(skipWhitespaceAndComments, parser);
};

function keyword(word : string) : p.Parser<string>
{
  return lexeme(p.string(word));
};

function list<V, S>(parser : p.Parser<V>, separator : p.Parser<S>) : p.Parser<V[]>
{
  return p.separatedBy(parser, separator, [], (acc, v) => acc.concat([v]));
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
let colon = lexeme(p.char(":"));
let eof = lexeme(p.end());

function op(opType : ast.Op, opString : string) : p.Parser<ast.Op>
{
  return p.fmap(() => opType, lexeme(p.string(opString)));
}

let unaryOp = p.either(op(ast.Op.UnaryPlus, "+"), op(ast.Op.UnaryMinus, "-"), op(ast.Op.Not, "!"));
let multiplicationOp = p.either(op(ast.Op.Times, "*"), op(ast.Op.Divide, "/"), op(ast.Op.Modulo, "%"));
let additionOp = p.either(op(ast.Op.Plus, "+"), op(ast.Op.Minus, "-"));
let relationOp = p.either(op(ast.Op.GreaterOrEqual, ">="), op(ast.Op.LessOrEqual, "<="), op(ast.Op.GreaterThan, ">"), op(ast.Op.LessThan, "<"));
let equalityOp = p.either(op(ast.Op.Equal, "=="), op(ast.Op.NotEqual, "!="));
let xorOp = op(ast.Op.ExclusiveOr, "^");
let andOp = op(ast.Op.And, "&&");
let orOp = op(ast.Op.Or, "||");
let setOp = op(ast.Op.Assign, "=");
let assignmentOp = p.either(setOp, op(ast.Op.PlusAssign, "+="), op(ast.Op.MinusAssign, "-="), op(ast.Op.TimesAssign, "*="), op(ast.Op.DivideAssign, "/="), op(ast.Op.ModuloAssign, "%="));

let validName = lexeme(p.bind(p.oneOf(nonDigitIdentCharacters), (leadChar : string, input : StringView) =>
{
  return p.many(p.oneOf(identCharacters), leadChar, (s, r) => s + r)(input);
}));
let identifier = p.fmap((s : string) => new ast.Ident(s), p.bind(validName, (name : string, input : StringView) => keywords.find((e) => e === name) ? null : new p.ParseInfo<string>(name, input)));

let exprImpl : { parser : p.Parser<ast.Expr> } = { parser : null };
let expr = (input : StringView) : p.ParseResult<ast.Expr> => { return exprImpl.parser(input); };
let stmtImpl : { parser : p.Parser<ast.Statement> } = { parser : null };
let statement = (input : StringView) : p.ParseResult<ast.Statement> => { return stmtImpl.parser(input); };
let statements =  p.many(statement, [], (acc, r) => r instanceof ast.EmptyStatement ? acc :  acc.concat([r]));
let block = p.fmap((stmts) => new ast.Block(stmts), p.enclosed(openBrace, statements, closeBrace));

let nilLiteral = p.fmap(() => new ast.Literal(null), keyword("nil"));
let booleanLiteral = p.either(p.fmap(() => new ast.Literal(true), keyword("true")), p.fmap(() => new ast.Literal(false), keyword("false")));
let numberLiteral = p.fmap((v : number) => new ast.Literal(v), lexeme(decimalNumber));
let stringLiteral = p.fmap((s : string) => new ast.Literal(s), lexeme(quotedString));

let keyValuePair = p.combine(p.either(identifier, p.enclosed(openBracket, expr, closeBracket)), p.discardLeft(colon, expr), (k, v) => { return { key : k, value : v }; });
let objectLiteral = p.fmap((kvs) => new ast.Literal(new ast.ObjectDef(kvs)), p.enclosed(openBrace, list(keyValuePair, comma), closeBrace));

let functionLiteral = p.combine(
  p.discardLeft(keyword("function"), p.enclosed(openParen, list(identifier, comma), closeParen)),
  block,
  (args, body) => new ast.Literal(new ast.FunctionDef(args, body))
);

let literal = p.either(stringLiteral, numberLiteral, booleanLiteral, nilLiteral, objectLiteral, functionLiteral);
let primaryExpr = p.either(literal, identifier, p.enclosed(openParen, expr, closeParen));
let bracketAccess = p.fmap((e : ast.Expr) => new ast.BracketAccess(e), p.enclosed(openBracket, expr, closeBracket));
let dotAccess = p.fmap((i : ast.Ident) => new ast.DotAccess(i), p.discardLeft(dotOp, identifier));
let functionCall = p.fmap((args : ast.Expr[]) => new ast.FunctionCall(args), p.enclosed(openParen, list(expr, comma), closeParen));
let postfix = p.either(p.fmap((v) => v as ast.PostFixOp, bracketAccess), p.fmap((v) => v as ast.PostFixOp, dotAccess), p.fmap((v) => v as ast.PostFixOp, functionCall));
let postfixExpr = p.combine(primaryExpr, p.many(postfix, [], (acc, op) => acc.concat([op])), (expr, ops) : ast.Expr =>
{
  let result = expr;
  for (let op of ops)
  {
    result = new ast.PostFixExpr(op, result);
  }
  return result;
});

let unaryExprImpl : { parser : p.Parser<ast.Expr> } = { parser : null };
let unaryExpr = (input : StringView) : p.ParseResult<ast.Expr> => { return unaryExprImpl.parser(input); };
unaryExprImpl.parser = p.either(p.combine(unaryOp, unaryExpr, (op, expr) => new ast.UnaryExpr(op, expr)), postfixExpr);

function binaryExpr(expr : p.Parser<ast.Expr>, op : p.Parser<ast.Op>) : p.Parser<ast.Expr>
{
  return p.bind(expr, (first : ast.Expr, input : StringView) =>
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
  (lhs, rhs) => new ast.BinaryExpr(rhs.op, lhs, rhs.expr)
);

let declaration = p.combine(
  p.discardLeft(keyword("var"), identifier),
  p.discardLeft(setOp, expr),
  (name, init) => new ast.VarDeclaration(name, init)
);

let breakStmt = p.fmap(() => new ast.BreakStatement(), p.discardRight(keyword("break"), semicolon));
let continueStmt = p.fmap(() => new ast.ContinueStatement(), p.discardRight(keyword("continue"), semicolon));
let returnStmt = p.fmap((e) => new ast.ReturnStatement(e), p.discardRight(p.discardLeft(keyword("return"), expr), semicolon));
let jumpStmt = p.either(p.fmap((v) => v as ast.JumpStatement, breakStmt), p.fmap((v) => v as ast.JumpStatement, continueStmt), p.fmap((v) => v as ast.JumpStatement, returnStmt));
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
  (ifStmt, elseStmt) => new ast.IfStatement(ifStmt.condition, ifStmt.statement, elseStmt)
);
let whileStatement = p.combine(p.discardLeft(keyword("while"), p.enclosed(openParen, expr, closeParen)), statement, (cond, stmt) => new ast.WhileStatement(cond, stmt));
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
let forStatement = p.combine(p.discardLeft(keyword("for"), p.enclosed(openParen, forSpec, closeParen)), statement, (forSpec, stmt) => new ast.ForStatement(forSpec.init, forSpec.cond, forSpec.after, stmt));
stmtImpl.parser = p.either(p.fmap(() => new ast.EmptyStatement(), semicolon), p.discardRight(declaration, semicolon), p.discardRight(expr, semicolon), p.discardRight(assignment, semicolon), block, jumpStmt, ifStatement, whileStatement, forStatement);

let program = p.fmap((stmts) => new ast.Block(stmts), p.discardRight(statements, eof));

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

export function parseProgram(input : string) : ast.Block | null
{
  let result = program(new StringView(input));
  return result === null
    ? null
    : result.output;
};