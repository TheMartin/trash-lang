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

type Expr = Literal | Ident | UnaryExpr | BinaryExpr | PostFixExpr | VarDecl;

let nonZeroDigits = "123456789";
let digits = "0" + nonZeroDigits;
let nonDigitIdentCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";
let identCharacters = digits + nonDigitIdentCharacters;

function lexeme<T>(parser : p.Parser<T>) : p.Parser<T>
{
  return p.discardLeft(p.skipWhitespace(), parser);
};

let escapedCharacter = p.discardLeft(p.char("\\"), p.oneOf("\\\""));
let nonescapedCharacter = p.noneOf("\\\"");
let character = p.either(nonescapedCharacter, escapedCharacter);
let characters = p.many(character, "", (s, c) => s + c);
let quotedString = p.discardLeft(p.char("\""), p.discardRight(characters, p.char("\"")));

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
let dotOp = lexeme(p.char("."));
let comma = lexeme(p.char(","));
let unaryOp = lexeme(p.oneOf("+-!"));
let multiplicationOp = lexeme(p.oneOf("/*%"));
let additionOp = lexeme(p.oneOf("+-"));
let relationOp = lexeme(p.either(p.oneOf("<>"), p.string(">="), p.string("<=")));
let equalityOp = lexeme(p.either(p.string("=="), p.string("!=")));
let xorOp = lexeme(p.char("^"));
let andOp = lexeme(p.string("&&"));
let orOp = lexeme(p.string("||"));
let assignmentOp = lexeme(p.either(p.char("="), p.string("*="), p.string("/="), p.string("%="), p.string("+="), p.string("-=")));

let nilLiteral = p.fmap(() : Literal => { return { value : null }; }, lexeme(p.string("nil")));
let booleanLiteral = p.either(p.fmap(() : Literal => { return { value : true }; }, lexeme(p.string("true"))), p.fmap(() => { return { value : false }; }, lexeme(p.string("false"))));
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
let identifier = p.fmap((s : string) : Ident => { return { name : s }; }, validName);
let primaryExpr = p.either(literal, identifier, p.discardLeft(lexeme(p.string("var")), identifier), p.discardLeft(openParen, p.discardRight(expr, closeParen)));
let bracketAccess = p.fmap((e : Expr) : BracketAccess => { return { index : e }; }, p.discardLeft(openBracket, p.discardRight(expr, closeBracket)));
let dotAccess = p.fmap((i : Ident) : DotAccess => { return { index : i }; }, p.discardLeft(dotOp, identifier));
let exprList = separatedBy(expr, comma);
let functionCall = p.fmap((args : Expr[]) : FuncCall => { return { args : args }; }, p.discardLeft(openParen, p.discardRight(exprList, closeParen)));
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
let assignmentExpr = p.combine(orExpr, p.option(null, p.combine(assignmentOp, orExpr, (o, e) : [string, Expr] => [o, e])), (lhs, rhs) =>
{
  if (!rhs)
    return lhs;

  let [op, expr] = rhs;
  return { op : op, lhs : lhs, rhs : expr };
});
exprImpl.parser = assignmentExpr;

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

export function parseExpression(input : string) : boolean
{
  return expr(new StringView(input)) !== null;
};