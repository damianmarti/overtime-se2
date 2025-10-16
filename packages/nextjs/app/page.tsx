"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { parseEther, parseUnits } from "viem";
import { useAccount, useChainId } from "wagmi";
import { ArrowPathIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";
import { notification } from "~~/utils/scaffold-eth";

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

const COLLATERAL_DECIMALS = 6; // USDC
const SLIPPAGE = "0.01"; // 1% slippage

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const chainId = useChainId();
  // Default to Optimism (10) if no wallet connected or if on unsupported network (e.g., mainnet)
  const networkId = chainId && chainId !== 1 ? chainId : 10;

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
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  // Get contract info using hooks
  const { data: usdcContract } = useDeployedContractInfo({ contractName: "USDC" });
  const { data: sportsAMMContract } = useDeployedContractInfo({ contractName: "SportsAMMV2" });

  const COLLATERAL_ADDRESS = usdcContract?.address;
  const SPORTS_AMM_ADDRESS = sportsAMMContract?.address;

  const { writeContractAsync: tradeAsync, isMining: isTrading } = useScaffoldWriteContract({
    contractName: "SportsAMMV2",
  });

  const { writeContractAsync: approveAsync, isMining: isApproving } = useScaffoldWriteContract({
    contractName: "USDC",
  });

  // Check USDC allowance
  const { data: allowance, refetch: refetchAllowance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "allowance",
    args: [connectedAddress, SPORTS_AMM_ADDRESS],
  });

  const apiUrl = `/api/markets/${networkId}`;

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

  // Auto-fetch quote when buyInAmount or selectedPosition changes
  useEffect(() => {
    if (showQuoteModal && buyInAmount && parseInt(buyInAmount) >= 3 && selectedMarket) {
      // Clear previous quote before fetching new one
      setQuoteResponse(null);
      getQuote();
    } else if (showQuoteModal && buyInAmount && parseInt(buyInAmount) < 3) {
      // Clear quote if amount is below minimum
      setQuoteResponse(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyInAmount, selectedPosition, showQuoteModal]);

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

  // Approve USDC for spending
  const handleApprove = async () => {
    if (!buyInAmount) return;
    try {
      const parsedBuyInAmount = parseUnits(buyInAmount, COLLATERAL_DECIMALS);

      const approvalAmount = parsedBuyInAmount;

      await approveAsync({
        functionName: "approve",
        args: [SPORTS_AMM_ADDRESS, approvalAmount],
      });

      // Refetch allowance after approval
      await refetchAllowance();
    } catch (e) {
      console.error("Approval error", e);
    }
  };

  // Place bet handler
  const handlePlaceBet = async () => {
    if (!quoteResponse || !quoteResponse.quoteData || !selectedMarket) return;
    try {
      const parsedBuyInAmount = parseUnits(buyInAmount, COLLATERAL_DECIMALS);

      // Check if approval is needed
      const currentAllowance = allowance || 0n;
      if (currentAllowance < parsedBuyInAmount) {
        console.log("Insufficient allowance. Please approve USDC first.");
        return;
      }

      const tradeData = [
        {
          gameId: selectedMarket.gameId,
          sportId: selectedMarket.subLeagueId,
          typeId: selectedMarket.typeId,
          maturity: selectedMarket.maturity,
          status: selectedMarket.status,
          line: selectedMarket.line,
          playerId: selectedMarket.playerProps?.playerId,
          odds: selectedMarket.odds?.map((odd: any) => parseEther(odd.normalizedImplied.toString())) || [],
          merkleProof: selectedMarket.proof,
          position: selectedPosition,
          combinedPositions: selectedMarket.combinedPositions,
          live: false,
        },
      ];

      const normalizedImplied = quoteResponse.quoteData.totalQuote.normalizedImplied;
      const parsedTotalQuote = parseEther(normalizedImplied.toString());

      const parsedSlippage = parseEther(SLIPPAGE);

      await tradeAsync({
        functionName: "trade",
        args: [
          tradeData,
          parsedBuyInAmount,
          parsedTotalQuote,
          parsedSlippage,
          scaffoldConfig.referralAddress,
          COLLATERAL_ADDRESS,
          false,
        ],
      });
      closeQuoteModal();
    } catch (e) {
      console.error("Trade error", e);
      notification.error("Error placing bet");
    }
  };

  return (
    <>
      <div className="flex items-center flex-col grow pt-10 pb-10">
        <div className="px-5 w-full max-w-7xl">
          <h1 className="text-center mb-2">
            <span className="block text-4xl font-bold">Sports Betting Platform</span>
          </h1>

          {(initialLoad || (loading && totalMarkets === 0)) && (
            <div className="text-center py-12">
              <span className="loading loading-spinner loading-lg"></span>
              <p className="text-lg mt-4">Loading markets...</p>
            </div>
          )}

          {totalMarkets > 0 && (
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

              {Object.entries(markets).map(([sport, sportLeagues]) => {
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
                      Object.entries(sportLeagues).map(([leagueId, leagueMarkets]) => {
                        if (!Array.isArray(leagueMarkets) || leagueMarkets.length === 0) return null;

                        const leagueKey = `${sport}-${leagueId}`;
                        const isLeagueExpanded = expandedLeagues.has(leagueKey);

                        return (
                          <div key={leagueId} className="space-y-4 ml-4">
                            <div
                              className="bg-base-100 hover:bg-base-200 rounded-lg p-3 cursor-pointer transition-all border border-base-300 shadow-sm hover:shadow-md"
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
                                  <div
                                    key={index}
                                    className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow overflow-hidden"
                                  >
                                    {/* Card Header */}
                                    <div className="bg-primary text-primary-content p-2 flex flex-col items-center justify-center">
                                      <h3 className="text-lg font-bold text-center mb-0">{market.homeTeam}</h3>
                                      <p className="text-xs opacity-70 my-0">vs</p>
                                      <h3 className="text-lg font-bold text-center mb-0">{market.awayTeam}</h3>
                                    </div>

                                    {/* Sub Header */}
                                    {market.tournamentName && (
                                      <div className="bg-base-200 px-4 py-0 text-center">
                                        <p className="text-sm font-semibold">{market.tournamentName}</p>
                                      </div>
                                    )}

                                    <div className="card-body relative">
                                      {market.maturityDate && (
                                        <div className="absolute top-2 right-2 text-xs opacity-70">
                                          {new Date(market.maturityDate).toLocaleString([], {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </div>
                                      )}
                                      <div className="space-y-2 text-sm">
                                        {market.odds && market.odds.length > 0 && (
                                          <div className="mt-4">
                                            <div
                                              className={`grid gap-2 ${market.odds.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}
                                            >
                                              {(market.odds.length === 3
                                                ? [market.odds[0], market.odds[2], market.odds[1]]
                                                : market.odds
                                              ).map((odd: any, idx: number) => {
                                                const labels =
                                                  market.odds.length === 3
                                                    ? ["Home", "Draw", "Away"]
                                                    : ["Home", "Away"];
                                                return (
                                                  <div
                                                    key={idx}
                                                    className="bg-primary bg-opacity-10 p-3 rounded text-center"
                                                  >
                                                    <p className="text-xs opacity-70 mb-1">{labels[idx]}</p>
                                                    <p className="font-bold text-lg">
                                                      {odd?.decimal ? odd.decimal.toFixed(2) : odd?.american || "N/A"}
                                                    </p>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}

                                        <div className="card-actions justify-center mt-4">
                                          <button
                                            className="btn btn-primary w-full"
                                            onClick={() => openQuoteModal(market)}
                                          >
                                            Place Bet
                                          </button>
                                        </div>

                                        {/* Status badges at top left */}
                                        <div className="absolute top-2 left-2 flex gap-1 flex-wrap max-w-[50%]">
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

          {error && !initialLoad && (
            <div className="alert alert-error max-w-2xl mx-auto mb-8">
              <span>{error}</span>
            </div>
          )}

          {totalMarkets === 0 && !loading && !error && !initialLoad && lastUpdated && (
            <div className="text-center py-12">
              <p className="text-lg opacity-70">No markets available at the moment.</p>
              <button onClick={getMarkets} className="btn btn-primary mt-4">
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* About Overtime Section */}
        <div className="bg-base-300 w-full mt-16 px-8 py-16">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8">About Overtime</h2>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h3 className="card-title">What is Overtime?</h3>
                  <p>
                    <a
                      href="https://www.overtime.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-primary"
                    >
                      Overtime
                    </a>{" "}
                    is a decentralized sports betting protocol built on the blockchain. It offers transparent,
                    permissionless sports markets with instant settlements and competitive odds across multiple sports
                    and leagues.
                  </p>
                  <p className="mt-2">
                    Powered by smart contracts on Optimism, Arbitrum, and Base, Overtime eliminates the need for
                    traditional bookmakers and ensures trustless, verifiable betting outcomes.
                  </p>
                </div>
              </div>

              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h3 className="card-title">Features Implemented</h3>
                  <ul className="list-disc list-inside space-y-2">
                    <li>Browse live sports betting markets across multiple sports</li>
                    <li>Get instant quotes for your bets with real-time odds</li>
                    <li>Place bets directly on-chain with USDC</li>
                    <li>Automatic USDC approval flow for seamless transactions</li>
                    <li>View your betting history and track open/claimable/closed bets</li>
                    <li>Persistent market data storage using IndexedDB</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-center items-center gap-6 flex-wrap">
              <a
                href="https://docs.overtime.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-lg gap-2"
              >
                📚 View Documentation
              </a>
              <a
                href="https://www.overtime.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-lg gap-2"
              >
                🌐 Visit Overtime.io
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Quote Modal */}
      {showQuoteModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            {/* Header */}
            <div className="bg-primary text-primary-content p-4 -m-6 mb-6 rounded-t-2xl relative">
              <button className="btn btn-sm btn-circle btn-ghost absolute top-4 right-4" onClick={closeQuoteModal}>
                ✕
              </button>
              <div className="text-center pr-8">
                <p className="text-xl font-bold my-0">{selectedMarket?.homeTeam}</p>
                <p className="text-sm opacity-70 my-0">vs</p>
                <p className="text-xl font-bold my-0">{selectedMarket?.awayTeam}</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Position Selector */}
              <div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`btn btn-lg ${selectedPosition === 0 ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setSelectedPosition(0)}
                  >
                    <div className="text-center">
                      <div className="text-xs opacity-70">Home</div>
                      <div className="font-semibold">{selectedMarket?.homeTeam}</div>
                    </div>
                  </button>
                  <button
                    className={`btn btn-lg ${selectedPosition === 1 ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setSelectedPosition(1)}
                  >
                    <div className="text-center">
                      <div className="text-xs opacity-70">Away</div>
                      <div className="font-semibold">{selectedMarket?.awayTeam}</div>
                    </div>
                  </button>
                  {selectedMarket?.odds && selectedMarket.odds.length > 2 && (
                    <button
                      className={`btn btn-lg col-span-2 ${selectedPosition === 2 ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setSelectedPosition(2)}
                    >
                      <div className="text-center">
                        <div className="text-xs opacity-70">Draw</div>
                        <div className="font-semibold">Draw</div>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Buy In Amount Input */}
              <div>
                <input
                  type="number"
                  placeholder="Enter amount (Min: 3 USDC)"
                  className="input input-bordered input-lg w-full text-center text-2xl font-bold"
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
                  <p className="text-error text-sm mt-2">Minimum buy-in amount is 3 USDC</p>
                )}
              </div>

              {/* Loading Quote Indicator */}
              {loadingQuote && !quoteResponse && (
                <div className="bg-base-200 rounded-xl p-8 text-center">
                  <span className="loading loading-spinner loading-lg"></span>
                  <p className="mt-3 font-semibold">Getting quote...</p>
                </div>
              )}

              {/* Quote Response */}
              {quoteResponse && !loadingQuote && (
                <div className="bg-base-200 rounded-xl p-6">
                  {quoteResponse.quoteData?.error ? (
                    <div className="alert alert-error">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="stroke-current shrink-0 h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>{quoteResponse.quoteData.error}</span>
                    </div>
                  ) : quoteResponse.error ? (
                    <div className="alert alert-error">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="stroke-current shrink-0 h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>{quoteResponse.error}</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        {/* Buy In Amount */}
                        {quoteResponse.quoteData?.buyInAmountInUsd && (
                          <div className="bg-base-100 p-2 rounded-xl text-center">
                            <p className="text-xs opacity-70 mb-0 mt-0">Buy In</p>
                            <p className="font-bold text-lg mb-0 mt-1">
                              ${quoteResponse.quoteData.buyInAmountInUsd?.toFixed(2)}
                            </p>
                          </div>
                        )}

                        {/* Total Quote */}
                        <div className="bg-base-100 p-2 rounded-xl text-center">
                          <p className="text-xs opacity-70 mb-0 mt-0">Odds</p>
                          <p className="font-bold text-lg mb-0 mt-1">
                            {quoteResponse.quoteData?.totalQuote?.decimal?.toFixed(2)}
                          </p>
                        </div>

                        {/* Payout */}
                        {quoteResponse.quoteData?.payout && (
                          <div className="bg-base-100 p-2 rounded-xl text-center">
                            <p className="text-xs opacity-70 mb-0 mt-0">Payout</p>
                            <p className="font-bold text-lg mb-0 mt-1">
                              ${quoteResponse.quoteData.payout.usd?.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Potential Profit - Highlighted */}
                      {quoteResponse.quoteData?.potentialProfit && (
                        <div className="bg-success bg-opacity-10 p-4 rounded-xl border-2 border-success">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-xs font-semibold opacity-70 mb-0 mt-0">Potential Profit</p>
                              <p className="font-bold text-2xl mb-0 mt-1">
                                ${quoteResponse.quoteData.potentialProfit.usd?.toFixed(2)}
                              </p>
                            </div>
                            {quoteResponse.quoteData.potentialProfit.percentage && (
                              <div className="badge badge-success badge-lg text-lg font-bold">
                                +{(quoteResponse.quoteData.potentialProfit.percentage * 100).toFixed(2)}%
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Available Liquidity */}
                      {quoteResponse.liquidityData?.ticketLiquidityInUsd && (
                        <div className="text-center pt-0">
                          <p className="text-xs opacity-70 mt-0 mb-0">
                            Available Liquidity:{" "}
                            <span className="font-semibold">
                              ${quoteResponse.liquidityData.ticketLiquidityInUsd?.toFixed(2)}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Approve & Place Bet Buttons */}
            {quoteResponse && !quoteResponse.error && !quoteResponse.quoteData?.error && (
              <div className="flex flex-col gap-3 mt-6">
                {(() => {
                  const parsedBuyInAmount = parseUnits(buyInAmount, COLLATERAL_DECIMALS);
                  const currentAllowance = allowance || 0n;
                  const needsApproval = currentAllowance < parsedBuyInAmount;

                  return (
                    <>
                      {needsApproval && (
                        <button
                          className="btn btn-warning btn-lg w-full"
                          onClick={handleApprove}
                          disabled={isApproving}
                        >
                          {isApproving ? (
                            <>
                              <span className="loading loading-spinner"></span>
                              Approving USDC...
                            </>
                          ) : (
                            <>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Approve USDC
                            </>
                          )}
                        </button>
                      )}
                      <button
                        className="btn btn-success btn-lg w-full text-lg"
                        onClick={handlePlaceBet}
                        disabled={isTrading || needsApproval}
                      >
                        {isTrading ? (
                          <>
                            <span className="loading loading-spinner"></span>
                            Placing Bet...
                          </>
                        ) : needsApproval ? (
                          "Approve USDC First"
                        ) : (
                          <>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-6 w-6"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Confirm Bet
                          </>
                        )}
                      </button>
                    </>
                  );
                })()}
              </div>
            )}

            <div className="modal-action mt-6">
              <button className="btn btn-ghost w-full" onClick={closeQuoteModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Home;
