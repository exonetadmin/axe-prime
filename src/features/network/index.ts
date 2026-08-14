/**
 * Network Feature - Public API (MLM Unilevel).
 * Export only contract and service; no internal types unless needed by portal.
 */

export type {
  NetworkContract,
  NetworkMember,
  NetworkLevel,
  RedeUnilevel,
  NetworkTreeNode,
  PositionLevel,
  PositionInfo,
  EarningsSummary,
  CashbackSummary,
  NetworkCommissionSummary,
  DashboardSummary,
} from './network.contract';

export {
  COMMISSION_DIRECT_PCT,
  COMMISSION_NETWORK_PCT,
  COMMISSION_NETWORK_MAX_PCT,
  COMMISSION_MONTHS,
  CASHBACK_DEFAULT_PCT,
  CASHBACK_HIGH_TIER_THRESHOLD_CENTS,
  CASHBACK_HIGH_TIER_PCT,
  POSITION_LEVELS,
} from './network.contract';

export { NetworkService, networkService } from './services/network.service';
