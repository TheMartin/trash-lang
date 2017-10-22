export class Position
{
  constructor(public readonly line : number, public readonly col : number) {}
  furtherThan(other : Position) : boolean
  {
    return this.line > other.line
      || (this.line === other.line && this.col > other.col);
  }
};

export class StringView
{
  constructor(public readonly val : string, public readonly start : number = 0, public readonly length? : number, private readonly _pos : Position = new Position(0, 0))
  {
    this.start = Math.min(this.val.length, this.start);
    if (length === undefined)
      this.length = Math.max(0, this.val.length - this.start);
  }
  empty() : boolean
  {
    return this.length <= 0;
  }
  get(i : number) : string
  {
    return (i >= 0 && i < this.length) ? this.val.charAt(this.start + i) : "";
  }
  pos() : Position
  {
    return this._pos;
  }
  sub(start : number, length? : number) : StringView
  {
    let line = this._pos.line;
    let col = this._pos.col;
    for (let i = this.start; i < Math.min(this.val.length, this.start + start); ++i)
    {
      if (this.val[i] === "\n")
      {
        col = 0;
        ++line;
      }
      else
      {
        ++col;
      }
    }
    return new StringView(this.val, this.start + start, length, new Position(line, col));
  }
};