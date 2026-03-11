import { useState } from 'react';
import { useAccreditClient } from '../../hooks/useAccreditClient';
import { StatusBadge } from '../common/StatusBadge';
import type { BatchResult } from '../../types';

export function KycBatchPanel() {
  const { api } = useAccreditClient();
  const [input, setInput] = useState('');
  const [results, setResults] = useState<BatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResults([]);

    const wallets = input
      .split(/[\n,]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0);

    if (wallets.length === 0) {
      setError('Please enter at least one wallet address');
      return;
    }

    if (wallets.length > 100) {
      setError('Maximum 100 addresses per batch');
      return;
    }

    setLoading(true);
    try {
      const batchResults = await api.batchCheckCompliance(wallets);
      setResults(batchResults);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Batch check failed',
      );
    } finally {
      setLoading(false);
    }
  }

  const compliantCount = results.filter((r) => r.isCompliant).length;
  const nonCompliantCount = results.length - compliantCount;

  return (
    <div className="batch-panel">
      <h3>Batch Compliance Check</h3>
      <form onSubmit={handleSubmit} className="batch-form">
        <label htmlFor="batch-wallets" className="batch-label">
          Wallet Addresses (one per line or comma-separated)
        </label>
        <textarea
          id="batch-wallets"
          className="batch-textarea mono-font"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"Wallet1Address...\nWallet2Address...\nWallet3Address..."}
          rows={6}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || input.trim().length === 0}
        >
          {loading ? 'Checking...' : 'Run Batch Check'}
        </button>
      </form>

      {error && <div className="batch-error">{error}</div>}

      {results.length > 0 && (
        <div className="batch-results">
          <div className="batch-summary">
            <span className="batch-summary-item batch-summary-pass">
              Compliant: {compliantCount}
            </span>
            <span className="batch-summary-item batch-summary-fail">
              Non-Compliant: {nonCompliantCount}
            </span>
          </div>
          <div className="batch-results-list">
            {results.map((result, idx) => (
              <div key={idx} className="batch-result-row">
                <span className="mono-font batch-result-wallet">
                  {result.wallet.slice(0, 4)}...{result.wallet.slice(-4)}
                </span>
                <StatusBadge
                  status={result.isCompliant ? 'active' : 'revoked'}
                  label={result.isCompliant ? 'Compliant' : 'Non-Compliant'}
                />
                {result.reason && (
                  <span className="batch-result-reason">{result.reason}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
