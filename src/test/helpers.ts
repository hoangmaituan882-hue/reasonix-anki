/**
 * 测试共享工具。
 *
 * jsdom 环境的 localStorage 可能被 Node 实验特性架空（方法缺失），
 * 此内存实现作为 `vi.stubGlobal("localStorage", ...)` 的替代。
 */
export function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, String(value)),
  } as Storage;
}
