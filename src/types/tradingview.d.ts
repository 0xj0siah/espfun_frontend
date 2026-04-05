/**
 * Type declarations for TradingView Charting Library.
 *
 * The library is loaded as static assets from public/charting_library/.
 * These types cover the subset we use — see the full .d.ts in charting_library/
 * for the complete API surface.
 */

declare global {
  interface Window {
    TradingView?: {
      widget: ChartingLibraryWidgetConstructor;
    };
  }
}

// --- Widget ---

export interface ChartingLibraryWidgetConstructor {
  new (options: ChartingLibraryWidgetOptions): IChartingLibraryWidget;
}

export interface ChartingLibraryWidgetOptions {
  container: HTMLElement | string;
  datafeed: IBasicDataFeed;
  interval: ResolutionString;
  symbol?: string;
  library_path?: string;
  locale?: string;
  autosize?: boolean;
  fullscreen?: boolean;
  debug?: boolean;
  theme?: 'Light' | 'Dark';
  timezone?: string;
  toolbar_bg?: string;
  width?: number;
  height?: number;
  disabled_features?: string[];
  enabled_features?: string[];
  overrides?: Record<string, string | number | boolean>;
  studies_overrides?: Record<string, string | number | boolean>;
  loading_screen?: { backgroundColor?: string; foregroundColor?: string };
  custom_css_url?: string;
  timeframe?: string;
  time_frames?: TimeFrameItem[];
  saved_data?: object;
  auto_save_delay?: number;
  symbol_search_request_delay?: number;
}

export interface TimeFrameItem {
  text: string;
  resolution: ResolutionString;
  description?: string;
  title?: string;
}

export interface IChartingLibraryWidget {
  onChartReady(callback: () => void): void;
  headerReady(): Promise<void>;
  remove(): void;
  activeChart(): IChartWidgetApi;
  applyOverrides(overrides: Record<string, string | number | boolean>): void;
  changeTheme(theme: 'Light' | 'Dark'): Promise<void>;
  save(callback: (state: object) => void): void;
  load(state: object): void;
}

export interface IChartWidgetApi {
  setSymbol(symbol: string, callback?: () => void): void;
  setResolution(resolution: ResolutionString, callback?: () => void): void;
  createStudy(
    name: string,
    forceOverlay: boolean,
    lock?: boolean,
    inputs?: any[],
    overrides?: Record<string, any>,
    options?: { checkLimit?: boolean; priceScale?: string }
  ): Promise<string | null>;
  resetData(): void;
}

// --- Datafeed ---

export type ResolutionString = string;

export interface DatafeedConfiguration {
  exchanges?: DatafeedExchange[];
  symbols_types?: DatafeedSymbolType[];
  supported_resolutions?: ResolutionString[];
  supports_marks?: boolean;
  supports_timescale_marks?: boolean;
  supports_time?: boolean;
  supports_search?: boolean;
  supports_group_request?: boolean;
}

export interface DatafeedExchange {
  value: string;
  name: string;
  desc: string;
}

export interface DatafeedSymbolType {
  name: string;
  value: string;
}

export interface IBasicDataFeed extends IExternalDatafeed, IDatafeedChartApi {}

export interface IExternalDatafeed {
  onReady(callback: OnReadyCallback): void;
}

export type OnReadyCallback = (configuration: DatafeedConfiguration) => void;

export interface IDatafeedChartApi {
  searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    onResult: SearchSymbolsCallback
  ): void;
  resolveSymbol(
    symbolName: string,
    onResolve: ResolveCallback,
    onError: DatafeedErrorCallback,
    extension?: SymbolResolveExtension
  ): void;
  getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: PeriodParams,
    onResult: HistoryCallback,
    onError: DatafeedErrorCallback
  ): void;
  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onTick: SubscribeBarsCallback,
    listenerGuid: string,
    onResetCacheNeededCallback: () => void
  ): void;
  unsubscribeBars(listenerGuid: string): void;
}

export type SearchSymbolsCallback = (items: SearchSymbolResultItem[]) => void;
export type ResolveCallback = (symbolInfo: LibrarySymbolInfo) => void;
export type DatafeedErrorCallback = (reason: string) => void;
export type HistoryCallback = (bars: Bar[], meta?: HistoryMetadata) => void;
export type SubscribeBarsCallback = (bar: Bar) => void;

export interface SymbolResolveExtension {
  currencyCode?: string;
  unitId?: string;
  session?: string;
}

export interface SearchSymbolResultItem {
  symbol: string;
  full_name: string;
  description: string;
  exchange: string;
  ticker?: string;
  type: string;
}

export interface LibrarySymbolInfo {
  name: string;
  ticker?: string;
  description: string;
  type: string;
  session: string;
  exchange: string;
  listed_exchange: string;
  timezone: string;
  format: 'price' | 'volume';
  pricescale: number;
  minmov: number;
  has_intraday?: boolean;
  has_daily?: boolean;
  has_weekly_and_monthly?: boolean;
  supported_resolutions?: ResolutionString[];
  intraday_multipliers?: string[];
  volume_precision?: number;
  data_status?: string;
  visible_plots_set?: string;
}

export interface PeriodParams {
  from: number;
  to: number;
  countBack: number;
  firstDataRequest: boolean;
}

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface HistoryMetadata {
  noData?: boolean;
  nextTime?: number;
}

export {};
