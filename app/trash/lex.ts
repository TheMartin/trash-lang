import * as p from "../parser/parser";
import { StringView, Position } from "../stringView/stringView";

export enum TokenType
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
  constructor(public type : TokenType, public pos : Position, public value : string | number | boolean | null = null) {}
};

let nonZeroDigits = "123456789";
let digits = "0" + nonZeroDigits;
let nonDigitIdentCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";
let identCharacters = digits + nonDigitIdentCharacters;

let oneLineComment = p.discardLeft(p.string("//"), p.many(p.noneOf("\n\r"), null, () => null));
let multiLineComment = p.enclosed(p.string("/*"), p.many(p.not("*/"), null, () => null), p.string("*/"));
let skipWhitespaceAndComments = p.many(p.try_(p.either(oneLineComment, multiLineComment, p.char(" "), p.char("\t"), p.char("\r"), p.char("\n"))), null, () => null);

function lexeme(parser : p.Parser<string | number>, type : TokenType, value? : string | number | boolean | null) : p.Parser<Token>
{
  return p.discardLeft(skipWhitespaceAndComments, p.fmap((t) => new Token(type, t.first as Position, value !== undefined ? value : t.second), p.positional(parser)));
};

function keyword(word : string, type : TokenType, value? : string | number | boolean | null) : p.Parser<Token>
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
  lexeme(quotedString, TokenType.String),
  lexeme(decimalNumber, TokenType.Number),
  keyword("if", TokenType.If),
  keyword("else", TokenType.Else),
  keyword("for", TokenType.For),
  keyword("while", TokenType.While),
  keyword("return", TokenType.Return),
  keyword("break", TokenType.Break),
  keyword("continue", TokenType.Continue),
  keyword("var", TokenType.Var),
  keyword("function", TokenType.Function),
  keyword("nil", TokenType.Nil, null),
  keyword("false", TokenType.False, false),
  keyword("true", TokenType.True, true),
  lexeme(validName, TokenType.Identifier),
  keyword("&&", TokenType.DoubleAmpersand),
  keyword("||", TokenType.DoublePipe),
  keyword("!=", TokenType.BangEqual),
  keyword("==", TokenType.EqualEqual),
  keyword(">=", TokenType.GreaterEqual),
  keyword("<=", TokenType.LessEqual),
  keyword("+=", TokenType.PlusEqual),
  keyword("-=", TokenType.MinusEqual),
  keyword("*=", TokenType.StarEqual),
  keyword("/=", TokenType.SlashEqual),
  keyword("%=", TokenType.PercentEqual),
  keyword("(", TokenType.LeftParen),
  keyword(")", TokenType.RightParen),
  keyword("[", TokenType.LeftBracket),
  keyword("]", TokenType.RightBracket),
  keyword("{", TokenType.LeftBrace),
  keyword("}", TokenType.RightBrace),
  keyword(",", TokenType.Comma),
  keyword(".", TokenType.Dot),
  keyword(":", TokenType.Colon),
  keyword(";", TokenType.Semicolon),
  keyword("-", TokenType.Minus),
  keyword("+", TokenType.Plus),
  keyword("/", TokenType.Slash),
  keyword("*", TokenType.Star),
  keyword("%", TokenType.Percent),
  keyword("^", TokenType.Caret),
  keyword("!", TokenType.Bang),
  keyword("=", TokenType.Equal),
  keyword(">", TokenType.Greater),
  keyword("<", TokenType.Less)
);

let tokens = p.bind(
  p.many(token, [], (acc, t) => acc.concat([t])),
  (tokens : Token[], rest : p.ParserInput) => new p.ParseInfo([...tokens, new Token(TokenType.Eof, rest.pos() as Position)], rest, false)
);

export function tokenize(input : string) : Token[]
{
  let result = tokens(new StringView(input));
  return p.isError(result)
    ? null
    : result.output;
}