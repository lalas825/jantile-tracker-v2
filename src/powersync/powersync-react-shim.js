/**
 * Local PowerSync React Shim
 *
 * Replaces @powersync/react on native (Android New Architecture) to avoid
 * runtime crash. Uses polling with db.getAll() for reactive queries.
 */
const { createContext, useContext, useState, useEffect, useRef } = require('react');

console.log('[PowerSync Shim] Module loaded successfully');

const PowerSyncContext = createContext(null);

function usePowerSync() {
    return useContext(PowerSyncContext);
}

/**
 * Reactive SQL query hook. Polls every 2s for updates after sync.
 * getAll() always returns plain arrays — safe on all platforms.
 */
function useQuery(sqlStatement, parameters = [], options = {}) {
    const db = usePowerSync();
    const [data, setData] = useState({ data: [], isLoading: true, error: undefined });
    const lastJsonRef = useRef('');

    useEffect(() => {
        if (!db || db.isMock) {
            setData({ data: [], isLoading: false, error: undefined });
            return;
        }

        let active = true;

        const fetchData = async () => {
            try {
                const results = await db.getAll(sqlStatement, parameters);
                if (!active) return;
                const json = JSON.stringify(results || []);
                if (json !== lastJsonRef.current) {
                    lastJsonRef.current = json;
                    setData({ data: results || [], isLoading: false, error: undefined });
                }
            } catch (e) {
                console.error('[PowerSync Shim] Query error:', e?.message || e);
                if (active) {
                    setData({ data: [], isLoading: false, error: e });
                }
            }
        };

        // Initial fetch
        fetchData();

        // Poll every 2s — simple, reliable, no compatibility issues
        const interval = setInterval(fetchData, 2000);

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, [db, sqlStatement, JSON.stringify(parameters)]);

    return data;
}

function usePowerSyncQuery(sqlStatement, parameters = []) {
    const result = useQuery(sqlStatement, parameters);
    return result.data;
}

function useStatus() {
    const db = usePowerSync();
    const [status, setStatus] = useState(
        { connected: false, uploading: false, downloading: false, lastSyncedAt: null }
    );

    useEffect(() => {
        if (!db || db.isMock) return;

        const update = () => {
            if (db.currentStatus) {
                setStatus({ ...db.currentStatus });
            }
        };

        update();
        const interval = setInterval(update, 3000);
        return () => clearInterval(interval);
    }, [db]);

    return status;
}

module.exports = {
    PowerSyncContext,
    usePowerSync,
    useQuery,
    usePowerSyncQuery,
    useStatus,
    usePowerSyncWatchedQuery: useQuery,
    usePowerSyncStatus: useStatus,
    useSuspenseQuery: useQuery,
};
