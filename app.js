const STORAGE_KEY = "cp_holdings_v1";
const CURRENCY_KEY = "cp_currency_v1";
const API_BASE = "https://api.coingecko.com/api/v3";

const CHAINS = [
  { name: "Ethereum", rpcUrl: "https://eth.llamarpc.com", nativeCoinId: "ethereum" },
  { name: "Arbitrum", rpcUrl: "https://arb1.arbitrum.io/rpc", nativeCoinId: "ethereum" },
  { name: "Optimism", rpcUrl: "https://mainnet.optimism.io", nativeCoinId: "ethereum" },
  { name: "BNB Chain", rpcUrl: "https://bsc-dataseed.binance.org", nativeCoinId: "binancecoin" },
];

const state = {
  holdings: loadHoldings(),
  coins: [],
  coinMap: new Map(),
  prices: {},
  currency: localStorage.getItem(CURRENCY_KEY) || "usd",
  wallet: { address: null, balances: [] },
};

const els = {
  totalValue: document.getElementById("totalValue"),
  totalChange: document.getElementById("totalChange"),
  holdingsCount: document.getElementById("holdingsCount"),
  addForm: document.getElementById("addForm"),
  coinInput: document.getElementById("coinInput"),
  coinList: document.getElementById("coinList"),
  amountInput: document.getElementById("amountInput"),
  formError: document.getElementById("formError"),
  emptyState: document.getElementById("emptyState"),
  holdingsTable: document.getElementById("holdingsTable"),
  holdingsBody: document.getElementById("holdingsBody"),
  refreshBtn: document.getElementById("refreshBtn"),
  currencySelect: document.getElementById("currencySelect"),
  lastUpdated: document.getElementById("lastUpdated"),
  connectWalletBtn: document.getElementById("connectWalletBtn"),
  walletAddress: document.getElementById("walletAddress"),
};

els.currencySelect.value = state.currency;

function loadHoldings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHoldings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.holdings));
}

function formatCurrency(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: state.currency.toUpperCase(),
      maximumFractionDigits: value >= 1 ? 2 : 6,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${state.currency.toUpperCase()}`;
  }
}

function formatPercent(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

async function fetchCoinList() {
  try {
    const res = await fetch(`${API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1`);
    if (!res.ok) throw new Error("Failed to load coin list");
    const data = await res.json();
    state.coins = data;
    state.coinMap = new Map(data.map((c) => [c.id, c]));
    els.coinList.innerHTML = data
      .map((c) => `<option value="${c.id}">${c.name} (${c.symbol.toUpperCase()})</option>`)
      .join("");
  } catch (err) {
    console.error(err);
  }
}

async function fetchPrices() {
  const ids = new Set(state.holdings.map((h) => h.id));
  state.wallet.balances.forEach((b) => ids.add(b.coinId));
  if (ids.size === 0) {
    state.prices = {};
    return;
  }
  const url = `${API_BASE}/simple/price?ids=${encodeURIComponent([...ids].join(","))}&vs_currencies=${state.currency}&include_24hr_change=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load prices");
  state.prices = await res.json();
}

function coinMeta(id) {
  return state.coinMap.get(id);
}

function render() {
  const combined = state.holdings
    .map((h) => ({ id: h.id, amount: h.amount, source: "manual" }))
    .concat(
      state.wallet.balances.map((b) => ({
        id: b.coinId,
        amount: b.amount,
        source: "wallet",
        chains: b.chains,
      }))
    );

  els.holdingsCount.textContent = combined.length;

  if (combined.length === 0) {
    els.emptyState.hidden = false;
    els.holdingsTable.hidden = true;
    els.totalValue.textContent = formatCurrency(0);
    els.totalChange.textContent = "—";
    els.totalChange.className = "card-value";
    return;
  }

  els.emptyState.hidden = true;
  els.holdingsTable.hidden = false;

  let totalValue = 0;
  let totalPrevValue = 0;
  const rows = [];

  for (const h of combined) {
    const priceInfo = state.prices[h.id];
    const meta = coinMeta(h.id);
    const price = priceInfo ? priceInfo[state.currency] : undefined;
    const change = priceInfo ? priceInfo[`${state.currency}_24h_change`] : undefined;
    const value = price !== undefined ? price * h.amount : undefined;

    if (value !== undefined) {
      totalValue += value;
      if (change !== undefined) {
        totalPrevValue += value / (1 + change / 100);
      } else {
        totalPrevValue += value;
      }
    }

    rows.push({ h, meta, price, change, value });
  }

  const totalChangePct = totalPrevValue > 0 ? ((totalValue - totalPrevValue) / totalPrevValue) * 100 : undefined;

  els.totalValue.textContent = formatCurrency(totalValue);
  if (totalChangePct !== undefined) {
    els.totalChange.textContent = formatPercent(totalChangePct);
    els.totalChange.className = "card-value " + (totalChangePct >= 0 ? "positive" : "negative");
  } else {
    els.totalChange.textContent = "—";
    els.totalChange.className = "card-value";
  }

  els.holdingsBody.innerHTML = rows
    .map(({ h, meta, price, change, value }) => {
      const name = meta ? meta.name : h.id;
      const symbol = meta ? meta.symbol.toUpperCase() : "";
      const image = meta ? `<img src="${meta.image}" alt="" width="20" height="20" style="border-radius:50%" />` : "";
      const allocation = totalValue > 0 && value !== undefined ? ((value / totalValue) * 100).toFixed(1) + "%" : "—";
      const changeClass = change === undefined ? "" : change >= 0 ? "positive" : "negative";
      const actionCell =
        h.source === "wallet"
          ? `<span class="wallet-badge" title="${h.chains.map((c) => `${c.name}: ${c.amount}`).join(", ")}">Wallet</span>`
          : `<button class="remove-btn" data-id="${h.id}" title="Remove">&times;</button>`;
      return `
        <tr>
          <td><div class="coin-cell">${image}<span>${name}</span><span class="coin-symbol">${symbol}</span></div></td>
          <td>${formatCurrency(price)}</td>
          <td class="${changeClass}">${formatPercent(change)}</td>
          <td>${h.amount}</td>
          <td>${formatCurrency(value)}</td>
          <td>${allocation}</td>
          <td>${actionCell}</td>
        </tr>
      `;
    })
    .join("");

  els.holdingsBody.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.holdings = state.holdings.filter((h) => h.id !== btn.dataset.id);
      saveHoldings();
      render();
      fetchPrices().then(render).catch(console.error);
    });
  });
}

async function fetchNativeBalance(chain, address) {
  const res = await fetch(chain.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [address, "latest"] }),
  });
  if (!res.ok) throw new Error(`RPC error for ${chain.name}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || `RPC error for ${chain.name}`);
  return Number(BigInt(data.result)) / 1e18;
}

async function fetchWalletBalances(address) {
  const results = await Promise.allSettled(CHAINS.map((chain) => fetchNativeBalance(chain, address)));
  const byCoin = new Map();
  results.forEach((result, i) => {
    const chain = CHAINS[i];
    if (result.status !== "fulfilled" || result.value <= 0) return;
    const entry = byCoin.get(chain.nativeCoinId) || { coinId: chain.nativeCoinId, amount: 0, chains: [] };
    entry.amount += result.value;
    entry.chains.push({ name: chain.name, amount: result.value });
    byCoin.set(chain.nativeCoinId, entry);
  });
  return Array.from(byCoin.values());
}

function updateWalletUI() {
  if (state.wallet.address) {
    els.connectWalletBtn.textContent = "Disconnect";
    els.walletAddress.hidden = false;
    els.walletAddress.textContent = `${state.wallet.address.slice(0, 6)}…${state.wallet.address.slice(-4)}`;
  } else {
    els.connectWalletBtn.textContent = "Connect Wallet";
    els.walletAddress.hidden = true;
  }
}

async function setWalletAddress(address) {
  state.wallet.address = address;
  updateWalletUI();
  try {
    state.wallet.balances = await fetchWalletBalances(address);
  } catch (err) {
    console.error(err);
  }
  render();
  await refresh();
}

function disconnectWallet() {
  state.wallet.address = null;
  state.wallet.balances = [];
  updateWalletUI();
  render();
}

async function connectWallet() {
  if (!window.ethereum) {
    els.walletAddress.hidden = false;
    els.walletAddress.textContent = "No wallet found — install MetaMask";
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (accounts[0]) await setWalletAddress(accounts[0]);
  } catch (err) {
    console.error(err);
  }
}

async function refresh() {
  els.lastUpdated.textContent = "Updating…";
  try {
    await fetchPrices();
    render();
    els.lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    console.error(err);
    els.lastUpdated.textContent = "Update failed";
  }
}

els.addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.formError.hidden = true;

  const rawInput = els.coinInput.value.trim().toLowerCase();
  const amount = parseFloat(els.amountInput.value);

  if (!rawInput || !amount || amount <= 0) {
    els.formError.textContent = "Enter a valid coin and amount.";
    els.formError.hidden = false;
    return;
  }

  let id = rawInput;
  if (!state.coinMap.has(id)) {
    const match = state.coins.find(
      (c) => c.symbol.toLowerCase() === rawInput || c.name.toLowerCase() === rawInput
    );
    if (match) {
      id = match.id;
    } else {
      els.formError.textContent = `Unknown coin "${rawInput}". Pick one from the suggestions.`;
      els.formError.hidden = false;
      return;
    }
  }

  const existing = state.holdings.find((h) => h.id === id);
  if (existing) {
    existing.amount += amount;
  } else {
    state.holdings.push({ id, amount });
  }
  saveHoldings();
  els.coinInput.value = "";
  els.amountInput.value = "";

  render();
  await refresh();
});

els.refreshBtn.addEventListener("click", refresh);

els.currencySelect.addEventListener("change", () => {
  state.currency = els.currencySelect.value;
  localStorage.setItem(CURRENCY_KEY, state.currency);
  refresh();
});

els.connectWalletBtn.addEventListener("click", () => {
  if (state.wallet.address) {
    disconnectWallet();
  } else {
    connectWallet();
  }
});

(async function init() {
  render();
  await fetchCoinList();
  await refresh();

  if (window.ethereum) {
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (accounts[0]) setWalletAddress(accounts[0]);
      })
      .catch(() => {});
    window.ethereum.on?.("accountsChanged", (accounts) => {
      if (accounts[0]) setWalletAddress(accounts[0]);
      else disconnectWallet();
    });
  }
})();
