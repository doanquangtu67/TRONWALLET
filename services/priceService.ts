import { TronPrice } from "../types";

export const fetchTronPrice = async (): Promise<TronPrice> => {
    // Fallback constants
    const USD_TO_VND_RATE = 25300; 

    try {
        // Attempt 1: CoinGecko
        // Note: CoinGecko has a rate limit of ~10-30 calls/min for public API.
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd,vnd&include_24hr_change=true', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.tron) {
                return {
                    usd: data.tron.usd,
                    vnd: data.tron.vnd,
                    change24h: data.tron.usd_24h_change
                };
            }
        }
    } catch (e) {
        // Silent failure for CoinGecko, proceed to fallback
    }

    try {
        // Attempt 2: Binance (Fallback)
        // Binance usually has higher limits but only USD pairs easily accessible via public ticker
        const binanceResponse = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=TRXUSDT');
        
        if (binanceResponse.ok) {
            const binanceData = await binanceResponse.json();
            const usdPrice = parseFloat(binanceData.lastPrice);
            const priceChangePercent = parseFloat(binanceData.priceChangePercent);
            
            return {
                usd: usdPrice,
                vnd: usdPrice * USD_TO_VND_RATE,
                change24h: priceChangePercent
            };
        }
    } catch (e) {
        // Silent failure for Binance
    }

    // Default return to avoid app crash if all APIs fail
    // Return 0s so UI shows $0.00 instead of crashing
    console.warn("Unable to fetch price from CoinGecko or Binance.");
    return {
        usd: 0,
        vnd: 0,
        change24h: 0
    };
}