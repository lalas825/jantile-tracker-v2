// Web Fallback for DB
export const db = {
    execute: async () => {
        console.warn('PowerSync DB execute called on web - this is a mock.');
        return { rows: { _array: [], length: 0, item: () => null } };
    }
};
