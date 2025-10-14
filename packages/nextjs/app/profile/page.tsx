"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { Address } from "~~/components/scaffold-eth";

interface SportMarket {
  gameId: string;
  sport: string;
  leagueId: number;
  subLeagueId: number;
  leagueName: string;
  typeId: number;
  type: string;
  maturity: number;
  maturityDate: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  isOpen: boolean;
  isResolved: boolean;
  isCancelled: boolean;
  isWinning: boolean;
  position: number;
  odd: number;
  isGameFinished: boolean;
  gameStatus: string;
  playerProps?: {
    playerId: number;
    playerName: string;
  };
}

interface Ticket {
  id: string;
  timestamp: number;
  collateral: string;
  account: string;
  buyInAmount: number;
  fees: number;
  totalQuote: number;
  payout: number;
  numOfMarkets: number;
  expiry: number;
  isResolved: boolean;
  isPaused: boolean;
  isCancelled: boolean;
  isLost: boolean;
  isUserTheWinner: boolean;
  isExercisable: boolean;
  isClaimable: boolean;
  isOpen: boolean;
  finalPayout: number;
  isLive: boolean;
  sportMarkets: SportMarket[];
}

interface UserHistory {
  open: Ticket[];
  claimable: Ticket[];
  closed: Ticket[];
}

const Profile: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [userHistory, setUserHistory] = useState<UserHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"open" | "claimable" | "closed">("open");

  useEffect(() => {
    if (connectedAddress) {
      fetchUserHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedAddress]);

  const fetchUserHistory = async () => {
    if (!connectedAddress) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/profile/${connectedAddress}`);
      const data = await response.json();

      // Ensure data has the expected structure
      const normalizedData: UserHistory = {
        open: data?.open || [],
        claimable: data?.claimable || [],
        closed: data?.closed || [],
      };

      setUserHistory(normalizedData);
    } catch (error) {
      console.error("Error fetching user history:", error);
      setUserHistory(null);
    } finally {
      setLoading(false);
    }
  };

  const renderTicket = (ticket: Ticket) => (
    <div key={ticket.id} className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="card-title text-lg">
              Ticket #{ticket.id.slice(0, 8)}...{ticket.id.slice(-6)}
            </h3>
            <p className="text-sm opacity-70">{new Date(ticket.timestamp).toLocaleString()}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {ticket.isUserTheWinner && <span className="badge badge-success">Won</span>}
            {ticket.isLost && <span className="badge badge-error">Lost</span>}
            {ticket.isClaimable && <span className="badge badge-warning">Claimable</span>}
            {ticket.isOpen && <span className="badge badge-info">Open</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-base-200 p-4 rounded-lg">
            <p className="text-xs opacity-70 mb-1">Buy In</p>
            <p className="font-bold text-lg">
              {ticket.buyInAmount.toFixed(2)} {ticket.collateral}
            </p>
          </div>
          <div className="bg-base-200 p-4 rounded-lg">
            <p className="text-xs opacity-70 mb-1">Potential Payout</p>
            <p className="font-bold text-lg text-success">
              {ticket.payout.toFixed(2)} {ticket.collateral}
            </p>
          </div>
          <div className="bg-base-200 p-4 rounded-lg">
            <p className="text-xs opacity-70 mb-1">Potential Win</p>
            <p className="font-bold text-lg text-primary">
              +{(ticket.payout - ticket.buyInAmount).toFixed(2)} {ticket.collateral}
            </p>
          </div>
        </div>

        {/* Markets */}
        <div className="mt-6">
          <h4 className="font-semibold mb-3 text-base">
            Bet Details ({ticket.numOfMarkets} market{ticket.numOfMarkets !== 1 ? "s" : ""})
          </h4>
          <div className="space-y-3">
            {ticket.sportMarkets.map((market, idx) => (
              <div key={idx} className="bg-base-200 p-4 rounded-lg border-l-4 border-primary">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge badge-sm badge-outline">{market.sport}</span>
                      {market.isWinning && <span className="badge badge-success badge-sm">Won ✓</span>}
                    </div>
                    <p className="font-semibold text-base mb-1">
                      {market.homeTeam} vs {market.awayTeam}
                    </p>
                    <p className="text-sm opacity-70">{market.leagueName}</p>
                    {market.isResolved && market.homeScore != null && market.awayScore != null && (
                      <p className="text-sm mt-2 font-medium">
                        Final Score: {market.homeScore} - {market.awayScore}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="badge badge-primary badge-lg">
                      {market.position === 0 ? market.homeTeam : market.position === 1 ? market.awayTeam : "Draw"}
                    </div>
                    <p className="text-xs opacity-70 mt-1 capitalize">{market.type}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {ticket.isClaimable && (
          <div className="card-actions justify-end mt-4">
            <button className="btn btn-primary btn-sm">Claim Winnings</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex items-center flex-col grow pt-10 pb-10">
      <div className="px-5 w-full max-w-7xl">
        <h1 className="text-center mb-8">
          <span className="block text-4xl font-bold">My Profile</span>
        </h1>

        <div className="flex justify-center items-center space-x-2 flex-col mb-6">
          <p className="my-2 font-medium">Connected Address:</p>
          <Address address={connectedAddress} />
        </div>

        {!connectedAddress ? (
          <div className="text-center py-12">
            <p className="text-lg opacity-70">Please connect your wallet to view your profile.</p>
          </div>
        ) : loading ? (
          <div className="text-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
            <p className="mt-4">Loading your betting history...</p>
          </div>
        ) : userHistory ? (
          <>
            {/* Tabs */}
            <div className="tabs tabs-boxed justify-center mb-8">
              <a className={`tab ${selectedTab === "open" ? "tab-active" : ""}`} onClick={() => setSelectedTab("open")}>
                Open ({userHistory.open.length})
              </a>
              <a
                className={`tab ${selectedTab === "claimable" ? "tab-active" : ""}`}
                onClick={() => setSelectedTab("claimable")}
              >
                Claimable ({userHistory.claimable.length})
              </a>
              <a
                className={`tab ${selectedTab === "closed" ? "tab-active" : ""}`}
                onClick={() => setSelectedTab("closed")}
              >
                Closed ({userHistory.closed.length})
              </a>
            </div>

            {/* Ticket List */}
            <div className="space-y-6">
              {selectedTab === "open" && (
                <>
                  {userHistory.open.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-lg opacity-70">No open bets.</p>
                    </div>
                  ) : (
                    userHistory.open.map(renderTicket)
                  )}
                </>
              )}
              {selectedTab === "claimable" && (
                <>
                  {userHistory.claimable.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-lg opacity-70">No claimable bets.</p>
                    </div>
                  ) : (
                    userHistory.claimable.map(renderTicket)
                  )}
                </>
              )}
              {selectedTab === "closed" && (
                <>
                  {userHistory.closed.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-lg opacity-70">No closed bets.</p>
                    </div>
                  ) : (
                    userHistory.closed.map(renderTicket)
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg opacity-70">Failed to load betting history.</p>
            <button onClick={fetchUserHistory} className="btn btn-primary mt-4">
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
