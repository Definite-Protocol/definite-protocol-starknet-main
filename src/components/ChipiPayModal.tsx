import React, { useState, useEffect } from 'react';
import { X, CreditCard, DollarSign, Gift, Loader, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { useChipiPay } from '../hooks/useChipiPay';
import { useMultiChainWallet } from '../hooks/useMultiChainWallet';

interface ChipiPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'buy' | 'sell' | 'gift';
}

const ChipiPayModal: React.FC<ChipiPayModalProps> = ({ 
  isOpen, 
  onClose,
  defaultTab = 'buy'
}) => {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell' | 'gift'>(defaultTab);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'MXN'>('USD');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [step, setStep] = useState<'input' | 'processing' | 'success' | 'error'>('input');
  const [resultMessage, setResultMessage] = useState('');

  const {
    paymentMethods,
    loading,
    error,
    paymentState,
    canUseChipiPay,
    hasPaymentMethods,
    loadPaymentMethods,
    buyUSDC,
    sellUSDC,
    convertGiftCard
  } = useChipiPay();

  const { starknetWallet } = useMultiChainWallet();

  useEffect(() => {
    if (isOpen && canUseChipiPay) {
      loadPaymentMethods();
    }
  }, [isOpen, canUseChipiPay, loadPaymentMethods]);

  useEffect(() => {
    if (!isOpen) {
      setStep('input');
      setAmount('');
      setGiftCardCode('');
      setResultMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBuyUSDC = async () => {
    if (!amount || !selectedPaymentMethod) return;

    try {
      setStep('processing');
      const result = await buyUSDC(
        parseFloat(amount),
        currency,
        selectedPaymentMethod
      );

      if (result.success) {
        setResultMessage(`Successfully purchased ${amount} USDC!`);
        setStep('success');
      } else {
        setResultMessage(result.message || 'Purchase failed');
        setStep('error');
      }
    } catch (err) {
      setResultMessage(err instanceof Error ? err.message : 'Unknown error');
      setStep('error');
    }
  };

  const handleSellUSDC = async () => {
    if (!amount || !selectedPaymentMethod) return;

    try {
      setStep('processing');
      const result = await sellUSDC(
        parseFloat(amount),
        currency,
        selectedPaymentMethod
      );

      if (result.success) {
        setResultMessage(`Successfully sold ${amount} USDC!`);
        setStep('success');
      } else {
        setResultMessage(result.message || 'Sale failed');
        setStep('error');
      }
    } catch (err) {
      setResultMessage(err instanceof Error ? err.message : 'Unknown error');
      setStep('error');
    }
  };

  const handleConvertGiftCard = async () => {
    if (!giftCardCode || !amount) return;

    try {
      setStep('processing');
      const result = await convertGiftCard(
        giftCardCode,
        parseFloat(amount),
        currency
      );

      if (result.success) {
        setResultMessage(`Successfully converted gift card to ${amount} USDC!`);
        setStep('success');
      } else {
        setResultMessage(result.message || 'Conversion failed');
        setStep('error');
      }
    } catch (err) {
      setResultMessage(err instanceof Error ? err.message : 'Unknown error');
      setStep('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white border-2 border-black rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-black">
          <div>
            <h2 className="text-2xl text-black font-bold">Chipi Pay</h2>
            <p className="text-black text-opacity-60 text-sm">Buy, sell, or convert to USDC</p>
          </div>
          <button
            onClick={onClose}
            className="text-black hover:bg-gray-100 p-2 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-black">
          <button
            onClick={() => setActiveTab('buy')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'buy'
                ? 'bg-black text-white'
                : 'text-black hover:bg-gray-100'
            }`}
          >
            <DollarSign className="inline mr-1" size={16} />
            Buy USDC
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'sell'
                ? 'bg-black text-white'
                : 'text-black hover:bg-gray-100'
            }`}
          >
            <CreditCard className="inline mr-1" size={16} />
            Sell USDC
          </button>
          <button
            onClick={() => setActiveTab('gift')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'gift'
                ? 'bg-black text-white'
                : 'text-black hover:bg-gray-100'
            }`}
          >
            <Gift className="inline mr-1" size={16} />
            Gift Card
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!canUseChipiPay && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="text-red-600" size={20} />
                <div className="text-red-800 text-sm">
                  Chipi Pay is not configured. Please check your API key.
                </div>
              </div>
            </div>
          )}

          {!starknetWallet && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="text-yellow-600" size={20} />
                <div className="text-yellow-800 text-sm">
                  Please connect a Starknet wallet to receive USDC
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader className="animate-spin text-black" size={32} />
              <span className="ml-3 text-black">Loading payment methods...</span>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="text-red-600" size={20} />
                <div className="text-red-800 text-sm">{error}</div>
              </div>
            </div>
          )}

          {/* Payment Processing State */}
          {paymentState.isProcessing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2">
                <Loader className="animate-spin text-blue-600" size={20} />
                <div className="text-blue-800 text-sm">Processing payment...</div>
              </div>
            </div>
          )}

          {step === 'input' && !loading && (
            <>
              {/* Buy USDC Tab */}
              {activeTab === 'buy' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-black text-sm font-medium mb-2 block">Amount</label>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 border-2 border-black rounded-lg p-3 text-black outline-none"
                      />
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as 'USD' | 'MXN')}
                        className="border-2 border-black rounded-lg p-3 text-black outline-none"
                      >
                        <option value="USD">USD</option>
                        <option value="MXN">MXN</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-black text-sm font-medium mb-2 block">Payment Method</label>
                    {hasPaymentMethods ? (
                      <select
                        value={selectedPaymentMethod}
                        onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                        className="w-full border-2 border-black rounded-lg p-3 text-black outline-none"
                      >
                        <option value="">Select payment method</option>
                        {paymentMethods.map((method) => (
                          <option key={method.id} value={method.id}>
                            {method.type} - {method.details?.last4 || method.details?.email || method.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        <Plus className="mx-auto text-gray-400 mb-2" size={24} />
                        <div className="text-gray-600 text-sm">No payment methods added</div>
                        <button className="text-purple-600 text-sm font-medium mt-2 hover:underline">
                          Add Payment Method
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-blue-800 text-xs">
                      <div><strong>Fee:</strong> 2.9% + $0.30</div>
                      <div><strong>You'll receive:</strong> ~{amount ? (parseFloat(amount) * 0.971).toFixed(2) : '0.00'} USDC</div>
                    </div>
                  </div>

                  <button
                    onClick={handleBuyUSDC}
                    disabled={!canUseChipiPay || !amount || !selectedPaymentMethod || !starknetWallet}
                    className={`w-full py-4 rounded-lg font-semibold text-white transition-all ${
                      canUseChipiPay && amount && selectedPaymentMethod && starknetWallet
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Buy USDC
                  </button>
                </div>
              )}

              {/* Sell USDC Tab */}
              {activeTab === 'sell' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-black text-sm font-medium mb-2 block">Amount (USDC)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full border-2 border-black rounded-lg p-3 text-black outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-black text-sm font-medium mb-2 block">Receive Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as 'USD' | 'MXN')}
                      className="w-full border-2 border-black rounded-lg p-3 text-black outline-none"
                    >
                      <option value="USD">USD</option>
                      <option value="MXN">MXN</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-black text-sm font-medium mb-2 block">Payment Method</label>
                    <select
                      value={selectedPaymentMethod}
                      onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                      className="w-full border-2 border-black rounded-lg p-3 text-black outline-none"
                    >
                      <option value="">Select payment method</option>
                      {paymentMethods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.type} - {method.details?.last4 || method.details?.email || method.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleSellUSDC}
                    disabled={!canUseChipiPay || !amount || !selectedPaymentMethod}
                    className={`w-full py-4 rounded-lg font-semibold text-white transition-all ${
                      canUseChipiPay && amount && selectedPaymentMethod
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Sell USDC
                  </button>
                </div>
              )}

              {/* Gift Card Tab */}
              {activeTab === 'gift' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-black text-sm font-medium mb-2 block">Gift Card Code</label>
                    <input
                      type="text"
                      value={giftCardCode}
                      onChange={(e) => setGiftCardCode(e.target.value)}
                      placeholder="Enter gift card code"
                      className="w-full border-2 border-black rounded-lg p-3 text-black outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-black text-sm font-medium mb-2 block">Gift Card Value</label>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 border-2 border-black rounded-lg p-3 text-black outline-none"
                      />
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as 'USD' | 'MXN')}
                        className="border-2 border-black rounded-lg p-3 text-black outline-none"
                      >
                        <option value="USD">USD</option>
                        <option value="MXN">MXN</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="text-purple-800 text-xs">
                      <div><strong>Supported:</strong> Amazon, iTunes, Google Play, Steam</div>
                      <div><strong>Conversion rate:</strong> 1:1 to USDC</div>
                    </div>
                  </div>

                  <button
                    onClick={handleConvertGiftCard}
                    disabled={!canUseChipiPay || !giftCardCode || !amount || !starknetWallet}
                    className={`w-full py-4 rounded-lg font-semibold text-white transition-all ${
                      canUseChipiPay && giftCardCode && amount && starknetWallet
                        ? 'bg-purple-600 hover:bg-purple-700'
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Convert Gift Card
                  </button>
                </div>
              )}
            </>
          )}

          {step === 'processing' && (
            <div className="text-center py-8">
              <Loader className="animate-spin text-purple-600 mx-auto mb-4" size={48} />
              <div className="text-black font-semibold text-lg">Processing...</div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="text-green-600 mx-auto mb-4" size={48} />
              <div className="text-black font-semibold text-lg mb-2">Success!</div>
              <div className="text-black text-opacity-60 text-sm mb-4">{resultMessage}</div>
              <button
                onClick={onClose}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold text-white"
              >
                Close
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-8">
              <AlertCircle className="text-red-600 mx-auto mb-4" size={48} />
              <div className="text-black font-semibold text-lg mb-2">Error</div>
              <div className="text-red-600 text-sm mb-4">{resultMessage}</div>
              <button
                onClick={() => setStep('input')}
                className="w-full py-3 bg-black hover:bg-gray-800 rounded-lg font-semibold text-white"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChipiPayModal;

