"use client";

import type { NextPage } from "next";
import { Overtime } from "~~/components/Overtime";

const Home: NextPage = () => {
  return (
    <>
      <div className="flex items-center flex-col grow pt-10 pb-10">
        <div className="px-5 w-full max-w-7xl">
          <h1 className="text-center mb-2">
            <span className="block text-4xl font-bold">Sports Betting Platform</span>
          </h1>

          <Overtime />
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
                    <li>Browse sports betting markets across multiple sports</li>
                    <li>Auto-quote generation when entering bet amount or selecting position</li>
                    <li>Place bets directly on-chain with USDC</li>
                    <li>Multi-network support (Optimism, Base, Arbitrum)</li>
                    <li>View your betting history and track open/claimable/closed bets</li>
                    <li>Claim winnings for resolved bets directly from your profile</li>
                    <li>Dynamic odds display supporting 2-way and 3-way markets</li>
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
    </>
  );
};

export default Home;
