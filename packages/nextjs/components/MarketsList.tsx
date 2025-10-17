import React, { useEffect, useState } from "react";
import { MarketCard } from "./MarketCard";
import { useChainId } from "wagmi";
import { ArrowPathIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import scaffoldConfig from "~~/scaffold.config";

// IndexedDB utility functions
const DB_NAME = "OvertimeMarketsDB";
const DB_VERSION = 1;
const STORE_NAME = "markets";

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

const saveToIndexedDB = async (key: string, value: any): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

const getFromIndexedDB = async (key: string): Promise<any> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

interface MarketsListProps {
  onPlaceBet: (market: any) => void;
}

export const MarketsList: React.FC<MarketsListProps> = ({ onPlaceBet }) => {
  const chainId = useChainId();
  // Default to Optimism (10) if no wallet connected or if on unsupported network (e.g., mainnet)
  const networkId = chainId && chainId !== 1 ? chainId : 10;

  const [markets, setMarkets] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [expandedSports, setExpandedSports] = useState<Set<string>>(new Set());
  const [expandedLeagues, setExpandedLeagues] = useState<Set<string>>(new Set());

  const apiUrl = `/api/markets/${networkId}`;

  // Calculate total markets - structure is: { Sport: { LeagueId: [markets] } }
  const totalMarkets = Object.values(markets).reduce((sportAcc, sportLeagues) => {
    const sportTotal = Object.values(sportLeagues).reduce((leagueAcc, leagueMarkets) => {
      return leagueAcc + (Array.isArray(leagueMarkets) ? leagueMarkets.length : 0);
    }, 0);
    return sportAcc + sportTotal;
  }, 0);

  // Load markets from IndexedDB on mount, or fetch from API if no cache
  useEffect(() => {
    const loadMarkets = async () => {
      setError(null);
      try {
        const savedMarkets = await getFromIndexedDB("overtime-markets");
        const savedTimestamp = await getFromIndexedDB("overtime-markets-timestamp");

        // Check if cached data is valid (not an error object)
        if (savedMarkets && Object.keys(savedMarkets).length > 0 && !savedMarkets.error) {
          // Check if cached data is older than configured duration
          const cacheAge = savedTimestamp ? Date.now() - new Date(savedTimestamp).getTime() : Infinity;

          if (cacheAge > scaffoldConfig.marketsCacheDuration) {
            console.log(
              `Cached data is older than ${scaffoldConfig.marketsCacheDuration / 1000 / 60} minutes, fetching fresh data from API...`,
            );
            // Load cached data first for instant display
            setMarkets(savedMarkets);
            if (savedTimestamp) {
              setLastUpdated(savedTimestamp);
            }
            setDataSource("Cache");
            setInitialLoad(false);
            // Then fetch fresh data in the background
            await getMarkets();
          } else {
            setMarkets(savedMarkets);
            if (savedTimestamp) {
              setLastUpdated(savedTimestamp);
            }
            setDataSource("Cache");
            console.log("✅ Markets loaded from IndexedDB");
            console.log("Cached markets structure:", Object.keys(savedMarkets));
            console.log("Total sports:", Object.keys(savedMarkets).length);
            setInitialLoad(false);
          }
        } else {
          // No cached data or cached error, fetch from API
          if (savedMarkets?.error) {
            console.log("Cached data contains error, clearing and fetching from API...");
          } else {
            console.log("No cached data found, fetching from API...");
          }
          await getMarkets();
        }
      } catch (error) {
        console.error("Error loading saved markets from IndexedDB:", error);
        // On error, try to fetch from API
        await getMarkets();
      } finally {
        setInitialLoad(false);
      }
    };

    if (networkId) {
      loadMarkets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkId]);

  const getMarkets = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Fetching markets from:", apiUrl);
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();

      // Check if response is an error object
      if (data.error) {
        throw new Error(data.error);
      }

      console.log("Markets fetched:", Object.keys(data).length, "sports");
      setMarkets(data);
      setDataSource("Overtime API");

      // Save to IndexedDB with timestamp - only save valid market data
      const timestamp = new Date().toISOString();
      try {
        await saveToIndexedDB("overtime-markets", data);
        await saveToIndexedDB("overtime-markets-timestamp", timestamp);
        setLastUpdated(timestamp);
        console.log("✅ Markets loaded from Overtime API and saved to IndexedDB");
      } catch (storageError) {
        console.error("Error saving to IndexedDB:", storageError);
        // Still update the timestamp even if save fails
        setLastUpdated(timestamp);
      }
    } catch (error) {
      console.error("Error fetching markets:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch markets";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleSport = (sport: string) => {
    setExpandedSports(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sport)) {
        newSet.delete(sport);
      } else {
        newSet.add(sport);
      }
      return newSet;
    });
  };

  const toggleLeague = (leagueKey: string) => {
    setExpandedLeagues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leagueKey)) {
        newSet.delete(leagueKey);
      } else {
        newSet.add(leagueKey);
      }
      return newSet;
    });
  };
  if (initialLoad || (loading && totalMarkets === 0)) {
    return (
      <div className="text-center py-12">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="text-lg mt-4">Loading markets...</p>
      </div>
    );
  }

  if (totalMarkets > 0) {
    return (
      <div className="mt-4 space-y-12">
        <h2 className="text-2xl font-bold mb-0 text-center">Available Markets ({totalMarkets})</h2>

        <div className="flex items-center justify-center gap-4 mb-8 mt-0 flex-wrap">
          {lastUpdated && (
            <p className="text-sm opacity-70 my-1">
              {dataSource && (
                <span
                  className={`mr-2 badge badge-sm ${dataSource === "Overtime API" ? "badge-success" : "badge-info"}`}
                >
                  Loaded from {dataSource}
                </span>
              )}
              Last updated: {new Date(lastUpdated).toLocaleString()}
            </p>
          )}
          <button onClick={getMarkets} className="btn btn-success btn-xs" disabled={loading}>
            {loading ? (
              <>
                <span className="loading loading-spinner"></span>
                Loading Markets...
              </>
            ) : (
              <>
                <ArrowPathIcon className="h-4 w-4" />
                Refresh
              </>
            )}
          </button>
        </div>

        {Object.entries(markets)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([sport, sportLeagues]) => {
            // Count markets for this sport
            const sportMarketCount = Object.values(sportLeagues).reduce(
              (acc, leagues) => acc + (Array.isArray(leagues) ? leagues.length : 0),
              0,
            );
            const isSportExpanded = expandedSports.has(sport);

            return (
              <div key={sport} className="space-y-4 mb-6">
                <div
                  className="bg-base-200 hover:bg-base-300 rounded-xl p-4 cursor-pointer transition-all shadow-md"
                  onClick={() => toggleSport(sport)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="btn btn-ghost btn-sm btn-circle">
                        {isSportExpanded ? (
                          <ChevronUpIcon className="h-5 w-5" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5" />
                        )}
                      </div>
                      <h3 className="text-xl font-bold capitalize">{sport}</h3>
                    </div>
                    <div className="badge badge-primary badge-lg">
                      {sportMarketCount} {sportMarketCount === 1 ? "market" : "markets"}
                    </div>
                  </div>
                </div>

                {isSportExpanded &&
                  Object.entries(sportLeagues)
                    .sort(([aId, aMarkets], [bId, bMarkets]) => {
                      const aName = (Array.isArray(aMarkets) && aMarkets[0]?.leagueName) || `League ${aId}`;
                      const bName = (Array.isArray(bMarkets) && bMarkets[0]?.leagueName) || `League ${bId}`;
                      return aName.localeCompare(bName);
                    })
                    .map(([leagueId, leagueMarkets]) => {
                      if (!Array.isArray(leagueMarkets) || leagueMarkets.length === 0) return null;

                      const leagueKey = `${sport}-${leagueId}`;
                      const isLeagueExpanded = expandedLeagues.has(leagueKey);

                      return (
                        <div key={leagueId} className="space-y-4 ml-4">
                          <div
                            className="bg-base-100 hover:bg-base-200 rounded-lg p-4 cursor-pointer transition-all border border-base-300 shadow-sm hover:shadow-md"
                            onClick={() => toggleLeague(leagueKey)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="btn btn-ghost btn-xs btn-circle">
                                  {isLeagueExpanded ? (
                                    <ChevronUpIcon className="h-4 w-4" />
                                  ) : (
                                    <ChevronDownIcon className="h-4 w-4" />
                                  )}
                                </div>
                                <h4 className="text-md font-semibold">
                                  {leagueMarkets[0]?.leagueName || `League ${leagueId}`}
                                </h4>
                              </div>
                              <div className="badge badge-secondary">
                                {leagueMarkets.length} {leagueMarkets.length === 1 ? "market" : "markets"}
                              </div>
                            </div>
                          </div>

                          {isLeagueExpanded && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {leagueMarkets.map((market, index) => (
                                <MarketCard key={index} market={market} onPlaceBet={() => onPlaceBet(market)} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
              </div>
            );
          })}
      </div>
    );
  }

  if (error && !initialLoad) {
    return (
      <div className="alert alert-error max-w-2xl mx-auto mb-8">
        <span>{error}</span>
      </div>
    );
  }

  if (totalMarkets === 0 && !loading && !error && !initialLoad && lastUpdated) {
    return (
      <div className="text-center py-12">
        <p className="text-lg opacity-70">No markets available at the moment.</p>
        <button onClick={getMarkets} className="btn btn-primary mt-4">
          Try Again
        </button>
      </div>
    );
  }

  return null;
};
