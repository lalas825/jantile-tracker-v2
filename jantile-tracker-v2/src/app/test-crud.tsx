import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { MockJobStore, Job } from '../services/MockJobStore'; // Adjust path if needed

/**
 * Test page to verify CRUD operations on MockJobStore
 */
export default function TestCrudScreen() {
    const router = useRouter();
    const [logs, setLogs] = useState<string[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [status, setStatus] = useState<'IDLE' | 'RUNNING' | 'DONE' | 'ERROR'>('IDLE');

    const log = (msg: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
    };

    const runTests = async () => {
        setStatus('RUNNING');
        setLogs([]);
        log("Starting Tests...");

        try {
            // 0. Initial State
            const initialJobs = MockJobStore.getAllJobs();
            log(`Initial Job Count: ${initialJobs.length}`);
            setJobs([...initialJobs]);

            // 1. ADD JOB
            const newJobName = "Test Job " + Math.floor(Math.random() * 1000);
            const newJobLocation = "123 Test St";
            log(`[1] Adding Job: ${newJobName} @ ${newJobLocation}`);
            MockJobStore.addJob(newJobName, newJobLocation, 'Test GC', '10', 'test@example.com');

            const jobsAfterAdd = MockJobStore.getAllJobs();
            const addedJob = jobsAfterAdd.find(j => j.name === newJobName);
            if (addedJob) {
                log(`PASS: Job Added. ID: ${addedJob.id}`);
            } else {
                log("FAIL: Job NOT added.");
                throw new Error("Add Job Failed");
            }

            // 2. UPDATE JOB
            if (addedJob) {
                const updatedName = newJobName + " (Updated)";
                const updatedLoc = "456 Update Blvd";
                log(`[2] Updating Job ${addedJob.id} to: ${updatedName}`);
                MockJobStore.updateJob(addedJob.id, updatedName, updatedLoc, 'New GC', '20', 'new@example.com');

                const jobCheck = MockJobStore.getJob(addedJob.id);
                if (jobCheck && jobCheck.name === updatedName && jobCheck.location === updatedLoc) {
                    log("PASS: Job Updated successfully.");
                } else {
                    log(`FAIL: Job update mismatch. Name: ${jobCheck?.name}`);
                    throw new Error("Update Job Failed");
                }
            }

            // 3. DELETE JOB
            if (addedJob) {
                log(`[3] Deleting Job ${addedJob.id}`);
                MockJobStore.deleteJob(addedJob.id);

                const deletedCheck = MockJobStore.getJob(addedJob.id);
                if (!deletedCheck) {
                    log("PASS: Job Deleted successfully.");
                } else {
                    log("FAIL: Job still exists.");
                    throw new Error("Delete Job Failed");
                }
            }

            // Final State
            const finalJobs = MockJobStore.getAllJobs();
            setJobs([...finalJobs]);
            log(`Final Job Count: ${finalJobs.length}`);

            if (finalJobs.length === initialJobs.length) {
                log("PASS: Job count returned to initial (Clean up successful)");
            } else {
                // Note: logic might vary if store was modified externally, but in isolated test this holds
                log("WARN: Job count mismatch?");
            }

            setStatus('DONE');
        } catch (e: any) {
            log(`ERROR: ${e.message}`);
            setStatus('ERROR');
        }
    };

    useEffect(() => {
        setJobs(MockJobStore.getAllJobs());
    }, []);

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="p-4 border-b border-gray-200 flex-row justify-between items-center">
                <Text className="text-xl font-bold">CRUD Test Runner</Text>
                <TouchableOpacity onPress={() => router.back()} className="bg-gray-200 px-3 py-1 rounded">
                    <Text>Back</Text>
                </TouchableOpacity>
            </View>

            <View className="p-4">
                <TouchableOpacity
                    onPress={runTests}
                    className={`p-4 rounded-lg items-center ${status === 'RUNNING' ? 'bg-gray-300' : 'bg-blue-600'}`}
                    disabled={status === 'RUNNING'}
                >
                    {status === 'RUNNING' ? <ActivityIndicator color="#000" /> : <Text className="text-white font-bold text-lg">RUN TESTS</Text>}
                </TouchableOpacity>

                <View className="mt-4 bg-gray-900 p-4 rounded-lg h-64">
                    <ScrollView>
                        {logs.length === 0 && <Text className="text-gray-500 italic">Logs will appear here...</Text>}
                        {logs.map((L, i) => (
                            <Text key={i} className="text-green-400 font-mono text-xs mb-1">{L}</Text>
                        ))}
                    </ScrollView>
                </View>

                <Text className="mt-4 font-bold text-lg">Current Jobs in Store:</Text>
                <ScrollView className="h-48 mt-2 border border-gray-200 rounded">
                    {jobs.map(j => (
                        <View key={j.id} className="p-2 border-b border-gray-100">
                            <Text className="font-bold">{j.name}</Text>
                            <Text className="text-xs text-gray-500">{j.location} (ID: {j.id})</Text>
                        </View>
                    ))}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
