import React from 'react';
import { RoleGuard, AdminDashboard } from '../../features/admin';

export default function AdminPage() {
    return (
        <RoleGuard allowed={['admin']}>
            <AdminDashboard />
        </RoleGuard>
    );
}
