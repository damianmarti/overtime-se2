import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

interface MarketCardProps {
  market: {
    homeTeam: string;
    awayTeam: string;
    tournamentName?: string;
    maturityDate?: string;
    odds?: Array<{
      decimal?: number;
      american?: number;
    }>;
    isOpen?: boolean;
    isPaused?: boolean;
    isResolved?: boolean;
    isCancelled?: boolean;
  };
  onPlaceBet: () => void;
}

export const MarketCard: React.FC<MarketCardProps> = ({ market, onPlaceBet }) => {
  return (
    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow overflow-hidden">
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
          <div className="absolute top-3 right-3 text-xs opacity-70">
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
              <div className={`grid gap-2 ${market.odds.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                {(market.odds.length === 3 ? [market.odds[0], market.odds[2], market.odds[1]] : market.odds).map(
                  (odd: any, idx: number) => {
                    const labels = market.odds!.length === 3 ? ["Home", "Draw", "Away"] : ["Home", "Away"];
                    return (
                      <div key={idx} className="bg-primary/10 p-3 rounded text-center">
                        <p className="text-xs opacity-70 mb-1">{labels[idx]}</p>
                        <p className="font-bold text-lg">
                          {odd?.decimal ? odd.decimal.toFixed(2) : odd?.american || "N/A"}
                        </p>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          )}

          <div className="card-actions justify-center mt-4">
            <ConnectButton.Custom>
              {({ account, chain, openConnectModal, mounted }) => {
                const connected = mounted && account && chain;
                if (!connected) {
                  return (
                    <button className="btn btn-primary w-full" onClick={openConnectModal} type="button">
                      Connect Wallet to Place Bet
                    </button>
                  );
                }
                return (
                  <button className="btn btn-primary w-full" onClick={onPlaceBet}>
                    Place Bet
                  </button>
                );
              }}
            </ConnectButton.Custom>
          </div>

          {/* Status badges at top left */}
          <div className="absolute top-3 left-3 flex gap-1 flex-wrap max-w-[50%]">
            {market.isOpen && <span className="badge badge-success badge-sm">Open</span>}
            {market.isPaused && <span className="badge badge-warning badge-sm">Paused</span>}
            {market.isResolved && <span className="badge badge-info badge-sm">Resolved</span>}
            {market.isCancelled && <span className="badge badge-error badge-sm">Cancelled</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
