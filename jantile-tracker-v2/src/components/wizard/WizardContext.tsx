import React, { createContext, useContext, useState, ReactNode } from 'react';
import { db } from '../../powersync/db';
import { randomUUID } from 'expo-crypto';

export type RequestType = 'delivery' | 'field_return';

export interface WizardItem {
    id: string; // Inventory ID
    name: string;
    quantity: number;
}

interface WizardContextType {
    step: number;
    type: RequestType | null;
    jobId: string | null;
    items: WizardItem[];

    setStep: (step: number) => void;
    setType: (type: RequestType) => void;
    setJobId: (id: string) => void;
    addItem: (item: WizardItem) => void;
    removeItem: (id: string) => void;
    submitRequest: () => Promise<void>;
    reset: () => void;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export function WizardProvider({ children }: { children: ReactNode }) {
    const [step, setStep] = useState(1);
    const [type, setType] = useState<RequestType | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    const [items, setItems] = useState<WizardItem[]>([]);

    const addItem = (newItem: WizardItem) => {
        setItems((prev) => {
            const existing = prev.find(i => i.id === newItem.id);
            if (existing) {
                return prev.map(i => i.id === newItem.id ? { ...i, quantity: newItem.quantity } : i);
            }
            return [...prev, newItem];
        });
    };

    const removeItem = (id: string) => {
        setItems((prev) => prev.filter(i => i.id !== id));
    };

    const reset = () => {
        setStep(1);
        setType(null);
        setJobId(null);
        setItems([]);
    };

    const submitRequest = async () => {
        if (!type || !jobId) return;

        const ticketId = randomUUID();

        // Offline-first: Insert into local DB
        // Status defaults to 'draft' or 'pending_upload'
        await db.execute(
            `INSERT INTO tickets (id, job_id, status, type, wizard_data) VALUES (?, ?, ?, ?, ?)`,
            [
                ticketId,
                jobId,
                'pending_upload',
                type,
                JSON.stringify({ items }), // Store items as JSON blob
            ]
        );

        // Reset after successful submission
        reset();
    };

    return (
        <WizardContext.Provider
            value={{
                step, setStep,
                type, setType,
                jobId, setJobId,
                items, addItem, removeItem,
                submitRequest, reset
            }}
        >
            {children}
        </WizardContext.Provider>
    );
}

export const useWizard = () => {
    const context = useContext(WizardContext);
    if (context === undefined) {
        throw new Error('useWizard must be used within a WizardProvider');
    }
    return context;
};
