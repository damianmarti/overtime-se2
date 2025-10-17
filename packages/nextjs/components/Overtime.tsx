import React, { useState } from "react";
import { MarketsList } from "./MarketsList";
import { QuoteModal } from "./QuoteModal";
import { useChainId } from "wagmi";

export const Overtime: React.FC = () => {
  const chainId = useChainId();
  // Default to Optimism (10) if no wallet connected or if on unsupported network (e.g., mainnet)
  const networkId = chainId && chainId !== 1 ? chainId : 10;

  // Quote modal state
  const [selectedMarket, setSelectedMarket] = useState<any>(null);

  const openQuoteModal = (market: any) => {
    setSelectedMarket(market);
  };

  const closeQuoteModal = () => {
    setSelectedMarket(null);
  };

  return (
    <>
      <MarketsList onPlaceBet={openQuoteModal} />

      <QuoteModal market={selectedMarket} networkId={networkId} onClose={closeQuoteModal} />
    </>
  );
};
