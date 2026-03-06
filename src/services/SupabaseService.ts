import { supabase } from '../config/supabase';
import { JobService } from '../features/jobs';
import { LogisticsService } from '../features/logistics';
import { CrewService } from '../features/crew';

// --- TYPE RE-EXPORTS (backward compatibility) ---
export type { Job, ChecklistItem, Area, Unit, JobIssue, IssueComment } from '../features/jobs';
export type { ProjectMaterial, DeliveryTicket, PurchaseOrderItem, PurchaseOrder } from '../features/logistics';
export type { Worker, ProductionLog, UICrewMember, UIJobLog, UIWorkerWithLogs } from '../features/crew';
export { getInitials, formatDate, formatDisplayDate } from '../features/crew';

// --- UNIFIED SERVICE FACADE ---
export const SupabaseService = {

    // Raw Supabase client
    supabase: supabase,

    // --- WORKERS (delegated to CrewService) ---
    getWorkers: CrewService.getWorkers,
    saveWorker: CrewService.saveWorker,

    // --- PRODUCTION LOGS (delegated to CrewService) ---
    getProductionLogs: CrewService.getProductionLogs,
    upsertLog: CrewService.upsertLog,
    deleteLog: CrewService.deleteLog,

    // --- JOBS (delegated to JobService) ---
    createJob: JobService.createJob,
    getActiveJobs: JobService.getActiveJobs,
    updateJob: JobService.updateJob,
    getProjectAreas: JobService.getProjectAreas,
    deleteJob: JobService.deleteJob,
    getJob: JobService.getJob,
    addFloor: JobService.addFloor,
    deleteFloor: JobService.deleteFloor,
    updateFloorName: JobService.updateFloorName,
    addUnit: JobService.addUnit,
    deleteUnit: JobService.deleteUnit,
    addArea: JobService.addArea,
    updateArea: JobService.updateArea,
    deleteArea: JobService.deleteArea,

    // --- CHECKLIST (delegated to JobService) ---
    getChecklistItems: JobService.getChecklistItems,
    sortChecklist: JobService.sortChecklist,
    recalculateAreaProgress: JobService.recalculateAreaProgress,
    addChecklistItem: JobService.addChecklistItem,
    updateChecklistItem: JobService.updateChecklistItem,
    deleteChecklistItem: JobService.deleteChecklistItem,
    updateUnitName: JobService.updateUnitName,

    // --- PHOTOS (delegated to JobService) ---
    uploadAreaPhoto: JobService.uploadAreaPhoto,
    getAreaPhotos: JobService.getAreaPhotos,
    deleteAreaPhoto: JobService.deleteAreaPhoto,

    // --- ISSUES (delegated to JobService) ---
    getJobIssues: JobService.getJobIssues,
    getGlobalIssueStats: JobService.getGlobalIssueStats,
    getGlobalOpenIssuesCount: JobService.getGlobalOpenIssuesCount,
    createIssue: JobService.createIssue,
    updateIssueStatus: JobService.updateIssueStatus,
    deleteIssue: JobService.deleteIssue,
    getIssueComments: JobService.getIssueComments,
    addIssueComment: JobService.addIssueComment,

    // --- LOGISTICS (delegated to LogisticsService) ---
    getProjectMaterials: LogisticsService.getProjectMaterials,
    getAllProjectMaterials: LogisticsService.getAllProjectMaterials,
    saveProjectMaterial: LogisticsService.saveProjectMaterial,
    deleteProjectMaterial: LogisticsService.deleteProjectMaterial,
    getDeliveryTickets: LogisticsService.getDeliveryTickets,
    generateNextTicketNumber: LogisticsService.generateNextTicketNumber,
    saveDeliveryTicket: LogisticsService.saveDeliveryTicket,
    deleteDeliveryTicket: LogisticsService.deleteDeliveryTicket,
    updateDeliveryTicketTime: LogisticsService.updateDeliveryTicketTime,
    approveDeliveryTicket: LogisticsService.approveDeliveryTicket,
    updateTicketStatus: LogisticsService.updateTicketStatus,
    getAllDeliveryTickets: LogisticsService.getAllDeliveryTickets,
    getOutboundTickets: LogisticsService.getOutboundTickets,
    getReceivingPOs: LogisticsService.getReceivingPOs,
    getProcessedPOs: LogisticsService.getProcessedPOs,
    receivePurchaseOrder: LogisticsService.receivePurchaseOrder,
    revertPurchaseOrderIntake: LogisticsService.revertPurchaseOrderIntake,
    sendNotification: LogisticsService.sendNotification,
    createReorderPO: LogisticsService.createReorderPO,
    getDiscrepancyAnalytics: LogisticsService.getDiscrepancyAnalytics,
    getAllPurchaseOrders: LogisticsService.getAllPurchaseOrders,
    updatePurchaseOrderTime: LogisticsService.updatePurchaseOrderTime,
    getPurchaseOrders: LogisticsService.getPurchaseOrders,
    savePurchaseOrder: LogisticsService.savePurchaseOrder,
    getWarehouseInventory: LogisticsService.getWarehouseInventory,
    manualStockUpdate: LogisticsService.manualStockUpdate,
    allocateGeneralStock: LogisticsService.allocateGeneralStock,
    receiveDeliveryTicket: LogisticsService.receiveDeliveryTicket,
    getFleetResources: LogisticsService.getFleetResources,
    saveFleetResource: LogisticsService.saveFleetResource,
    deleteFleetResource: LogisticsService.deleteFleetResource,
};
