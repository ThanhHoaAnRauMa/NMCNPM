import { useState } from 'react'
import { BrowserProvider, Contract } from 'ethers'

const ABI = ['function verifyProof(bytes32 roomId, bytes32 leaf, bytes32[] proof) view returns (bool)']

export default function ForensicsPanel() {
  const [account, setAccount] = useState('')
  const [form, setForm] = useState({ roomId: '', leaf: '', proof: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS || ''

  const connect = async () => {
    setError('')
    try {
      if (!window.ethereum) throw new Error('Không tìm thấy ví EVM trong trình duyệt.')
      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      setAccount(await signer.getAddress())
    } catch (walletError) {
      setError(walletError.message)
    }
  }

  const verify = async (event) => {
    event.preventDefault()
    setError('')
    setResult(null)
    try {
      if (!contractAddress) throw new Error('Chưa cấu hình VITE_CONTRACT_ADDRESS.')
      const provider = window.ethereum ? new BrowserProvider(window.ethereum) : null
      if (!provider) throw new Error('Cần ví EVM để đọc Sepolia.')
      const contract = new Contract(contractAddress, ABI, provider)
      const proof = form.proof.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean)
      setResult(await contract.verifyProof(form.roomId.trim(), form.leaf.trim(), proof))
    } catch (verifyError) {
      setError(verifyError.shortMessage || verifyError.message)
    }
  }

  return (
    <div className="scrollbar h-full overflow-y-auto p-5 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <p className="eyebrow">On-chain verification</p>
        <h2 className="mt-3 font-display text-4xl">Kiểm chứng bằng chứng Merkle</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Gọi trực tiếp hàm view của smart contract bằng ví người dùng. Private key ví không đi qua backend.</p>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <form className="panel rounded-2xl p-6" onSubmit={verify}>
            <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-bold">Proof verifier</h3><span className="rounded-full bg-violet-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-300">Sepolia</span></div>
            <label className="mt-6 block text-xs font-semibold text-slate-300">Room ID (bytes32)<input className="field mt-2 font-mono" required value={form.roomId} onChange={(event) => setForm({ ...form, roomId: event.target.value })} /></label>
            <label className="mt-4 block text-xs font-semibold text-slate-300">Message leaf (bytes32)<input className="field mt-2 font-mono" required value={form.leaf} onChange={(event) => setForm({ ...form, leaf: event.target.value })} /></label>
            <label className="mt-4 block text-xs font-semibold text-slate-300">Merkle proof<textarea className="field mt-2 min-h-28 font-mono" placeholder="0x..., 0x..." value={form.proof} onChange={(event) => setForm({ ...form, proof: event.target.value })} /></label>
            {error && <p className="mt-4 rounded-xl bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
            {result !== null && <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${result ? 'bg-mint/10 text-mint' : 'bg-red-400/10 text-red-200'}`}>{result ? 'Proof hợp lệ với confirmed root.' : 'Proof không hợp lệ.'}</p>}
            <button className="btn-primary mt-5 w-full" type="submit">Kiểm chứng on-chain</button>
          </form>

          <aside className="space-y-5">
            <section className="panel rounded-2xl p-6">
              <p className="eyebrow">Wallet</p>
              <p className="mt-3 break-all font-mono text-xs text-slate-400">{account || 'Chưa kết nối ví'}</p>
              <button className="btn-secondary mt-4 w-full" onClick={connect}>{account ? 'Ví đã kết nối' : 'Kết nối ví'}</button>
            </section>
            <section className="rounded-2xl border border-amber/25 bg-amber/5 p-6">
              <p className="text-sm font-bold text-amber">Phạm vi hiện tại</p>
              <p className="mt-3 text-xs leading-6 text-slate-400">Contract hỗ trợ verify proof, nhưng backend chưa có API tạo Merkle proof hoặc export evidence package. Form này cần dữ liệu proof từ log cục bộ/nguồn ngoài.</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
