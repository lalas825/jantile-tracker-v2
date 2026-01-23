import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Box, RefreshCcw, Search, ChevronLeft, ChevronRight, Check } from 'lucide-react-native';
import clsx from 'clsx';
import { WizardProvider, useWizard, RequestType } from '../../components/wizard/WizardContext';
import { useLogisticsData } from '../../hooks/useLogisticsData';



function StepButtons() {
    const { step, setStep, submitRequest } = useWizard();
    const router = useRouter();

    const handleNext = async () => {
        if (step < 4) {
            setStep(step + 1);
        } else {
            await submitRequest();
            router.back();
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
        } else {
            router.back();
        }
    };

    return (
        <View className="flex-row p-4 bg-slate-900 border-t border-slate-800">
            <TouchableOpacity
                onPress={handleBack}
                className="flex-1 bg-slate-800 p-4 rounded-lg mr-2 items-center"
            >
                <Text className="text-slate-300 font-bold">Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={handleNext}
                className="flex-1 bg-blue-600 p-4 rounded-lg ml-2 items-center"
            >
                <Text className="text-white font-bold">{step === 4 ? 'Submit Request' : 'Next'}</Text>
            </TouchableOpacity>
        </View>
    );
}

function Step1Type() {
    const { type, setType } = useWizard();

    const Card = ({ value, label, icon: Icon }: { value: RequestType, label: string, icon: any }) => (
        <TouchableOpacity
            onPress={() => setType(value)}
            className={clsx(
                "w-full p-6 rounded-xl border-2 mb-4 flex-row items-center",
                type === value ? "border-emerald-500 bg-emerald-900/30" : "border-slate-700 bg-slate-800"
            )}
        >
            <View className={clsx("p-3 rounded-full mr-4", type === value ? "bg-emerald-500" : "bg-slate-700")}>
                <Icon size={24} color="white" />
            </View>
            <Text className="text-white text-xl font-bold">{label}</Text>
        </TouchableOpacity>
    );

    return (
        <View className="flex-1 px-5 pt-8">
            <Text className="text-white text-2xl font-bold mb-6">What fits the bill?</Text>
            <Card value="delivery" label="Warehouse Request" icon={Box} />
            <Card value="field_return" label="Field Return" icon={RefreshCcw} />
        </View>
    );
}

function Step2Job() {
    const { jobId, setJobId } = useWizard();
    const { jobs, loading } = useLogisticsData();

    if (loading) return <View className="p-5"><Text className="text-white">Loading Jobs...</Text></View>;

    return (
        <View className="flex-1 px-5 pt-8">
            <Text className="text-white text-2xl font-bold mb-6">Select a Job</Text>
            {jobs.map((job: any) => (
                <TouchableOpacity
                    key={job.id}
                    onPress={() => setJobId(job.id)}
                    className={clsx(
                        "p-4 rounded-xl border mb-3 flex-row justify-between items-center",
                        jobId === job.id ? "border-emerald-500 bg-emerald-900/30" : "border-slate-700 bg-slate-800"
                    )}
                >
                    <Text className="text-white text-lg font-medium">{job.name}</Text>
                    {jobId === job.id && <Check size={20} color="#34d399" />}
                </TouchableOpacity>
            ))}
        </View>
    );
}

function Step3Items() {
    const { items, addItem, removeItem } = useWizard();
    const { inventory, loading } = useLogisticsData();
    const [search, setSearch] = useState('');
    const [qtyMap, setQtyMap] = useState<Record<string, string>>({});

    const filtered = inventory.filter((i: any) => i.item_name?.toLowerCase().includes(search.toLowerCase()));

    const handleAdd = (item: any, qty: string) => {
        addItem({ id: item.id, name: item.item_name, quantity: parseInt(qty) || 0 });
        setQtyMap(prev => ({ ...prev, [item.id]: '' })); // Reset input
    };

    if (loading) return <View className="p-5"><Text className="text-white">Loading Inventory...</Text></View>;

    return (
        <View className="flex-1 px-5 pt-4">
            <Text className="text-white text-2xl font-bold mb-4">Add Items</Text>

            {/* Search Bar */}
            <View className="bg-slate-800 flex-row items-center p-3 rounded-xl mb-4 border border-slate-700">
                <Search size={20} color="#94a3b8" />
                <TextInput
                    placeholder="Search Tile, Grout..."
                    placeholderTextColor="#94a3b8"
                    className="flex-1 ml-3 text-white text-lg"
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            <ScrollView className="flex-1">
                {filtered.map((item: any) => {
                    const inCart = items.find(i => i.id === item.id);
                    return (
                        <View key={item.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-3">
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-white font-bold text-lg">{item.item_name}</Text>
                                <Text className="text-slate-400">On Hand: {item.quantity_on_hand}</Text>
                            </View>

                            <View className="flex-row items-center">
                                <TextInput
                                    placeholder="Qty"
                                    placeholderTextColor="#64748b"
                                    keyboardType="numeric"
                                    className="bg-slate-900 text-white p-3 rounded-lg w-20 text-center mr-3 border border-slate-700"
                                    value={qtyMap[item.id] || (inCart ? inCart.quantity.toString() : '')}
                                    onChangeText={(val) => setQtyMap(prev => ({ ...prev, [item.id]: val }))}
                                />
                                <TouchableOpacity
                                    onPress={() => handleAdd(item, qtyMap[item.id])}
                                    className="bg-blue-600 px-4 py-3 rounded-lg flex-1 items-center"
                                >
                                    <Text className="text-white font-bold">{inCart ? 'Update' : 'Add'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}

function Step4Review() {
    const { type, jobId, items } = useWizard();
    const { jobs } = useLogisticsData();
    const jobName = jobs.find((j: any) => j.id === jobId)?.name || 'Unknown Job';
    const typeLabel = type === 'delivery' ? 'Warehouse Request' : 'Field Return';

    return (
        <View className="flex-1 px-5 pt-8">
            <Text className="text-white text-2xl font-bold mb-6">Review & Submit</Text>

            <View className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6">
                <Text className="text-slate-400 text-sm mb-1 uppercase">Type</Text>
                <Text className="text-white text-lg font-bold mb-4">{typeLabel}</Text>

                <Text className="text-slate-400 text-sm mb-1 uppercase">Job</Text>
                <Text className="text-white text-lg font-bold">{jobName}</Text>
            </View>

            <Text className="text-white text-lg font-bold mb-3">Items ({items.length})</Text>
            <ScrollView className="flex-1">
                {items.map(item => (
                    <View key={item.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-2 flex-row justify-between">
                        <Text className="text-white font-medium">{item.name}</Text>
                        <Text className="text-emerald-400 font-bold">x{item.quantity}</Text>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

function WizardContent() {
    const { step } = useWizard();

    // Progress Bar
    const progress = step * 25;

    return (
        <SafeAreaView className="flex-1 bg-slate-900">
            {/* Header with Progress */}
            <View className="px-5 py-4 border-b border-slate-800">
                <Text className="text-white text-xl font-bold mb-3">New Request</Text>
                <View className="h-1 bg-slate-800 rounded-full w-full overflow-hidden">
                    <View className="h-full bg-blue-500" style={{ width: `${progress}%` }} />
                </View>
            </View>

            {/* Step Content */}
            <View className="flex-1">
                {step === 1 && <Step1Type />}
                {step === 2 && <Step2Job />}
                {step === 3 && <Step3Items />}
                {step === 4 && <Step4Review />}
            </View>

            <StepButtons />
        </SafeAreaView>
    );
}

export default function NewRequestScreen() {
    return (
        <WizardProvider>
            <WizardContent />
        </WizardProvider>
    );
}
