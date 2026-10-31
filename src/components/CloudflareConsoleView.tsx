import React, { useState, useEffect } from 'react';
import { Cloud, Database, Cpu, Terminal, Play, Loader2, CheckCircle2, Shield, Activity, Image as ImageIcon, Copy, Check, Code, Upload } from 'lucide-react';
import { validateImageUpload } from '../utils/imgbb';
import { cloudflareApi } from '../services/cloudflareApi';

export const CloudflareConsoleView: React.FC = () => {
  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sqlQuery, setSqlQuery] = useState('SELECT id, title, rating, cover_image FROM anime LIMIT 5;');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState('');
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'd1' | 'schema' | 'imgbb' | 'logs'>('overview');

  // Test ImgBB upload state
  const [testUploading, setTestUploading] = useState(false);
  const [testUploadResult, setTestUploadResult] = useState<any>(null);

  useEffect(() => {
    fetchCloudflareStatus();
  }, []);

  const fetchCloudflareStatus = async () => {
    try {
      const data = await cloudflareApi.fetchCloudflareStatus();
      if (data) setStatusData(data);
    } catch (err) {
      console.error('Failed to fetch Cloudflare status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sqlQuery.trim()) return;
    setQueryLoading(true);
    setQueryError('');
    setQueryResult(null);
    try {
      const data = await cloudflareApi.executeD1Query(sqlQuery);
      if (data.error) throw new Error(data.error);
      setQueryResult(data);
      fetchCloudflareStatus();
    } catch (err: any) {
      setQueryError(err.message);
    } finally {
      setQueryLoading(false);
    }
  };

  const handleCopySchema = () => {
    if (statusData?.schemaSql) {
      navigator.clipboard.writeText(statusData.schemaSql);
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 2000);
    }
  };

  const handleTestImgbbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageUpload(file.size, file.type);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setTestUploading(true);
    setTestUploadResult(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const data = await cloudflareApi.uploadImage(base64, file.name);
        setTestUploadResult(data);
        fetchCloudflareStatus();
      } catch (err) {
        console.error('Test upload failed:', err);
      } finally {
        setTestUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const services = statusData?.services || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900 border border-orange-500/30 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute right-4 -bottom-6 opacity-10 pointer-events-none">
          <Cloud className="w-64 h-64 text-orange-500" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center space-x-2 text-orange-400 font-semibold text-xs mb-2">
            <Shield className="w-4 h-4" />
            <span>Cloudflare Ecosystem + ImgBB Free Tier (Zero Card Required)</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white font-['Space_Grotesk',sans-serif] mb-3">
            Cloudflare Pages & D1 Control Center
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            Manage your Cloudflare Pages hosting, D1 relational SQL database, backend ImgBB image proxy (replacing R2 for card-free operation), and Workers functions.
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => setActiveSubTab('overview')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'overview' ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}`}
            >
              System Overview
            </button>
            <button
              onClick={() => setActiveSubTab('d1')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'd1' ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}`}
            >
              D1 SQL Console
            </button>
            <button
              onClick={() => setActiveSubTab('schema')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'schema' ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}`}
            >
              D1 Schema Script
            </button>
            <button
              onClick={() => setActiveSubTab('imgbb')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'imgbb' ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}`}
            >
              ImgBB Storage Gateway
            </button>
            <button
              onClick={() => setActiveSubTab('logs')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'logs' ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}`}
            >
              Workers & API Logs
            </button>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      {(activeSubTab === 'overview' || activeSubTab === 'd1' || activeSubTab === 'schema' || activeSubTab === 'imgbb' || activeSubTab === 'logs') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Pages */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                <Cloud className="w-5 h-5" />
              </div>
              <span className="flex items-center space-x-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                <span>{services.pages?.status}</span>
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-300">Cloudflare Pages</h3>
            <p className="text-xs text-slate-400 mt-1">Frontend Hosting & CDN</p>
            <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-300 flex justify-between">
              <span className="text-slate-500">Edge Network:</span>
              <span className="font-semibold">{services.pages?.edgeLocations}</span>
            </div>
          </div>

          {/* D1 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Database className="w-5 h-5" />
              </div>
              <span className="flex items-center space-x-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                <span>{services.d1?.status}</span>
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-300">Cloudflare D1</h3>
            <p className="text-xs text-slate-400 mt-1">Relational SQL Database</p>
            <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Database ID:</span>
                <span className="font-mono text-orange-400 text-[10px] truncate max-w-[140px]" title={services.d1?.databaseId || '75f053ab-5b44-4d48-abf8-b3a357a89426'}>
                  {services.d1?.databaseId || '75f053ab-5b44-4d48-abf8-b3a357a89426'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Records in D1:</span>
                <span className="font-semibold text-orange-400">{services.d1?.recordsCount} titles</span>
              </div>
            </div>
          </div>

          {/* ImgBB (Replacing R2) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-600/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                <ImageIcon className="w-5 h-5" />
              </div>
              <span className="flex items-center space-x-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                <span>{services.imgbb?.status}</span>
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-300">ImgBB Cloud CDN</h3>
            <p className="text-xs text-slate-400 mt-1">Zero-Card Image Storage</p>
            <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-300 flex justify-between">
              <span className="text-slate-500">Credit Card Req:</span>
              <span className="font-semibold text-emerald-400">NONE (100% Free)</span>
            </div>
          </div>

          {/* Workers */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                <Cpu className="w-5 h-5" />
              </div>
              <span className="flex items-center space-x-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                <span>{services.workers?.status}</span>
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-300">Pages Functions / Workers</h3>
            <p className="text-xs text-slate-400 mt-1">Serverless API Execution</p>
            <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-300 flex justify-between">
              <span className="text-slate-500">Avg Latency:</span>
              <span className="font-semibold text-emerald-400">{services.workers?.avgLatencyMs}</span>
            </div>
          </div>

        </div>
      )}

      {/* D1 SQL Console Tab */}
      {(activeSubTab === 'overview' || activeSubTab === 'd1') && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-bold text-white font-['Space_Grotesk',sans-serif] flex items-center space-x-2">
                <Terminal className="w-5 h-5 text-orange-400" />
                <span>Cloudflare D1 SQL Interactive Console</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Execute standard SQL queries directly against your D1 SQLite database binding.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSqlQuery('SELECT id, username, email, avatar_url FROM users;')}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:bg-slate-800"
              >
                SELECT users
              </button>
              <button
                onClick={() => setSqlQuery('SELECT id, title, rating, cover_image FROM anime LIMIT 5;')}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:bg-slate-800"
              >
                SELECT anime
              </button>
              <button
                onClick={() => setSqlQuery('SELECT id, service, event_type, status_code, details FROM cloudflare_logs ORDER BY id DESC LIMIT 5;')}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:bg-slate-800"
              >
                SELECT logs
              </button>
            </div>
          </div>

          <form onSubmit={handleRunQuery} className="space-y-4">
            <div className="relative">
              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-orange-300 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                placeholder="Enter SQL query (e.g. SELECT * FROM anime)..."
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Hint: DROP and TRUNCATE queries are restricted for safety.</span>
              <button
                type="submit"
                disabled={queryLoading}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs shadow-lg shadow-orange-600/30 transition-all disabled:opacity-50"
              >
                {queryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                <span>Execute SQL Query</span>
              </button>
            </div>
          </form>

          {queryError && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
              <span className="font-bold">SQL Error:</span> {queryError}
            </div>
          )}

          {queryResult && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Query executed successfully in <strong className="text-orange-400">{queryResult.latencyMs}ms</strong></span>
                <span>{queryResult.results.length} rows returned</span>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-300">
                      {queryResult.results.length > 0 ? (
                        Object.keys(queryResult.results[0]).map((key) => (
                          <th key={key} className="p-3 font-semibold">{key}</th>
                        ))
                      ) : (
                        <th className="p-3">Result</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.results.length === 0 ? (
                      <tr>
                        <td className="p-4 text-slate-500 italic">Query executed successfully (0 rows affected).</td>
                      </tr>
                    ) : (
                      queryResult.results.map((row: any, i: number) => (
                        <tr key={`query_row_${i}`} className="border-b border-slate-900/50 hover:bg-slate-900/40">
                          {Object.values(row).map((val: any, j: number) => (
                            <td key={`query_cell_${i}_${j}`} className="p-3 text-slate-300 truncate max-w-xs font-mono">
                              {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* D1 Schema Script Tab */}
      {(activeSubTab === 'overview' || activeSubTab === 'schema') && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-bold text-white font-['Space_Grotesk',sans-serif] flex items-center space-x-2">
                <Code className="w-5 h-5 text-orange-400" />
                <span>Cloudflare D1 Schema Script (`schema.sql`)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Copy and run this SQL script in your Cloudflare D1 Dashboard or via Wrangler CLI: <code className="text-orange-400">wrangler d1 execute &lt;db-name&gt; --file=schema.sql</code>
              </p>
            </div>
            <button
              onClick={handleCopySchema}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow transition-colors"
            >
              {copiedSchema ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedSchema ? 'Copied SQL!' : 'Copy SQL Schema'}</span>
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 overflow-x-auto max-h-96">
            <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre">
              {statusData?.schemaSql || '-- Loading schema.sql...'}
            </pre>
          </div>
        </div>
      )}

      {/* ImgBB Storage Gateway Tab */}
      {(activeSubTab === 'overview' || activeSubTab === 'imgbb') && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white font-['Space_Grotesk',sans-serif] flex items-center space-x-2">
                <ImageIcon className="w-5 h-5 text-orange-400" />
                <span>ImgBB Storage Gateway (Zero Credit Card Required)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Secure backend proxy runs on Cloudflare Functions/Workers, preserving client privacy and keeping API keys secure.
              </p>
            </div>

            <label className="cursor-pointer inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow transition-colors">
              <Upload className="w-4 h-4" />
              <span>Test ImgBB Upload</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleTestImgbbUpload}
                className="hidden"
              />
            </label>
          </div>

          {testUploading && (
            <div className="flex items-center space-x-2 text-xs text-orange-400 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Uploading test image through Cloudflare Worker to ImgBB...</span>
            </div>
          )}

          {testUploadResult && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs space-y-2">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Upload Successful via ImgBB Gateway!</span>
              </div>
              <div className="text-slate-300">
                <span className="text-slate-500">ImgBB URL:</span>{' '}
                <a href={testUploadResult.url} target="_blank" rel="noopener noreferrer" className="text-orange-400 underline font-mono">
                  {testUploadResult.url}
                </a>
              </div>
              <div className="text-slate-400 text-[11px]">
                Storage Mode: {testUploadResult.storage} • Saved to Cloudflare D1 schema as TEXT
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-slate-300">1. Security Guaranteed</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <code className="text-orange-400">IMGBB_API_KEY</code> resides strictly on the server backend. The frontend never sees or handles API secrets.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-slate-300">2. Free Zero-Card Tier</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ImgBB allows free high-volume hosting without credit card verification, removing the Cloudflare R2 barrier.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs font-bold text-slate-300">3. Direct D1 Integration</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Cloudflare D1 stores only the lightweight string URL (<code className="text-orange-400">https://i.ibb.co/...</code>), keeping database size tiny and fast.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Workers Logs Tab */}
      {(activeSubTab === 'overview' || activeSubTab === 'logs') && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white font-['Space_Grotesk',sans-serif] flex items-center space-x-2">
                <Activity className="w-5 h-5 text-orange-400" />
                <span>Cloudflare Workers & ImgBB Execution Logs</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Real-time request tracing across Cloudflare D1, Pages Functions, and ImgBB gateway.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-300">
                  <th className="p-3 font-semibold">Timestamp</th>
                  <th className="p-3 font-semibold">Service</th>
                  <th className="p-3 font-semibold">Event / Route</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Latency</th>
                  <th className="p-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {statusData?.logs?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-slate-500 italic text-center">No logs recorded yet.</td>
                  </tr>
                ) : (
                  statusData?.logs?.map((log: any) => (
                    <tr key={log.id} className="border-b border-slate-900/50 hover:bg-slate-900/40">
                      <td className="p-3 text-slate-400 font-mono text-[11px]">{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td className="p-3 font-bold text-orange-400">{log.service}</td>
                      <td className="p-3 text-slate-200">{log.event_type}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[10px] border border-emerald-500/20">
                          {log.status_code} OK
                        </span>
                      </td>
                      <td className="p-3 text-emerald-400 font-mono">{log.latency_ms}ms</td>
                      <td className="p-3 text-slate-400 truncate max-w-xs">{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
