import * as p from "../parser/parser";
import { StringView } from "../stringView/stringView";

function discardLeft<T1, T2>(left : p.Parser<T1>, right : p.Parser<T2>) : p.Parser<T2>
{
  return p.combine(left, right, (_, r) => r);
};

function discardRight<T1, T2>(left : p.Parser<T1>, right : p.Parser<T2>) : p.Parser<T1>
{
  return p.combine(left, right, (r, _) => r);
};

let escapedCharacter = discardLeft(p.char("\\"), p.oneOf("\\\""));
let nonescapedCharacter = p.noneOf("\\\"");
let character = p.either(nonescapedCharacter, escapedCharacter);
let characters = p.many(character, "", (s, c) => s + c);
let quotedString = discardLeft(p.char("\""), discardRight(characters, p.char("\"")));

function asDigit(digit : string) : number
{
  return digit.charCodeAt(0) - "0".charCodeAt(0);
};

function accumulateDigits(acc : number, digit : string) : number
{
  return acc * 10 + asDigit(digit);
};

let integralWithLeadZeroes = p.many1(p.oneOf("0123456789"), 0, accumulateDigits);
let integralWithoutLeadZeroes = p.bind(p.oneOf("123456789"),
  (digit : string, input : StringView) =>
  {
    return p.many(p.oneOf("0123456789"),
      asDigit(digit),
      accumulateDigits
    )(input);
  }
);
let negativeSign = p.option("+", p.char("-"));
let integralPart = p.combine(negativeSign, p.either(p.fmap(() => 0, p.char("0")), integralWithoutLeadZeroes), (sign, i) => sign === "+" ? i : -i);
let fractionalPart = discardLeft(p.char("."), integralWithLeadZeroes);
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
let exponent = p.bind(discardLeft(p.oneOf("eE"), p.either(p.char("+"), negativeSign)),
  (sign, input) =>
  {
    return p.fmap(
      (i) => sign === "+" ? i : -i,
      integralWithLeadZeroes
    )(input);
  }
);
let numberLiteral = p.combine(mantissa, p.option(0, exponent), (m, e) => m * Math.pow(10, e));

export function parseQuotedString(input : string) : string | null
{
  let result = quotedString(new StringView(input));
  return result === null
    ? null
    : result.output;
};

export function parseNumber(input : string) : number | null
{
  let result = numberLiteral(new StringView(input));
  return result === null
    ? null
    : result.output;
};