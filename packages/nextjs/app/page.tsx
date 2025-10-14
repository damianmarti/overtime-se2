"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { BugAntIcon, ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Address } from "~~/components/scaffold-eth";

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

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const networkId = 10;
  const [markets, setMarkets] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string | null>(null);
  const [expandedSports, setExpandedSports] = useState<Set<string>>(new Set());
  const [expandedLeagues, setExpandedLeagues] = useState<Set<string>>(new Set());
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<number>(0);
  const [quoteResponse, setQuoteResponse] = useState<any>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);

  const apiUrl = "/api/markets";

  // Load markets from IndexedDB on mount
  useEffect(() => {
    const loadMarkets = async () => {
      try {
        const savedMarkets = await getFromIndexedDB("overtime-markets");
        const savedTimestamp = await getFromIndexedDB("overtime-markets-timestamp");

        if (savedMarkets) {
          setMarkets(savedMarkets);
          if (savedTimestamp) {
            setLastUpdated(savedTimestamp);
          }
          setDataSource("IndexedDB");
          console.log("✅ Markets loaded from IndexedDB");
        }
      } catch (error) {
        console.error("Error loading saved markets from IndexedDB:", error);
      }
    };

    loadMarkets();
  }, []);

  const getMarkets = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      console.log(data);
      setMarkets(data);
      setDataSource("Overtime API");

      // Save to IndexedDB with timestamp
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
    } finally {
      setLoading(false);
    }
  };

  // Calculate total markets - structure is: { Sport: { LeagueId: [markets] } }
  const totalMarkets = Object.values(markets).reduce((sportAcc, sportLeagues) => {
    const sportTotal = Object.values(sportLeagues).reduce((leagueAcc, leagueMarkets) => {
      return leagueAcc + (Array.isArray(leagueMarkets) ? leagueMarkets.length : 0);
    }, 0);
    return sportAcc + sportTotal;
  }, 0);

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

  const toggleLeague = (leagueId: string) => {
    setExpandedLeagues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leagueId)) {
        newSet.delete(leagueId);
      } else {
        newSet.add(leagueId);
      }
      return newSet;
    });
  };

  const openQuoteModal = (market: any) => {
    setSelectedMarket(market);
    setShowQuoteModal(true);
    setBuyInAmount("");
    setSelectedPosition(0);
    setQuoteResponse(null);
  };

  const closeQuoteModal = () => {
    setShowQuoteModal(false);
    setSelectedMarket(null);
    setBuyInAmount("");
    setSelectedPosition(0);
    setQuoteResponse(null);
  };

  const getQuote = async () => {
    if (!buyInAmount || !selectedMarket) return;

    setLoadingQuote(true);
    try {
      const tradeDataPayload = [
        {
          gameId: selectedMarket.gameId,
          sportId: selectedMarket.subLeagueId,
          typeId: selectedMarket.typeId,
          maturity: selectedMarket.maturity,
          status: selectedMarket.status,
          line: selectedMarket.line,
          playerId: selectedMarket.playerProps?.playerId,
          odds: selectedMarket.odds?.map((odd: any) => odd.normalizedImplied) || [],
          merkleProof: selectedMarket.proof,
          position: selectedPosition,
          combinedPositions: selectedMarket.combinedPositions,
          live: false,
        },
      ];

      const payload = {
        buyInAmount: parseInt(buyInAmount),
        tradeData: tradeDataPayload,
      };

      console.log("Sending quote request:", payload);
      console.log("Selected market:", selectedMarket);

      const response = await fetch(`https://api.overtime.io/overtime-v2/networks/${networkId}/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.NEXT_PUBLIC_OVERTIME_API_KEY || "",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      console.log("Quote response:", data);
      setQuoteResponse(data);
    } catch (error) {
      console.error("Error fetching quote:", error);
      setQuoteResponse({ error: "Failed to fetch quote" });
    } finally {
      setLoadingQuote(false);
    }
  };

  console.log(markets);

  return (
    <>
      <div className="flex items-center flex-col grow pt-10 pb-10">
        <div className="px-5 w-full max-w-7xl">
          <h1 className="text-center mb-8">
            <span className="block text-2xl mb-2">Overtime Markets</span>
            <span className="block text-4xl font-bold">Sports Betting Platform</span>
          </h1>

          <div className="flex justify-center items-center space-x-2 flex-col mb-6">
            <p className="my-2 font-medium">Connected Address:</p>
            <Address address={connectedAddress} />
          </div>

          <div className="flex flex-col items-center gap-3 mb-8">
            <button onClick={getMarkets} className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? (
                <>
                  <span className="loading loading-spinner"></span>
                  Loading Markets...
                </>
              ) : (
                "Load Markets"
              )}
            </button>

            {lastUpdated && (
              <div className="text-center">
                <p className="text-sm opacity-70">Last updated: {new Date(lastUpdated).toLocaleString()}</p>
                {dataSource && (
                  <p className="text-xs mt-1">
                    <span
                      className={`badge badge-sm ${dataSource === "Overtime API" ? "badge-success" : "badge-info"}`}
                    >
                      Loaded from {dataSource}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          {totalMarkets > 0 && (
            <div className="mt-8 space-y-12">
              <h2 className="text-2xl font-bold mb-6 text-center">Available Markets ({totalMarkets})</h2>

              {Object.entries(markets).map(([sport, sportLeagues]) => {
                // Count markets for this sport
                const sportMarketCount = Object.values(sportLeagues).reduce(
                  (acc, leagues) => acc + (Array.isArray(leagues) ? leagues.length : 0),
                  0,
                );
                const isSportExpanded = expandedSports.has(sport);

                return (
                  <div key={sport} className="space-y-6">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleSport(sport)}
                        className="btn btn-ghost btn-sm btn-circle"
                        aria-label={isSportExpanded ? "Collapse" : "Expand"}
                      >
                        {isSportExpanded ? (
                          <ChevronUpIcon className="h-5 w-5" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5" />
                        )}
                      </button>
                      <h3 className="text-xl font-bold capitalize flex items-center gap-2">
                        <span className="badge badge-lg badge-primary">{sport}</span>
                        <span className="text-sm opacity-70">({sportMarketCount} markets)</span>
                      </h3>
                    </div>

                    {isSportExpanded &&
                      Object.entries(sportLeagues).map(([leagueId, leagueMarkets]) => {
                        if (!Array.isArray(leagueMarkets) || leagueMarkets.length === 0) return null;

                        const leagueKey = `${sport}-${leagueId}`;
                        const isLeagueExpanded = expandedLeagues.has(leagueKey);

                        return (
                          <div key={leagueId} className="space-y-4">
                            <div className="flex items-center gap-2 ml-4">
                              <button
                                onClick={() => toggleLeague(leagueKey)}
                                className="btn btn-ghost btn-sm btn-circle"
                                aria-label={isLeagueExpanded ? "Collapse" : "Expand"}
                              >
                                {isLeagueExpanded ? (
                                  <ChevronUpIcon className="h-4 w-4" />
                                ) : (
                                  <ChevronDownIcon className="h-4 w-4" />
                                )}
                              </button>
                              <h4 className="text-md font-semibold flex items-center gap-2">
                                <span className="badge badge-secondary">
                                  {leagueMarkets[0]?.leagueName || `League ${leagueId}`}
                                </span>
                                <span className="text-sm opacity-70">({leagueMarkets.length} markets)</span>
                              </h4>
                            </div>

                            {isLeagueExpanded && (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {leagueMarkets.map((market, index) => (
                                  <div
                                    key={index}
                                    className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow"
                                  >
                                    <div className="card-body">
                                      <h3 className="card-title text-lg">
                                        {market.homeTeam} vs {market.awayTeam}
                                      </h3>

                                      <div className="space-y-2 text-sm">
                                        <div className="flex gap-2 flex-wrap">
                                          {market.sport && (
                                            <span className="badge badge-secondary badge-sm">{market.sport}</span>
                                          )}
                                          {market.isOpen && <span className="badge badge-success badge-sm">Open</span>}
                                          {market.isPaused && (
                                            <span className="badge badge-warning badge-sm">Paused</span>
                                          )}
                                          {market.isResolved && (
                                            <span className="badge badge-info badge-sm">Resolved</span>
                                          )}
                                          {market.isCancelled && (
                                            <span className="badge badge-error badge-sm">Cancelled</span>
                                          )}
                                        </div>

                                        {market.tournamentName && (
                                          <p>
                                            <span className="font-semibold">Tournament:</span> {market.tournamentName}
                                          </p>
                                        )}

                                        {market.maturityDate && (
                                          <p>
                                            <span className="font-semibold">Date:</span>{" "}
                                            {new Date(market.maturityDate).toLocaleString()}
                                          </p>
                                        )}

                                        {market.type && (
                                          <p>
                                            <span className="font-semibold">Type:</span> {market.type}
                                          </p>
                                        )}

                                        {market.odds && market.odds.length > 0 && (
                                          <div className="mt-3">
                                            <p className="font-semibold mb-2">Odds:</p>
                                            <div className="grid grid-cols-2 gap-2">
                                              {market.odds.map((odd: any, idx: number) => (
                                                <div key={idx} className="bg-base-200 p-2 rounded">
                                                  <p className="text-xs opacity-70">
                                                    {idx === 0 ? "Home" : idx === 1 ? "Away" : `Option ${idx + 1}`}
                                                  </p>
                                                  <p className="font-bold">
                                                    {odd?.decimal ? odd.decimal.toFixed(2) : odd?.american || "N/A"}
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        <div className="card-actions justify-end mt-4">
                                          <button
                                            className="btn btn-sm btn-primary"
                                            onClick={() => openQuoteModal(market)}
                                          >
                                            Place Bet
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
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
          )}

          {totalMarkets === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-lg opacity-70">No markets loaded yet. Click the button above to fetch markets.</p>
            </div>
          )}
        </div>

        <div className="bg-base-300 w-full mt-16 px-8 py-12">
          <div className="flex justify-center items-center gap-12 flex-col md:flex-row max-w-7xl mx-auto">
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <BugAntIcon className="h-8 w-8 fill-secondary" />
              <p>
                Tinker with your smart contract using the{" "}
                <Link href="/debug" passHref className="link">
                  Debug Contracts
                </Link>{" "}
                tab.
              </p>
            </div>
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <MagnifyingGlassIcon className="h-8 w-8 fill-secondary" />
              <p>
                Explore your local transactions with the{" "}
                <Link href="/blockexplorer" passHref className="link">
                  Block Explorer
                </Link>{" "}
                tab.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quote Modal */}
      {showQuoteModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">
              Get Quote: {selectedMarket?.homeTeam} vs {selectedMarket?.awayTeam}
            </h3>

            <div className="space-y-4">
              {/* Position Selector */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Select Position</span>
                </label>
                <div className="flex gap-2">
                  <button
                    className={`btn flex-1 ${selectedPosition === 0 ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setSelectedPosition(0)}
                  >
                    Home: {selectedMarket?.homeTeam}
                  </button>
                  <button
                    className={`btn flex-1 ${selectedPosition === 1 ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setSelectedPosition(1)}
                  >
                    Away: {selectedMarket?.awayTeam}
                  </button>
                  {selectedMarket?.odds && selectedMarket.odds.length > 2 && (
                    <button
                      className={`btn flex-1 ${selectedPosition === 2 ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setSelectedPosition(2)}
                    >
                      Draw
                    </button>
                  )}
                </div>
              </div>

              {/* Buy In Amount Input */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Buy In Amount (USD)</span>
                  <span className="label-text-alt text-xs opacity-70">Min: 3 USDC</span>
                </label>
                <input
                  type="number"
                  placeholder="Enter amount (minimum 3 USDC)"
                  className="input input-bordered w-full"
                  value={buyInAmount}
                  onChange={e => {
                    const value = e.target.value;
                    // Only allow integers
                    if (value === "" || /^\d+$/.test(value)) {
                      setBuyInAmount(value);
                    }
                  }}
                  min="3"
                  step="1"
                />
                {buyInAmount && parseInt(buyInAmount) < 3 && (
                  <label className="label">
                    <span className="label-text-alt text-error">Minimum buy-in amount is 3 USDC</span>
                  </label>
                )}
              </div>

              {/* Get Quote Button */}
              <div className="flex gap-2">
                <button
                  className="btn btn-primary"
                  onClick={getQuote}
                  disabled={loadingQuote || !buyInAmount || parseInt(buyInAmount) < 3}
                >
                  {loadingQuote ? (
                    <>
                      <span className="loading loading-spinner"></span>
                      Getting Quote...
                    </>
                  ) : (
                    "Get Quote"
                  )}
                </button>
              </div>

              {/* Quote Response */}
              {quoteResponse && (
                <div className="mt-6 p-4 bg-base-200 rounded-lg">
                  {quoteResponse.quoteData?.error ? (
                    <div className="alert alert-error">
                      <span>{quoteResponse.quoteData.error}</span>
                    </div>
                  ) : quoteResponse.error ? (
                    <div className="alert alert-error">
                      <span>{quoteResponse.error}</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h4 className="font-bold text-base">Quote Summary</h4>

                      <div className="grid grid-cols-3 gap-2">
                        {/* Buy In Amount */}
                        {quoteResponse.quoteData?.buyInAmountInUsd && (
                          <div className="bg-base-100 p-2 rounded border border-base-300">
                            <p className="text-xs opacity-70">Buy In</p>
                            <p className="font-bold text-sm">${quoteResponse.quoteData.buyInAmountInUsd?.toFixed(2)}</p>
                          </div>
                        )}

                        {/* Total Quote */}
                        <div className="bg-base-100 p-2 rounded border border-base-300">
                          <p className="text-xs opacity-70">Odds</p>
                          <p className="font-bold text-sm">
                            {quoteResponse.quoteData?.totalQuote?.decimal?.toFixed(2)}
                          </p>
                        </div>

                        {/* Payout */}
                        {quoteResponse.quoteData?.payout && (
                          <div className="bg-base-100 p-2 rounded border border-base-300">
                            <p className="text-xs opacity-70">Payout</p>
                            <p className="font-bold text-sm">${quoteResponse.quoteData.payout.usd?.toFixed(2)}</p>
                          </div>
                        )}
                      </div>

                      {/* Potential Profit - Highlighted */}
                      {quoteResponse.quoteData?.potentialProfit && (
                        <div className="bg-success bg-opacity-10 p-2 rounded border-2 border-success">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-xs font-semibold">Profit</p>
                              <p className="font-bold text-lg">
                                ${quoteResponse.quoteData.potentialProfit.usd?.toFixed(2)}
                              </p>
                            </div>
                            {quoteResponse.quoteData.potentialProfit.percentage && (
                              <div className="badge badge-success">
                                +{(quoteResponse.quoteData.potentialProfit.percentage * 100).toFixed(2)}%
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Available Liquidity */}
                      {quoteResponse.liquidityData?.ticketLiquidityInUsd && (
                        <div className="text-center">
                          <p className="text-sm opacity-70">
                            Available Liquidity: ${quoteResponse.liquidityData.ticketLiquidityInUsd?.toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-action">
              <button className="btn" onClick={closeQuoteModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Home;
