import { StringView } from "../stringView/stringView";

export class Pair<T1, T2>
{
  constructor(public first : T1, public second : T2) {}
};

export interface ParserInput
{
  empty() : boolean;
  pos() : Position;
};

export interface Position
{
  furtherThan(other : Position) : boolean;
};

export class ParseInfo<T>
{
  constructor(public output : T, public rest : ParserInput, public consumedInput : boolean, public failedAlternative? : ErrorInfo)
  {
    //console.log(output, rest);
  }
};

export class ErrorInfo
{
  constructor(public pos : Position, public consumedInput : boolean, public expectations : string[], public message : string, public context? : string)
  {
    //console.log(message, expectations, context, pos);
  }
};

export type ParseResult<T> = ParseInfo<T> | ErrorInfo;

function quoted(char : string) : string
{
  return "'" + char + "'";
};

export function isError<T>(result : ParseResult<T>): result is ErrorInfo
{
  return (result as ErrorInfo).message !== undefined;
};

export interface Parser<T>
{
  (input : ParserInput) : ParseResult<T>;
};

export function fmap<T, U>(fn : (t : T) => U, parser : Parser<T>) : Parser<U>
{
  return (input : ParserInput) : ParseResult<U> =>
  {
    const result = parser(input);
    return isError(result)
      ? result
      : new ParseInfo<U>(fn(result.output), result.rest, result.consumedInput);
  };
};

export function bind<T, U>(parser : Parser<T>, fn : (output : T, rest : ParserInput) => ParseResult<U>) : Parser<U>
{
  return (input : ParserInput) : ParseResult<U> =>
  {
    const result = parser(input);
    return isError(result)
      ? result
      : fn(result.output, result.rest);
  };
};

export function lift<T>(t : T) : Parser<T>
{
  return (input : ParserInput) : ParseResult<T> => new ParseInfo<T>(t, input, false);
};

export function fail<T>(message : string) : Parser<T>
{
  return (input : ParserInput) : ParseResult<T> => new ErrorInfo(input.pos(), false, [], message);
};

export function end() : Parser<null>
{
  return (input : ParserInput) : ParseResult<null> =>
  {
    return input.empty()
      ? new ParseInfo<null>(null, input, true)
      : new ErrorInfo(input.pos(), false, ["end of input"], "unexpected");
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

export function try_<T>(parser : Parser<T>) : Parser<T>
{
  return (input : ParserInput) : ParseResult<T> =>
  {
    let result = parser(input);
    return isError(result)
      ? new ErrorInfo(result.pos, false, result.expectations, result.message)
      : new ParseInfo<T>(result.output, result.rest, false, result.failedAlternative);
  };
};

export function either<T>(...parsers : Parser<T>[]) : Parser<T>
{
  return (input : ParserInput) : ParseResult<T> =>
  {
    let error = null;
    for (let parser of parsers)
    {
      let result = parser(input);
      if (!isError(result))
      {
        if (error && error.consumedInput && error.pos.furtherThan(result.rest.pos()))
        {
          result.failedAlternative = error;
        }

        return result;
      }
      else
      {
        if (!error)
        {
          error = result;
        }
        else if (result.consumedInput)
        {
          if (result.pos.furtherThan(error.pos))
          {
            error = result;
          }
          else if (!error.pos.furtherThan(result.pos))
          {
            error.expectations.push(...result.expectations);
          }
        }
      }
    }

    return error;
  };
};

export function combine<T1, T2, U>(parser1 : Parser<T1>, parser2 : Parser<T2>, fn : (t1 : T1, t2 : T2) => U) : Parser<U>
{
  return (input : ParserInput) : ParseResult<U> =>
  {
    let result1 = parser1(input);
    if (isError(result1))
      return result1;

    let result2 = parser2(result1.rest);
    if (isError(result2))
    {
      return result1.failedAlternative && result1.failedAlternative.pos.furtherThan(result2.pos)
        ? result1.failedAlternative
        : new ErrorInfo(result2.pos, result2.consumedInput || result1.rest.pos().furtherThan(input.pos()), result2.expectations, result2.message, result2.context);
    }

    return new ParseInfo<U>(fn(result1.output, result2.output), result2.rest, result1.consumedInput && result2.consumedInput);
  };
};

function parseRepeated<T, U>(input : ParserInput, parser : Parser<T>, init : U, fn : (acc : U, value : T) => U) : ParseResult<U>
{
  let consumedInput = false;
  while (!input.empty())
  {
    let result = parser(input);
    if (isError(result))
    {
      return result.consumedInput
        ? result
        : new ParseInfo<U>(init, input, consumedInput, result);
    }

    init = fn(init, result.output);
    input = result.rest;
    consumedInput = consumedInput || result.consumedInput;
  }
  return new ParseInfo<U>(init, input, consumedInput);
};

export function option<T>(def : T, parser : Parser<T>) : Parser<T>
{
  return (input : ParserInput) : ParseResult<T> =>
  {
    let result = parser(input);
    if (!isError(result))
      return result;

    return result.consumedInput
      ? result
      : new ParseInfo<T>(def, input, false);
  };
};

export function many<T, U>(parser : Parser<T>, init : U, fn : (acc : U, value : T) => U) : Parser<U>
{
  return (input : ParserInput) : ParseResult<U> => parseRepeated(input, parser, init, fn);
};

export function many1<T, U>(parser : Parser<T>, init : U, fn : (acc : U, value : T) => U) : Parser<U>
{
  return (input : ParserInput) : ParseResult<U> =>
  {
    let result = parser(input);
    return isError(result)
      ? result
      : parseRepeated(result.rest, parser, fn(init, result.output), fn);
  };
};

export function separatedBy<T, U, S>(parser : Parser<T>, separator : Parser<S>, init : U, fn : (acc : U, value : T) => U) : Parser<U>
{
  return option(
    init,
    bind(parser,
      (first : T, input : ParserInput) =>
      {
        return many(
          discardLeft(separator, parser),
          fn(init, first),
          fn
        )(input);
      }
    )
  );
};

export function char(c : string) : Parser<string>
{
  return (input : StringView) : ParseResult<string> =>
  {
    if (input.empty())
      return new ErrorInfo(input.pos(), false, [quoted(c)], "unexpected end of input");

    return input.get(0) === c
      ? new ParseInfo<string>(c, input.sub(1), true)
      : new ErrorInfo(input.pos(), false, [quoted(c)], "unexpected character " + quoted(input.get(0)))
  };
};

export function oneOf(chars : string) : Parser<string>
{
  return (input : StringView) : ParseResult<string> =>
  {
    let expectations = chars.split("").map(quoted);

    if (input.empty())
      return new ErrorInfo(input.pos(), false, expectations, "unexpected end of input");

    for (let c of chars)
    {
      if (input.get(0) === c)
        return new ParseInfo<string>(c, input.sub(1), true);
    }

    return new ErrorInfo(input.pos(), false, expectations, "unexpected character " + quoted(input.get(0)));
  };
};

export function noneOf(chars : string) : Parser<string>
{
  return (input : StringView) : ParseResult<string> =>
  {
    if (input.empty())
      return new ErrorInfo(input.pos(), false, [], "unexpected end of input");

    for (let c of chars)
    {
      if (input.get(0) === c)
        return new ErrorInfo(input.pos(), false, [], "unexpected character " + quoted(input.get(0)));
    }

    return new ParseInfo<string>(input.get(0), input.sub(1), true);
  };
};

export function string(s : string) : Parser<string>
{
  return (input : StringView) : ParseResult<string> =>
  {
    let substr = input.val.substr(input.start, s.length);
    return substr === s
      ? new ParseInfo<string>(s, input.sub(s.length), true)
      : new ErrorInfo(input.pos(), false, [quoted(s)], "unexpected " + quoted(substr));
  };
};

export function not(s : string) : Parser<string>
{
  return (input : StringView) : ParseResult<string> =>
  {
    let substr = input.val.substr(input.start, s.length);
    return substr === s
      ? new ErrorInfo(input.pos(), false, [], "unexpected " + quoted(substr))
      : new ParseInfo<string>(input.get(0), input.sub(1), true);
  };
};

export function positional<T>(parser : Parser<T>) : Parser<Pair<Position, T>>
{
  return (input : ParserInput) : ParseResult<Pair<Position, T>> =>
  {
    return fmap((v) => new Pair(input.pos(), v), parser)(input);
  };
};

export function tag<T>(parser : Parser<T>, name : string) : Parser<T>
{
  return (input : ParserInput) : ParseResult<T> =>
  {
    let result = parser(input);
    if (!isError(result))
      return result;

    if (result.consumedInput)
    {
      if (!result.context)
      {
        result.context = name;
      }
    }
    else
    {
      result.expectations = [name];
    }
    return result;
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