// 模拟 AsyncStorage
class AsyncStorageMock {
    private store: { [key: string]: string } = {};

    async clear(): Promise<void> {
        this.store = {};
    }

    async getItem(key: string): Promise<string | null> {
        return this.store[key] || null;
    }

    async setItem(key: string, value: string): Promise<void> {
        this.store[key] = String(value);
    }

    async removeItem(key: string): Promise<void> {
        delete this.store[key];
    }

    async multiGet(keys: string[]): Promise<[string, string | null][]> {
        return keys.map(key => [key, this.store[key] || null]);
    }

    async multiSet(keyValuePairs: [string, string][]): Promise<void> {
        keyValuePairs.forEach(([key, value]) => {
            this.store[key] = value;
        });
    }
}

// Declare AsyncStorage on global object
declare global {
    var AsyncStorage: AsyncStorageMock;
}

// 设置全局 AsyncStorage 模拟
global.AsyncStorage = new AsyncStorageMock();

export { AsyncStorageMock };
