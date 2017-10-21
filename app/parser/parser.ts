import { StringView } from "../stringView/stringView";

export class ParseInfo<T>
{
  constructor(public output : T, public rest : StringView)
  {
    console.log(output, rest.start);
  }
};

export type ParseResult<T> = ParseInfo<T> | null;

export interface Parser<T>
{
  (input : StringView) : ParseResult<T>;
};

export function fmap<T, U>(fn : (t : T) => U, parser : Parser<T>) : Parser<U>
{
  return (input : StringView) : ParseResult<U> =>
  {
    const result = parser(input);
    return result === null
      ? null
      : new ParseInfo<U>(fn(result.output), result.rest);
  };
};

export function bind<T, U>(parser : Parser<T>, fn : (output : T, rest : StringView) => ParseResult<U>) : Parser<U>
{
  return (input : StringView) : ParseResult<U> =>
  {
    const result = parser(input);
    return result === null
      ? null
      : fn(result.output, result.rest);
  };
};

export function lift<T>(t : T) : Parser<T>
{
  return (input : StringView) : ParseResult<T> => new ParseInfo<T>(t, input);
};

export function fail<T>() : Parser<T>
{
  return () : ParseResult<T> => null;
};

export function end() : Parser<null>
{
  return (input : StringView) : ParseResult<null> =>
  {
    return input.empty()
      ? new ParseInfo<null>(null, input)
      : null;
  };
};

export function discardLeft<T1, T2>(left : Parser<T1>, right : Parser<T2>) : Parser<T2>
{
  return combine(left, right, (_, r) => r);
};

export function discardRight<T1, T2>(left : Parser<T1>, right : Parser<T2>) : Parser<T1>
{
  return combine(left, right, (r, _) => r);
};

export function enclosed<T1, T2, U>(left : Parser<T1>, parser : Parser<U>, right : Parser<T2>) : Parser<U>
{
  return discardLeft(left, discardRight(parser, right));
};

export function either<T>(...parsers : Parser<T>[]) : Parser<T>
{
  return (input : StringView) : ParseResult<T> =>
  {
    for (let parser of parsers)
    {
      let result = parser(input);
      if (result !== null)
        return result;
    }

    return null;
  };
};

export function combine<T1, T2, U>(parser1 : Parser<T1>, parser2 : Parser<T2>, fn : (t1 : T1, t2 : T2) => U) : Parser<U>
{
  return (input : StringView) : ParseResult<U> =>
  {
    let result1 = parser1(input);
    if (result1 === null)
      return null;

    let result2 = parser2(result1.rest);
    if (result2 === null)
      return null;

    return new ParseInfo<U>(fn(result1.output, result2.output), result2.rest);
  };
};

function parseRepeated<T, U>(input : StringView, parser : Parser<T>, init : U, fn : (acc : U, value : T) => U) : ParseInfo<U>
{
  while (!input.empty())
  {
    let result = parser(input);
    if (result === null)
      return new ParseInfo<U>(init, input);

    init = fn(init, result.output);
    input = result.rest;
  }
  return new ParseInfo<U>(init, input);
};

export function option<T>(def : T, parser : Parser<T>) : Parser<T>
{
  return (input : StringView) : ParseResult<T> =>
  {
    let result = parser(input);
    return result === null
      ? new ParseInfo<T>(def, input)
      : result;
  };
};

export function many<T, U>(parser : Parser<T>, init : U, fn : (acc : U, value : T) => U) : Parser<U>
{
  return (input : StringView) : ParseResult<U> => parseRepeated(input, parser, init, fn);
};

export function many1<T, U>(parser : Parser<T>, init : U, fn : (acc : U, value : T) => U) : Parser<U>
{
  return (input : StringView) : ParseResult<U> =>
  {
    let result = parser(input);
    return result === null
      ? null
      : parseRepeated(result.rest, parser, fn(init, result.output), fn);
  };
};

export function char(c : string) : Parser<string>
{
  return (input : StringView) : ParseResult<string> =>
  {
    return (input.empty() || input.get(0) !== c)
      ? null
      : new ParseInfo<string>(c, input.sub(1))
  };
};

export function oneOf(chars : string) : Parser<string>
{
  return (input : StringView) : ParseResult<string> =>
  {
    if (input.empty())
      return null;

    for (let c of chars)
    {
      if (input.get(0) === c)
        return new ParseInfo<string>(c, input.sub(1));
    }

    return null;
  };
};

export function noneOf(chars : string) : Parser<string>
{
  return (input : StringView) : ParseResult<string> =>
  {
    if (input.empty())
      return null;

    for (let c of chars)
    {
      if (input.get(0) === c)
        return null;
    }

    return new ParseInfo<string>(input.get(0), input.sub(1));
  };
};

export function string(s : string) : Parser<string>
{
  return (input : StringView) : ParseResult<string> =>
  {
    return input.val.substr(input.start, s.length) === s
      ? new ParseInfo<string>(s, input.sub(s.length))
      : null;
  };
};

export function skipWhitespace() : Parser<null>
{
  return many(
    either(
      char(" "),
      char("\t"),
      char("\n"),
      char("\r")
    ),
    null,
    () => null
  );
};