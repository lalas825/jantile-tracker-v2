import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, Image, ScrollView, Alert,
    Platform, StyleSheet, Modal, Dimensions, Share
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons'; // STANDARD ICONS

const SCREEN_WIDTH = Dimensions.get('window').width;
const IMG_SIZE = (SCREEN_WIDTH > 600 ? 150 : (SCREEN_WIDTH - 48) / 3);

export default function PhotosTab({ photos = [], onAddPhoto, onDeletePhoto }: any) {
    const [cameraStatus, requestCameraPermission] = ImagePicker.useCameraPermissions();
    const [libraryStatus, requestLibraryPermission] = ImagePicker.useMediaLibraryPermissions();
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

    const handleTakePhoto = async () => {
        if (cameraStatus?.status !== 'granted') {
            const resp = await requestCameraPermission();
            if (!resp.granted) return Alert.alert("Permission", "Camera access is required.");
        }
        let result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5,
        });
        if (!result.canceled && result.assets) onAddPhoto(result.assets[0].uri);
    };

    const handleUploadPhoto = async () => {
        if (libraryStatus?.status !== 'granted') {
            const resp = await requestLibraryPermission();
            if (!resp.granted) return Alert.alert("Permission", "Gallery access is required.");
        }
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5,
        });
        if (!result.canceled && result.assets) onAddPhoto(result.assets[0].uri);
    };

    const handleDownload = async (uri: string) => {
        if (Platform.OS === 'web') {
            window.open(uri, '_blank');
            return;
        }
        try {
            if (await MediaLibrary.isAvailableAsync()) {
                await MediaLibrary.saveToLibraryAsync(uri);
                Alert.alert("Saved", "Photo saved to your gallery!");
            } else {
                Share.share({ url: uri });
            }
        } catch (e) {
            Share.share({ url: uri });
        }
    };

    const handleDelete = (uri: string) => {
        // 1. WEB SUPPORT (Browser Native Confirm)
        if (Platform.OS === 'web') {
            const confirmed = window.confirm("Are you sure you want to delete this photo?");
            if (confirmed) {
                onDeletePhoto(uri);
                setSelectedPhoto(null); // Close the modal
            }
            return;
        }

        // 2. MOBILE SUPPORT (Native Alert)
        Alert.alert("Delete Photo?", "This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                    onDeletePhoto(uri);
                    setSelectedPhoto(null); // Close the modal
                }
            }
        ]);
    };

    return (
        <View style={styles.container}>

            {/* 1. PROFESSIONAL ICON BUTTONS */}
            <View style={styles.btnRow}>
                <TouchableOpacity style={styles.proButton} onPress={handleTakePhoto}>
                    <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="camera" size={24} color="#3b82f6" />
                    </View>
                    <View>
                        <Text style={styles.btnTitle}>Take Photo</Text>
                        <Text style={styles.btnSub}>Use Camera</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.proButton} onPress={handleUploadPhoto}>
                    <View style={[styles.iconCircle, { backgroundColor: '#F8FAFC' }]}>
                        <Ionicons name="images" size={24} color="#64748b" />
                    </View>
                    <View>
                        <Text style={styles.btnTitle}>Upload</Text>
                        <Text style={styles.btnSub}>From Gallery</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* 2. GALLERY GRID */}
            <Text style={styles.sectionHeader}>Project Photos ({photos.length})</Text>

            <ScrollView contentContainerStyle={styles.grid}>
                {photos.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Ionicons name="image-outline" size={48} color="#cbd5e1" />
                        <Text style={styles.emptyText}>No photos added yet.</Text>
                    </View>
                ) : (
                    photos.map((uri: string, index: number) => (
                        <TouchableOpacity
                            key={index}
                            onPress={() => setSelectedPhoto(uri)}
                            activeOpacity={0.7}
                        >
                            <Image
                                source={{ uri }}
                                style={{
                                    width: IMG_SIZE,
                                    height: IMG_SIZE,
                                    borderRadius: 12,
                                    backgroundColor: '#e2e8f0',
                                    marginBottom: 8
                                }}
                                resizeMode="cover"
                            />
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* 3. FULL SCREEN PREVIEW MODAL */}
            <Modal visible={!!selectedPhoto} transparent={true} animationType="fade">
                <View style={styles.modalBg}>
                    <TouchableOpacity style={styles.closeArea} onPress={() => setSelectedPhoto(null)} />

                    <View style={styles.previewContainer}>
                        {selectedPhoto && (
                            <Image
                                source={{ uri: selectedPhoto }}
                                style={styles.fullImage}
                                resizeMode="contain"
                            />
                        )}

                        {/* TOOLBAR WITH ICONS */}
                        <View style={styles.toolbar}>
                            <TouchableOpacity style={styles.toolBtn} onPress={() => selectedPhoto && handleDownload(selectedPhoto)}>
                                <Ionicons name="cloud-download-outline" size={28} color="white" />
                                <Text style={styles.toolText}>Save</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.toolBtn} onPress={() => setSelectedPhoto(null)}>
                                <Ionicons name="close-circle-outline" size={28} color="white" />
                                <Text style={styles.toolText}>Close</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.toolBtn} onPress={() => selectedPhoto && handleDelete(selectedPhoto)}>
                                <Ionicons name="trash-outline" size={28} color="#ef4444" />
                                <Text style={[styles.toolText, { color: '#ef4444' }]}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },

    // Button Styles
    btnRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    proButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2
    },
    iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    btnTitle: { fontWeight: 'bold', color: '#1e293b', fontSize: 14 },
    btnSub: { fontSize: 12, color: '#64748b' },

    // Grid
    sectionHeader: { fontSize: 14, fontWeight: '700', color: '#475569', marginBottom: 12 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    emptyBox: { width: '100%', padding: 40, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1' },
    emptyText: { color: '#94a3b8', marginTop: 10, fontWeight: '500' },

    // Modal
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    closeArea: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
    previewContainer: { width: '100%', height: '100%', justifyContent: 'center' },
    fullImage: { flex: 1, width: '100%' },
    toolbar: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        paddingBottom: 40,
        paddingTop: 20,
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        position: 'absolute', bottom: 0, left: 0, right: 0
    },
    toolBtn: { alignItems: 'center', padding: 10 },
    toolText: { color: 'white', fontSize: 11, fontWeight: '600', marginTop: 4 }
});