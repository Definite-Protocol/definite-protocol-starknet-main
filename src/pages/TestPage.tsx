/**
 * Test Page - Contract Integration Testing
 * Debug page for testing wallet connection and contract calls
 */

import React, { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useConnect, useAccount } from '@starknet-react/core';
import { starknetHstrkService } from '../services/starknetHstrkService';

const TestPage: React.FC = () => {
  const { address, isConnected, disconnect } = useWallet();
  const { connect, connectors } = useConnect();
  const { account } = useAccount();

  const [testResults, setTestResults] = useState<string[]>([]);
  const [balances, setBalances] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mintAmount, setMintAmount] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [txProcessing, setTxProcessing] = useState(false);

  const addLog = (message: string) => {
    setTestResults(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    console.log(message);
  };

  useEffect(() => {
    if (isConnected && address) {
      addLog(`✅ Wallet connected: ${address}`);
      addLog(`🔍 Account object: ${account ? 'Available' : 'Undefined'}`);
      console.log('🔍 Account details:', account);
      loadBalances();
    }
  }, [isConnected, address, account]);

  const loadBalances = async () => {
    if (!address) return;

    setLoading(true);
    setError(null);
    addLog(`🔄 Loading balances for ${address}...`);

    try {
      const result = await starknetHstrkService.getBalances(address);
      setBalances(result);
      addLog(`✅ Balances loaded - STRK: ${result.strk}, hSTRK: ${result.hstrk}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load balances';
      setError(errorMsg);
      addLog(`❌ Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (connector: any) => {
    try {
      addLog(`🔌 Connecting to ${connector.name}...`);
      await connect({ connector });
    } catch (err) {
      addLog(`❌ Connection failed: ${err}`);
    }
  };

  const handleMint = async () => {
    addLog(`🔍 Mint clicked - account: ${account ? 'Available' : 'Undefined'}, mintAmount: ${mintAmount}`);
    console.log('🔍 Account object in handleMint:', account);

    if (!account || !mintAmount) {
      addLog('❌ Wallet not connected or amount not specified');
      addLog(`🔍 Debug - account: ${account}, mintAmount: ${mintAmount}`);
      return;
    }

    setTxProcessing(true);
    addLog(`🔄 Minting ${mintAmount} STRK...`);

    try {
      const amountBigInt = BigInt(Math.floor(parseFloat(mintAmount) * 1e18));
      const result = await starknetHstrkService.mint(account, amountBigInt);
      addLog(`✅ Mint successful! TX: ${result.transactionHash}`);
      setMintAmount('');
      await loadBalances();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Mint failed';
      addLog(`❌ Mint error: ${errorMsg}`);
    } finally {
      setTxProcessing(false);
    }
  };

  const handleRedeem = async () => {
    if (!account || !redeemAmount) {
      addLog('❌ Wallet not connected or amount not specified');
      return;
    }

    setTxProcessing(true);
    addLog(`🔄 Redeeming ${redeemAmount} hSTRK...`);

    try {
      const amountBigInt = BigInt(Math.floor(parseFloat(redeemAmount) * 1e18));
      const result = await starknetHstrkService.redeem(account, amountBigInt);
      addLog(`✅ Redeem successful! TX: ${result.transactionHash}`);
      setRedeemAmount('');
      await loadBalances();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Redeem failed';
      addLog(`❌ Redeem error: ${errorMsg}`);
    } finally {
      setTxProcessing(false);
    }
  };

  const config = {
    network: 'sepolia',
    chainId: 'SN_SEPOLIA',
    hstrkTokenAddress: '0x03b041b0d7074032d3101b271b20fecdb2312d44e404adb0637d52979483a93e',
    protocolAddress: '0x00826891ff0947da14fbd236dea07332bd56b9a98af378b00b5c6d5a3ad066e4',
    oracleAddress: '0x04856ae56007722f43dc4a7d82a1b7c8fff6f24207376995db6854f030f41757',
    collateralRatio: 1.5
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">🧪 Contract Integration Test</h1>

        {/* Wallet Connection */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">1. Wallet Connection</h2>
          
          {!isConnected ? (
            <div className="space-y-4">
              <p className="text-gray-400">Connect your wallet to test contract integration</p>
              <div className="flex gap-4">
                {connectors.map((connector) => (
                  <button
                    key={connector.id}
                    onClick={() => handleConnect(connector)}
                    className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition"
                  >
                    Connect {connector.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-green-400">✅ Connected</p>
              <p className="text-sm text-gray-400 font-mono break-all">Address: {address}</p>
              <p className="text-sm text-gray-400">Account: {account ? '✅ Available' : '❌ Undefined'}</p>
              <button
                onClick={disconnect}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm transition"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Contract Configuration */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">2. Contract Configuration</h2>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400">Network:</p>
                <p className="font-mono">{config.network}</p>
              </div>
              <div>
                <p className="text-gray-400">Chain ID:</p>
                <p className="font-mono">{config.chainId}</p>
              </div>
              <div>
                <p className="text-gray-400">hSTRK Token:</p>
                <p className="font-mono text-xs break-all">{config.hstrkTokenAddress}</p>
              </div>
              <div>
                <p className="text-gray-400">Protocol Vault:</p>
                <p className="font-mono text-xs break-all">{config.protocolAddress}</p>
              </div>
              <div>
                <p className="text-gray-400">Oracle:</p>
                <p className="font-mono text-xs break-all">{config.oracleAddress}</p>
              </div>
              <div>
                <p className="text-gray-400">Collateral Ratio:</p>
                <p className="font-mono">{config.collateralRatio * 100}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Balances */}
        {isConnected && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">3. User Balances</h2>
            {loading ? (
              <p className="text-gray-400">Loading balances...</p>
            ) : balances ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">STRK:</span>
                  <span className="font-mono">{(Number(balances.strk) / 1e18).toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">hSTRK:</span>
                  <span className="font-mono">{(Number(balances.hstrk) / 1e18).toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Collateral:</span>
                  <span className="font-mono">{(Number(balances.collateral) / 1e18).toFixed(1)}</span>
                </div>
              </div>
            ) : (
              <p className="text-red-400">Failed to load balances</p>
            )}
          </div>
        )}

        {/* Mint/Redeem Actions */}
        {isConnected && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">4. Mint / Redeem</h2>
            <div className="grid grid-cols-2 gap-6">
              {/* Mint Section */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-blue-400">Mint hSTRK</h3>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">STRK Amount</label>
                  <input
                    type="number"
                    value={mintAmount}
                    onChange={(e) => setMintAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    disabled={txProcessing}
                  />
                </div>
                <button
                  onClick={handleMint}
                  disabled={txProcessing || !mintAmount}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-3 rounded-lg font-semibold transition"
                >
                  {txProcessing ? 'Processing...' : 'Mint hSTRK'}
                </button>
              </div>

              {/* Redeem Section */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-orange-400">Redeem STRK</h3>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">hSTRK Amount</label>
                  <input
                    type="number"
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                    disabled={txProcessing}
                  />
                </div>
                <button
                  onClick={handleRedeem}
                  disabled={txProcessing || !redeemAmount}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-3 rounded-lg font-semibold transition"
                >
                  {txProcessing ? 'Processing...' : 'Redeem STRK'}
                </button>
              </div>
            </div>
          </div>
        )}



        {/* Test Logs */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">5. Test Logs</h2>
          <div className="bg-black rounded p-4 h-64 overflow-y-auto font-mono text-xs">
            {testResults.length === 0 ? (
              <p className="text-gray-500">No logs yet...</p>
            ) : (
              testResults.map((log, index) => (
                <div key={index} className="mb-1 text-green-400">
                  {log}
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => setTestResults([])}
            className="mt-4 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm transition"
          >
            Clear Logs
          </button>
        </div>

        {/* Back to Home */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
};

export default TestPage;

