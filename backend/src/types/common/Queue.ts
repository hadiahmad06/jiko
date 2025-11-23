// ! basic ai-generated queue structure

export class Queue<T> {
  private items: T[] = [];

  constructor(
    private maxEntries: number = 100,
  ) {}

  // Add an item to the queue
  enqueue(item: T) {
    this.items.push(item);
    this.trim();
  }

  // Add multiple items at once
  enqueueMany(newItems: T[]) {
    this.items.push(...newItems);
    this.trim();
  }

  // Remove the oldest item
  dequeue(): T | undefined {
    return this.items.shift();
  }

  // Peek at the first (oldest) item
  first(): T | undefined {
    return this.items[0];
  }

  // Peek at the last (most recent) item
  last(): T | undefined {
    return this.items[this.items.length - 1];
  }

  // Get all items (copy)
  getAll(): T[] {
    return [...this.items];
  }

  // Current size
  size(): number {
    return this.items.length;
  }

  // Check if empty
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  // Merge another array of items into the queue
  merge(items: T[]) {
    this.items.push(...items);
    this.trim();
  }

  // Trim the queue based on max size
  private trim() {
    // Enforce max length
    if (this.maxEntries && this.items.length > this.maxEntries) {
      this.items = this.items.slice(-this.maxEntries);
    }
  }

  // Iterator support
  [Symbol.iterator](): Iterator<T> {
    let index = 0;
    const data = this.items;
    return {
      next(): IteratorResult<T> {
        if (index < data.length-1) return { value: data[index++] as T, done: false };
        return { value: undefined as any, done: true };
      },
    };
  }
}