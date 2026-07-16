import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getOverview(filters: any) {
    // Return mock data for KPIs
    return {
      totalRevenue: { value: 124500, previousValue: 98000, change: 27, trend: 'up' },
      netRevenue: { value: 108300, previousValue: 85000, change: 27.4, trend: 'up' },
      totalOrders: { value: 845, previousValue: 710, change: 19, trend: 'up' },
      avgOrderValue: { value: 147.33, previousValue: 138.02, change: 6.7, trend: 'up' },
      itemsSold: { value: 3120, previousValue: 2800, change: 11.4, trend: 'up' },
      grossProfit: { value: 42100, previousValue: 31500, change: 33.6, trend: 'up' },
      profitMargin: { value: 33.8, previousValue: 32.1, change: 5.2, trend: 'up' },
      returnRate: { value: 4.2, previousValue: 5.1, change: -17.6, trend: 'down' },
      cancellationRate: { value: 2.1, previousValue: 1.8, change: 16.6, trend: 'up' },
      activeMarketplaces: { value: 4, previousValue: 4, change: 0, trend: 'neutral' },
      integrationSuccess: { value: 99.2, previousValue: 98.5, change: 0.7, trend: 'up' },
      transferErrors: { value: 12, previousValue: 45, change: -73.3, trend: 'down' },
      pendingShipments: { value: 56, previousValue: 42, change: 33.3, trend: 'up' },
      criticalStockCount: { value: 14, previousValue: 8, change: 75, trend: 'up' },
    };
  }

  async getSales(filters: any) {
    return {
      trend: [
        { date: '2026-06-24', revenue: 4500, orders: 45 },
        { date: '2026-06-25', revenue: 5200, orders: 50 },
        { date: '2026-06-26', revenue: 4800, orders: 48 },
        { date: '2026-06-27', revenue: 7100, orders: 65 },
        { date: '2026-06-28', revenue: 8400, orders: 82 },
        { date: '2026-06-29', revenue: 6200, orders: 55 },
        { date: '2026-06-30', revenue: 5900, orders: 58 },
      ],
      distributionByMarketplace: [
        { name: 'Trendyol', value: 45 },
        { name: 'Hepsiburada', value: 25 },
        { name: 'Amazon', value: 20 },
        { name: 'Own Store', value: 10 },
      ],
    };
  }

  async getOrders(filters: any) {
    return {
      funnel: [
        { status: 'New', count: 120 },
        { status: 'Processing', count: 105 },
        { status: 'Packed', count: 98 },
        { status: 'Shipped', count: 92 },
        { status: 'Delivered', count: 85 },
      ],
      statusDistribution: [
        { name: 'Pending', value: 15 },
        { name: 'Processing', value: 20 },
        { name: 'Shipped', value: 45 },
        { name: 'Delivered', value: 380 },
        { name: 'Cancelled', value: 12 },
      ]
    };
  }

  async getProducts(filters: any) {
    return {
      topSelling: [
        { id: '1', name: 'Wireless Headphones', sku: 'WH-001', sales: 145, revenue: 14500, margin: 45 },
        { id: '2', name: 'Smart Watch', sku: 'SW-002', sales: 98, revenue: 19600, margin: 35 },
        { id: '3', name: 'Bluetooth Speaker', sku: 'BS-003', sales: 85, revenue: 4250, margin: 40 },
        { id: '4', name: 'Phone Case', sku: 'PC-004', sales: 210, revenue: 3150, margin: 65 },
        { id: '5', name: 'Power Bank', sku: 'PB-005', sales: 112, revenue: 3360, margin: 30 },
      ]
    };
  }

  async getMarketplaces(filters: any) {
    return {
      performance: [
        { name: 'Trendyol', revenue: 45000, orders: 450, commission: 6750, profit: 12000, errorRate: 1.2 },
        { name: 'Hepsiburada', revenue: 25000, orders: 280, commission: 3750, profit: 6500, errorRate: 0.8 },
        { name: 'Amazon', revenue: 20000, orders: 150, commission: 2400, profit: 5800, errorRate: 2.1 },
        { name: 'Own Store', revenue: 10000, orders: 85, commission: 0, profit: 4500, errorRate: 0.1 },
      ]
    };
  }

  async getInventory(filters: any) {
    return {
      stockValue: 245000,
      criticalItems: 14,
      outOfStockItems: 5,
      fastMoving: 24,
      slowMoving: 112,
      distributionByWarehouse: [
        { name: 'Main Warehouse', value: 75 },
        { name: 'Fulfillment Center A', value: 25 },
      ]
    };
  }

  async getWarehouse(filters: any) {
    return {
      avgPickTimeMin: 12,
      avgPackTimeMin: 8,
      avgShipTimeHours: 4.5,
      tasksCompleted: 450,
      tasksPending: 56,
    };
  }

  async getShipping(filters: any) {
    return {
      distributionByCarrier: [
        { name: 'Yurtiçi Kargo', value: 65 },
        { name: 'Aras Kargo', value: 25 },
        { name: 'MNG Kargo', value: 10 },
      ],
      avgDeliveryDays: 1.8,
      delayedShipments: 12,
      labelErrors: 3,
    };
  }

  async getLogoAccounting(filters: any) {
    return {
      transferredOrders: 420,
      transferredInvoices: 415,
      failedTransfers: 5,
      pendingTransfers: 12,
      successRate: 98.8,
      errorTrend: [
        { date: 'Mon', errors: 2 },
        { date: 'Tue', errors: 0 },
        { date: 'Wed', errors: 5 },
        { date: 'Thu', errors: 1 },
        { date: 'Fri', errors: 0 },
      ]
    };
  }

  async getIntegrationHealth(filters: any) {
    return {
      totalJobs: 15420,
      successfulJobs: 15380,
      failedJobs: 40,
      successRate: 99.7,
      providers: [
        { name: 'Trendyol', status: 'healthy', latency: '120ms' },
        { name: 'Hepsiburada', status: 'healthy', latency: '95ms' },
        { name: 'Logo ERP', status: 'warning', latency: '450ms' },
        { name: 'Yurtiçi Kargo', status: 'healthy', latency: '110ms' },
      ]
    };
  }

  async getProfitability(filters: any) {
    return {
      grossRevenue: 124500,
      returnsAmount: 5200,
      cancellationsAmount: 2600,
      netRevenue: 116700,
      marketplaceCommissions: 14500,
      shippingCosts: 8400,
      cogs: 45000,
      netProfit: 48800,
      margin: 41.8,
      costDistribution: [
        { name: 'COGS', value: 45000 },
        { name: 'Commissions', value: 14500 },
        { name: 'Shipping', value: 8400 },
        { name: 'Taxes', value: 9200 },
        { name: 'Profit', value: 48800 },
      ]
    };
  }

  async getReturns(filters: any) {
    return {
      totalReturns: 45,
      returnRate: 4.2,
      reasons: [
        { name: 'Defective', value: 15 },
        { name: 'Wrong Item', value: 12 },
        { name: 'Changed Mind', value: 10 },
        { name: 'Late Delivery', value: 8 },
      ]
    };
  }

  async getAlerts(filters: any) {
    return [
      { id: 1, severity: 'critical', message: 'Logo ERP integration is responding slowly (450ms latency).', action: 'Check Integration' },
      { id: 2, severity: 'warning', message: '14 products have reached critical stock levels.', action: 'Restock Products' },
      { id: 3, severity: 'info', message: 'Return rate for "Wireless Headphones" is unusually high (8%).', action: 'Review Product' },
      { id: 4, severity: 'error', message: '5 orders failed to transfer to accounting.', action: 'View Errors' },
    ];
  }

  async exportReport(filters: any) {
    return {
      url: 'https://example.com/exports/report-123.csv',
      status: 'ready'
    };
  }
}
