import * as p from "../parser/parser";
import { StringView, Position } from "../stringView/stringView";

export enum Type
{
  LeftParen, RightParen, LeftBracket, RightBracket, LeftBrace, RightBrace,
  Comma, Dot, Colon, Semicolon, Minus, Plus, Slash, Star, Percent,
  DoubleAmpersand, DoublePipe, Caret,
  Bang, BangEqual,
  Equal, EqualEqual,
  Greater, GreaterEqual,
  Less, LessEqual,
  PlusEqual, MinusEqual,
  StarEqual, SlashEqual, PercentEqual,

  Identifier, String, Number,

  If, Else, For, While, Return, Break, Continue, Var, Function, Nil, False, True,
  Eof
};

export class Token
{
  constructor(public type : Type, public pos : Position, public value : string | number | boolean | null = null) {}
};

let nonZeroDigits = "123456789";
let digits = "0" + nonZeroDigits;
let nonDigitIdentCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";
let identCharacters = digits + nonDigitIdentCharacters;

let oneLineComment = p.discardLeft(p.string("//"), p.many(p.noneOf("\n\r"), null, () => null));
let multiLineComment = p.enclosed(p.string("/*"), p.many(p.not("*/"), null, () => null), p.string("*/"));
let skipWhitespaceAndComments = p.many(p.try_(p.either(oneLineComment, multiLineComment, p.char(" "), p.char("\t"), p.char("\r"), p.char("\n"))), null, () => null);

function lexeme(parser : p.Parser<string | number>, type : Type, value? : string | number | boolean | null) : p.Parser<Token>
{
  return p.discardLeft(skipWhitespaceAndComments, p.fmap((t) => new Token(type, t.first as Position, value !== undefined ? value : t.second), p.positional(parser)));
};

function keyword(word : string, type : Type, value? : string | number | boolean | null) : p.Parser<Token>
{
  return lexeme(p.string(word), type, value);
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

let validName = p.bind(p.oneOf(nonDigitIdentCharacters), (leadChar : string, input : StringView) =>
{
  return p.many(p.oneOf(identCharacters), leadChar, (s, r) => s + r)(input);
});

let token = p.either(
  lexeme(quotedString, Type.String),
  lexeme(decimalNumber, Type.Number),
  keyword("if", Type.If),
  keyword("else", Type.Else),
  keyword("for", Type.For),
  keyword("while", Type.While),
  keyword("return", Type.Return),
  keyword("break", Type.Break),
  keyword("continue", Type.Continue),
  keyword("var", Type.Var),
  keyword("function", Type.Function),
  keyword("nil", Type.Nil, null),
  keyword("false", Type.False, false),
  keyword("true", Type.True, true),
  lexeme(validName, Type.Identifier),
  keyword("&&", Type.DoubleAmpersand),
  keyword("||", Type.DoublePipe),
  keyword("!=", Type.BangEqual),
  keyword("==", Type.EqualEqual),
  keyword(">=", Type.GreaterEqual),
  keyword("<=", Type.LessEqual),
  keyword("+=", Type.PlusEqual),
  keyword("-=", Type.MinusEqual),
  keyword("*=", Type.StarEqual),
  keyword("/=", Type.SlashEqual),
  keyword("%=", Type.PercentEqual),
  keyword("(", Type.LeftParen),
  keyword(")", Type.RightParen),
  keyword("[", Type.LeftBracket),
  keyword("]", Type.RightBracket),
  keyword("{", Type.LeftBrace),
  keyword("}", Type.RightBrace),
  keyword(",", Type.Comma),
  keyword(".", Type.Dot),
  keyword(":", Type.Colon),
  keyword(";", Type.Semicolon),
  keyword("-", Type.Minus),
  keyword("+", Type.Plus),
  keyword("/", Type.Slash),
  keyword("*", Type.Star),
  keyword("%", Type.Percent),
  keyword("^", Type.Caret),
  keyword("!", Type.Bang),
  keyword("=", Type.Equal),
  keyword(">", Type.Greater),
  keyword("<", Type.Less)
);

let tokens = p.bind(
  p.many(token, [], (acc, t) => acc.concat([t])),
  (tokens : Token[], rest : p.ParserInput) => new p.ParseInfo([...tokens, new Token(Type.Eof, rest.pos() as Position)], rest, false)
);

export function tokenize(input : string) : Token[]
{
  let result = tokens(new StringView(input));
  return p.isError(result)
    ? null
    : result.output;
}