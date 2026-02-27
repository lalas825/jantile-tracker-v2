/**
 * Local PowerSync React Shim
 * 
 * This module provides the same exports as @powersync/react but uses
 * a local createContext instead of importing from the package directly.
 * 
 * This fixes a runtime crash on Android where importing @powersync/react
 * causes "TypeError: undefined is not a function" in New Architecture mode.
 */
const { createContext, useContext, useState, useEffect, useCallback, useRef } = require('react');

// Create a local PowerSync context (replaces the one from @powersync/react)
const PowerSyncContext = createContext(null);

/**
 * Hook to get the PowerSync database instance from context
 */
function usePowerSync() {
    const db = useContext(PowerSyncContext);
    if (!db) {
        console.warn('[PowerSync Shim] usePowerSync called outside PowerSyncContext');
    }
    return db;
}

/**
 * Hook to run a SQL query reactively (re-runs when data changes)
 * Simplified version that polls for changes
 */
function useQuery(sqlStatement, parameters = [], options = {}) {
    const db = usePowerSync();
    const [data, setData] = useState({ data: [], isLoading: true, error: undefined });

    useEffect(() => {
        if (!db || db.isMock) {
            setData({ data: [], isLoading: false, error: undefined });
            return;
        }

        let isMounted = true;

        const fetchData = async () => {
            try {
                const results = await db.getAll(sqlStatement, parameters);
                if (isMounted) {
                    setData({ data: results || [], isLoading: false, error: undefined });
                }
            } catch (e) {
                console.error('[PowerSync Shim] Query error:', e);
                if (isMounted) {
                    setData({ data: [], isLoading: false, error: e });
                }
            }
        };

        fetchData();

        // Set up watching for changes
        let watcher;
        try {
            // Extract table names from SQL for change detection
            const tables = extractTablesFromSQL(sqlStatement);
            if (tables.length > 0 && db.onChange) {
                watcher = db.onChange({
                    onChange: () => { fetchData(); }
                }, { tables });
            }
        } catch (e) {
            // onChange not available, use polling fallback
            const interval = setInterval(fetchData, 5000);
            return () => {
                isMounted = false;
                clearInterval(interval);
            };
        }

        return () => {
            isMounted = false;
            if (watcher && watcher.close) {
                watcher.close();
            }
        };
    }, [sqlStatement, JSON.stringify(parameters)]);

    return data;
}

/**
 * Alias for useQuery (backward compatibility)
 */
function usePowerSyncQuery(sqlStatement, parameters = []) {
    const result = useQuery(sqlStatement, parameters);
    return result.data;
}

/**
 * Hook to get PowerSync connection status
 */
function useStatus() {
    const db = usePowerSync();
    if (!db || db.isMock) {
        return { connected: false, uploading: false, downloading: false, lastSyncedAt: null };
    }
    return db.currentStatus || { connected: false, uploading: false, downloading: false, lastSyncedAt: null };
}

/**
 * Simple SQL table name extractor for change detection
 */
function extractTablesFromSQL(sql) {
    const matches = sql.match(/\bFROM\s+(\w+)/gi) || [];
    return matches.map(m => m.replace(/FROM\s+/i, '').trim()).filter(Boolean);
}

// These are the same exports that @powersync/react provides
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
