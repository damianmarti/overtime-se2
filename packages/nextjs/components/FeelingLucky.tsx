"use client";

import React, { useState } from "react";
import { MarketCard } from "./MarketCard";
import { type Address, parseEther, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";
import { notification } from "~~/utils/scaffold-eth";

interface FeelingLuckyProps {
  endingSoonMarkets: any[];
  networkId: number;
}

export const FeelingLucky: React.FC<FeelingLuckyProps> = ({ endingSoonMarkets, networkId }) => {
  const { address: connectedAddress } = useAccount();
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

  const [isPlacingLucky, setIsPlacingLucky] = useState(false);
  const [luckyResult, setLuckyResult] = useState<{ market: any; position: number; amount: number } | null>(null);
  const [luckyError, setLuckyError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<any | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [quoteResponse, setQuoteResponse] = useState<any | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  // approval is derived from on-chain allowance; no separate local flag

  // Read USDC allowance to decide if Approve is needed
  const readAllowanceHook = useScaffoldReadContract as any;
  const { data: allowance, refetch: refetchAllowance } = readAllowanceHook({
    contractName: "USDC",
    functionName: "allowance",
    args: [
      (connectedAddress ?? "0x0000000000000000000000000000000000000000") as Address,
      (SPORTS_AMM_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address,
    ],
  });

  const getMaxOddsIndex = (market: any): number => {
    if (!market?.odds || market.odds.length === 0) return 0;
    const toDecimal = (odd: any): number => {
      if (typeof odd?.decimal === "number") return odd.decimal;
      if (typeof odd?.american === "number") {
        const a = odd.american;
        return a >= 0 ? 1 + a / 100 : 1 + 100 / Math.abs(a);
      }
      return -Infinity;
    };
    let maxIdx = 0;
    let maxVal = -Infinity;
    market.odds.forEach((o: any, idx: number) => {
      const v = toDecimal(o);
      if (v > maxVal) {
        maxVal = v;
        maxIdx = idx;
      }
    });
    return maxIdx;
  };

  const requestQuote = async ({
    market,
    position,
    amountUsd,
  }: {
    market: any;
    position: number;
    amountUsd: number;
  }) => {
    const tradeDataPayload = [
      {
        gameId: market.gameId,
        sportId: market.subLeagueId,
        typeId: market.typeId,
        maturity: market.maturity,
        status: market.status,
        line: market.line,
        playerId: market.playerProps?.playerId,
        odds: market.odds?.map((odd: any) => odd.normalizedImplied) || [],
        merkleProof: market.proof,
        position,
        combinedPositions: market.combinedPositions,
        live: false,
      },
    ];
    const payload = { buyInAmount: amountUsd, tradeData: tradeDataPayload };
    const res = await fetch(`https://api.overtime.io/overtime-v2/networks/${networkId}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.NEXT_PUBLIC_OVERTIME_API_KEY || "" },
      body: JSON.stringify(payload),
    });
    return res.json();
  };

  // no-op on amount change; approval derived from allowance

  // Determine if approval is needed based on allowance
  const needsApproval = (() => {
    if (!selectedAmount) return false;
    const required = parseUnits(String(selectedAmount), 6);
    const current = allowance || 0n;
    return current < required;
  })();

  const handlePickAndQuote = async (amount: number) => {
    setLuckyError(null);
    setLuckyResult(null);
    setQuoteResponse(null);
    setSelectedAmount(amount);
    if (endingSoonMarkets.length === 0) {
      setLuckyError("No markets ending soon.");
      return;
    }
    const randIndex = Math.floor(Math.random() * endingSoonMarkets.length);
    const market = endingSoonMarkets[randIndex];
    const position = getMaxOddsIndex(market);
    setSelectedMarket(market);
    setSelectedPosition(position);
    setLoadingQuote(true);
    try {
      const quote = await requestQuote({ market, position, amountUsd: amount });
      setQuoteResponse(quote);
    } catch (e: any) {
      setLuckyError(e?.message || "Failed to fetch quote");
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedAmount) return;
    try {
      const parsedBuyInAmount = parseUnits(String(selectedAmount), 6);
      await (approveAsync as any)({ functionName: "approve", args: [SPORTS_AMM_ADDRESS!, parsedBuyInAmount] });
      await refetchAllowance();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePlaceBet = async () => {
    if (
      !selectedMarket ||
      selectedPosition === null ||
      !selectedAmount ||
      !quoteResponse ||
      quoteResponse.error ||
      quoteResponse.quoteData?.error
    )
      return;
    try {
      setIsPlacingLucky(true);
      const parsedBuyInAmount = parseUnits(String(selectedAmount), 6);
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
      const parsedSlippage = parseEther("0.01");

      await (tradeAsync as any)({
        functionName: "trade",
        args: [
          tradeData,
          parsedBuyInAmount,
          parsedTotalQuote,
          parsedSlippage,
          scaffoldConfig.referralAddress,
          COLLATERAL_ADDRESS!,
          false,
        ],
      });

      setLuckyResult({ market: selectedMarket, position: selectedPosition, amount: selectedAmount });
      notification.success("Lucky bet placed!");
    } catch (e: any) {
      console.error(e);
      setLuckyError(e?.message || "Failed to place lucky bet");
      notification.error("Failed to place lucky bet");
    } finally {
      setIsPlacingLucky(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="opacity-70 mt-0 mb-2">We’ll pick a random market ending soon and take the highest odds.</p>
        {connectedAddress ? (
          <div className="join">
            <button
              className="btn btn-primary join-item"
              onClick={() => handlePickAndQuote(3)}
              disabled={isPlacingLucky}
            >
              Bet 3 USDC
            </button>
            <button
              className="btn btn-primary join-item"
              onClick={() => handlePickAndQuote(5)}
              disabled={isPlacingLucky}
            >
              Bet 5 USDC
            </button>
            <button
              className="btn btn-primary join-item"
              onClick={() => handlePickAndQuote(10)}
              disabled={isPlacingLucky}
            >
              Bet 10 USDC
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <RainbowKitCustomConnectButton />
          </div>
        )}
        {loadingQuote && (
          <div className="mt-4">
            <span className="loading loading-spinner"></span>
            <span className="ml-2">Getting quote...</span>
          </div>
        )}
        {isPlacingLucky && (
          <div className="mt-4">
            <span className="loading loading-spinner"></span>
            <span className="ml-2">Placing your lucky bet...</span>
          </div>
        )}
      </div>
      {quoteResponse && !quoteResponse.error && !quoteResponse.quoteData?.error && (
        <div className="bg-base-200 rounded-xl p-6 max-w-2xl mx-auto">
          <div className="grid grid-cols-3 gap-3">
            {quoteResponse.quoteData?.buyInAmountInUsd && (
              <div className="bg-base-100 p-2 rounded-xl text-center">
                <p className="text-xs opacity-70 mb-0 mt-0">Buy In</p>
                <p className="font-bold text-lg mb-0 mt-1">${quoteResponse.quoteData.buyInAmountInUsd?.toFixed(2)}</p>
              </div>
            )}
            <div className="bg-base-100 p-2 rounded-xl text-center">
              <p className="text-xs opacity-70 mb-0 mt-0">Odds</p>
              <p className="font-bold text-lg mb-0 mt-1">?.??</p>
            </div>
            {quoteResponse.quoteData?.payout && (
              <div className="bg-base-100 p-2 rounded-xl text-center">
                <p className="text-xs opacity-70 mb-0 mt-0">Payout</p>
                <p className="font-bold text-lg mb-0 mt-1">$?.??</p>
              </div>
            )}
          </div>

          {quoteResponse.quoteData?.potentialProfit && (
            <div className="bg-success/10 p-4 rounded-xl border-2 border-success mt-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs font-semibold opacity-70 mb-0 mt-0">Potential Profit</p>
                  <p className="font-bold text-2xl mb-0 mt-1">$?.??</p>
                </div>
                {quoteResponse.quoteData.potentialProfit.percentage && (
                  <div className="badge badge-success badge-lg text-lg font-bold">+?.??%</div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 mt-6">
            {needsApproval && (
              <button className="btn btn-warning btn-lg w-full" onClick={handleApprove} disabled={isApproving}>
                {isApproving ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Approving USDC...
                  </>
                ) : (
                  "Approve USDC"
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
                "Confirm Bet"
              )}
            </button>
          </div>
        </div>
      )}
      {luckyError && (
        <div className="alert alert-error max-w-2xl mx-auto">
          <span>{luckyError}</span>
        </div>
      )}
      {luckyResult && (
        <div className="max-w-3xl mx-auto">
          <div className="alert alert-success mb-4">
            <span>
              Bet placed: {luckyResult.amount} USDC on{" "}
              {luckyResult.position === 0 ? "Home" : luckyResult.position === 1 ? "Away" : "Draw"}
            </span>
          </div>
          <MarketCard market={luckyResult.market} onPlaceBet={() => {}} />
        </div>
      )}
    </div>
  );
};
