import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import {
    FileText, ClipboardList, CheckSquare,
    ShieldCheck, AlertOctagon, PenLine
} from 'lucide-react-native';
import ScopeOfWorkView from './ScopeOfWorkView';
import TicketWorkView from './TicketWorkView';
import PreTaskPlanView from './PreTaskPlanView';
import SafetyToolboxView from './SafetyToolboxView';
import JHAView from './JHAView';
import SignOffsView from './SignOffsView';

interface DocumentsTabProps {
    job: any;
}

type DocViewMode = 'scope' | 'tickets' | 'pretask' | 'toolbox' | 'jha' | 'signoffs';

const DOC_TABS: { id: DocViewMode; label: string; Icon: any; color: string }[] = [
    { id: 'scope',    label: 'Scope of Work',  Icon: FileText,      color: '#2563eb' },
    { id: 'tickets',  label: 'Ticket Work',    Icon: ClipboardList, color: '#4f46e5' },
    { id: 'pretask',  label: 'Pre-Task Plan',  Icon: CheckSquare,   color: '#d97706' },
    { id: 'toolbox',  label: 'Safety Toolbox', Icon: ShieldCheck,   color: '#ea580c' },
    { id: 'jha',      label: 'JHA',            Icon: AlertOctagon,  color: '#dc2626' },
    { id: 'signoffs', label: 'Sign Offs',       Icon: PenLine,       color: '#059669' },
];

export default function DocumentsTab({ job }: DocumentsTabProps) {
    const [viewMode, setViewMode] = useState<DocViewMode>('scope');

    const activeTab = DOC_TABS.find(t => t.id === viewMode)!;

    return (
        <View className="flex-1">
            {/* Sub-Tab Bar */}
            <View className="bg-white border-b border-slate-100">
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
                >
                    {DOC_TABS.map(({ id, label, Icon, color }) => {
                        const isActive = viewMode === id;
                        return (
                            <TouchableOpacity
                                key={id}
                                onPress={() => setViewMode(id)}
                                style={isActive ? { backgroundColor: '#0f172a' } : { backgroundColor: 'transparent' }}
                                className={`flex-row items-center px-4 py-2.5 rounded-xl gap-2 border ${
                                    isActive ? 'border-transparent' : 'border-slate-200'
                                }`}
                            >
                                <Icon
                                    size={15}
                                    color={isActive ? 'white' : color}
                                />
                                <Text
                                    style={isActive ? { color: 'white' } : { color: '#475569' }}
                                    className="font-black text-[11px] uppercase tracking-widest"
                                >
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Content */}
            <View className="flex-1 bg-slate-50">
                {viewMode === 'scope'    && <ScopeOfWorkView job={job} />}
                {viewMode === 'tickets'  && <TicketWorkView job={job} />}
                {viewMode === 'pretask'  && <PreTaskPlanView job={job} />}
                {viewMode === 'toolbox'  && <SafetyToolboxView job={job} />}
                {viewMode === 'jha'      && <JHAView job={job} />}
                {viewMode === 'signoffs' && <SignOffsView job={job} />}
            </View>
        </View>
    );
}
