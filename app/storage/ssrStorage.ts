export class SSRStorage {
  length = 0;
  items: Record<string, string> = {};

  constructor() {
    this.items = {};
  }
  getItem(_key: string) {
    return this.items[_key] || null;
  }
  setItem(_key: string, _value: string) {
    this.items[_key] = _value;
    this.length = Object.keys(this.items).length;
  }
  removeItem(_key: string) {
    delete this.items[_key];
    this.length = Object.keys(this.items).length;
  }

  clear() {
    this.items = {};
    this.length = 0;
  }
}
