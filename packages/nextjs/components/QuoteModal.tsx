import React, { useEffect, useState } from "react";
import { parseEther, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";
import { notification } from "~~/utils/scaffold-eth";

interface QuoteModalProps {
  market: any | null;
  networkId: number;
  onClose: () => void;
}

const COLLATERAL_DECIMALS = 6; // USDC
const SLIPPAGE = "0.01"; // 1% slippage

export const QuoteModal: React.FC<QuoteModalProps> = ({ market, networkId, onClose }) => {
  const { address: connectedAddress } = useAccount();

  const [buyInAmount, setBuyInAmount] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<number>(0);
  const [quoteResponse, setQuoteResponse] = useState<any>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);

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

  // Reset state when market changes
  useEffect(() => {
    if (market) {
      setBuyInAmount("");
      setSelectedPosition(0);
      setQuoteResponse(null);
    }
  }, [market]);

  // Auto-fetch quote when buyInAmount or selectedPosition changes
  useEffect(() => {
    if (market && buyInAmount && parseInt(buyInAmount) >= 3) {
      // Clear previous quote before fetching new one
      setQuoteResponse(null);
      getQuote();
    } else if (market && buyInAmount && parseInt(buyInAmount) < 3) {
      // Clear quote if amount is below minimum
      setQuoteResponse(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyInAmount, selectedPosition, market]);

  const getQuote = async () => {
    if (!buyInAmount || !market) return;

    setLoadingQuote(true);
    try {
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
          position: selectedPosition,
          combinedPositions: market.combinedPositions,
          live: false,
        },
      ];

      const payload = {
        buyInAmount: parseInt(buyInAmount),
        tradeData: tradeDataPayload,
      };

      console.log("Sending quote request:", payload);
      console.log("Selected market:", market);

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
    if (!quoteResponse || !quoteResponse.quoteData || !market) return;
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
          gameId: market.gameId,
          sportId: market.subLeagueId,
          typeId: market.typeId,
          maturity: market.maturity,
          status: market.status,
          line: market.line,
          playerId: market.playerProps?.playerId,
          odds: market.odds?.map((odd: any) => parseEther(odd.normalizedImplied.toString())) || [],
          merkleProof: market.proof,
          position: selectedPosition,
          combinedPositions: market.combinedPositions,
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
      onClose();
    } catch (e) {
      console.error("Trade error", e);
      notification.error("Error placing bet");
    }
  };

  if (!market) return null;

  const parsedBuyInAmount = buyInAmount ? parseUnits(buyInAmount, COLLATERAL_DECIMALS) : 0n;
  const currentAllowance = allowance || 0n;
  const needsApproval = currentAllowance < parsedBuyInAmount;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        {/* Header */}
        <div className="bg-primary text-primary-content p-4 -m-6 mb-6 rounded-t-2xl relative">
          <button className="btn btn-sm btn-circle btn-ghost absolute top-4 right-4" onClick={onClose}>
            ✕
          </button>
          <div className="text-center pr-8">
            <p className="text-xl font-bold my-0">{market?.homeTeam}</p>
            <p className="text-sm opacity-70 my-0">vs</p>
            <p className="text-xl font-bold my-0">{market?.awayTeam}</p>
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
                  <div className="font-semibold">{market?.homeTeam}</div>
                </div>
              </button>
              <button
                className={`btn btn-lg ${selectedPosition === 1 ? "btn-primary" : "btn-outline"}`}
                onClick={() => setSelectedPosition(1)}
              >
                <div className="text-center">
                  <div className="text-xs opacity-70">Away</div>
                  <div className="font-semibold">{market?.awayTeam}</div>
                </div>
              </button>
              {market?.odds && market.odds.length > 2 && (
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
                        <p className="font-bold text-lg mb-0 mt-1">${quoteResponse.quoteData.payout.usd?.toFixed(2)}</p>
                      </div>
                    )}
                  </div>

                  {/* Potential Profit - Highlighted */}
                  {quoteResponse.quoteData?.potentialProfit && (
                    <div className="bg-success/10 p-4 rounded-xl border-2 border-success">
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
            {needsApproval && (
              <button className="btn btn-warning btn-lg w-full" onClick={handleApprove} disabled={isApproving}>
                {isApproving ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Approving USDC...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
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
          </div>
        )}

        <div className="modal-action mt-6">
          <button className="btn btn-ghost w-full" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
