import { ReactNode } from 'react';
import { Platform } from 'react-native';

// Web version - no PowerSync, just pass through children
export const PowerSyncWrapper = ({ children }: { children: ReactNode }) => {
    return <>{children}</>;
};
