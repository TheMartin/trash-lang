export class StringView
{
  constructor(public readonly val : string, public readonly start : number = 0, public readonly length? : number)
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
  sub(start : number, length? : number) : StringView
  {
    return new StringView(this.val, this.start + start, length);
  }
};