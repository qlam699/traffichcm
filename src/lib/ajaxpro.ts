export class AjaxProParseError extends Error {
  public override readonly name = 'AjaxProParseError';
}

interface DataTable {
  Columns: unknown;
  Rows: Array<Record<string, unknown>>;
}

export function parseAjaxPro(source: string): unknown {
  const parser = new AjaxProParser(source);
  const value = parser.parseValue();
  parser.skipWhitespace();
  return value;
}

class AjaxProParser {
  private index = 0;

  constructor(private readonly source: string) {}

  parseValue(): unknown {
    this.skipWhitespace();
    const ch = this.peek();

    if (ch === '{') {
      return this.parseObject();
    }
    if (ch === '[') {
      return this.parseArray();
    }
    if (ch === '"') {
      return this.parseString();
    }
    if (this.source.startsWith('null', this.index)) {
      this.index += 4;
      return null;
    }
    if (this.source.startsWith('true', this.index)) {
      this.index += 4;
      return true;
    }
    if (this.source.startsWith('false', this.index)) {
      this.index += 5;
      return false;
    }
    if (this.source.startsWith('new ', this.index)) {
      return this.parseConstructor();
    }
    if (ch === '-' || isDigit(ch)) {
      return this.parseNumber();
    }

    throw new AjaxProParseError(`Unexpected token at ${this.index}`);
  }

  private parseConstructor(): DataTable {
    const prefix = 'new Ajax.Web.DataTable(';
    if (!this.source.startsWith(prefix, this.index)) {
      throw new AjaxProParseError('Unsupported AjaxPro constructor');
    }
    this.index += prefix.length;
    const columns = this.parseValue();
    this.skipWhitespace();
    this.expect(',');
    const rows = this.parseValue();
    this.skipWhitespace();
    this.expect(')');

    if (!Array.isArray(columns) || !Array.isArray(rows)) {
      throw new AjaxProParseError('Invalid AjaxPro DataTable');
    }

    const names = columns.map((column) => {
      if (Array.isArray(column) && typeof column[0] === 'string') {
        return column[0];
      }
      throw new AjaxProParseError('Invalid AjaxPro DataTable column');
    });

    const mapped = rows.map((row) => {
      if (!Array.isArray(row)) {
        throw new AjaxProParseError('Invalid AjaxPro DataTable row');
      }
      const record: Record<string, unknown> = {};
      names.forEach((name, index) => {
        record[name] = row[index] ?? null;
      });
      return record;
    });

    return { Columns: columns, Rows: mapped };
  }

  private parseObject(): Record<string, unknown> {
    this.expect('{');
    const result: Record<string, unknown> = {};
    this.skipWhitespace();
    if (this.peek() === '}') {
      this.index += 1;
      return result;
    }

    while (true) {
      this.skipWhitespace();
      const key = this.parseString();
      this.skipWhitespace();
      this.expect(':');
      result[key] = this.parseValue();
      this.skipWhitespace();
      const next = this.peek();
      if (next === ',') {
        this.index += 1;
        continue;
      }
      if (next === '}') {
        this.index += 1;
        return result;
      }
      throw new AjaxProParseError('Expected , or } in object');
    }
  }

  private parseArray(): unknown[] {
    this.expect('[');
    const result: unknown[] = [];
    this.skipWhitespace();
    if (this.peek() === ']') {
      this.index += 1;
      return result;
    }

    while (true) {
      result.push(this.parseValue());
      this.skipWhitespace();
      const next = this.peek();
      if (next === ',') {
        this.index += 1;
        continue;
      }
      if (next === ']') {
        this.index += 1;
        return result;
      }
      throw new AjaxProParseError('Expected , or ] in array');
    }
  }

  private parseString(): string {
    this.expect('"');
    let result = '';
    while (this.index < this.source.length) {
      const ch = this.source[this.index] ?? '';
      if (ch === '\\') {
        const next = this.source[this.index + 1] ?? '';
        if (next === 'u') {
          const hex = this.source.slice(this.index + 2, this.index + 6);
          result += String.fromCharCode(Number.parseInt(hex, 16));
          this.index += 6;
          continue;
        }
        const escaped: Record<string, string> = {
          '"': '"',
          '\\': '\\',
          '/': '/',
          b: '\b',
          f: '\f',
          n: '\n',
          r: '\r',
          t: '\t',
        };
        result += escaped[next] ?? next;
        this.index += 2;
        continue;
      }
      if (ch === '"') {
        this.index += 1;
        return result;
      }
      result += ch;
      this.index += 1;
    }
    throw new AjaxProParseError('Unterminated string');
  }

  private parseNumber(): number {
    const start = this.index;
    if (this.peek() === '-') {
      this.index += 1;
    }
    while (isDigit(this.peek())) {
      this.index += 1;
    }
    if (this.peek() === '.') {
      this.index += 1;
      while (isDigit(this.peek())) {
        this.index += 1;
      }
    }
    if (this.peek() === 'e' || this.peek() === 'E') {
      this.index += 1;
      if (this.peek() === '+' || this.peek() === '-') {
        this.index += 1;
      }
      while (isDigit(this.peek())) {
        this.index += 1;
      }
    }
    const value = Number(this.source.slice(start, this.index));
    if (!Number.isFinite(value)) {
      throw new AjaxProParseError('Invalid number');
    }
    return value;
  }

  skipWhitespace(): void {
    while (this.index < this.source.length && /\s/.test(this.source[this.index] ?? '')) {
      this.index += 1;
    }
  }

  private peek(): string {
    return this.source[this.index] ?? '';
  }

  private expect(ch: string): void {
    if (this.peek() !== ch) {
      throw new AjaxProParseError(`Expected ${ch} at ${this.index}`);
    }
    this.index += 1;
  }
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

export function extractSearchQueryRows(parsed: unknown): Array<Record<string, unknown>> {
  if (!parsed || typeof parsed !== 'object' || !('value' in parsed)) {
    throw new AjaxProParseError('SearchQuery response is missing value');
  }

  const value = (parsed as { value: unknown }).value;
  if (!Array.isArray(value) || value.length < 2) {
    throw new AjaxProParseError('SearchQuery value is not a table payload');
  }

  const tableHolder = value[1];
  const table = Array.isArray(tableHolder) ? tableHolder[1] : tableHolder;
  if (!table || typeof table !== 'object' || !('Rows' in table)) {
    throw new AjaxProParseError('SearchQuery DataTable is missing Rows');
  }

  const rows = (table as DataTable).Rows;
  if (!Array.isArray(rows)) {
    throw new AjaxProParseError('SearchQuery Rows is not an array');
  }
  return rows;
}
